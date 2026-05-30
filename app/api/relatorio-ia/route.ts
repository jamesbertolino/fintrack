import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { rateLimit } from '@/lib/rateLimit'
import { logIAUsage, verificarLimiteTokens } from '@/lib/iaUsage'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const rl = await rateLimit({ key: `relatorio:${user.id}`, limit: 5, windowSec: 3600 })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Limite de relatórios atingido. Tente novamente em 1 hora.' },
      { status: 429 }
    )
  }

  const { mes } = await request.json() // 'YYYY-MM'
  if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
    return NextResponse.json({ error: 'Parâmetro mes inválido' }, { status: 400 })
  }

  const inicio = `${mes}-01`
  const fim    = new Date(Number(mes.slice(0, 4)), Number(mes.slice(5)) , 0).toISOString().slice(0, 10)

  const [{ data: txs }, { data: metas }, { data: orcamentos }, { data: profile }] = await Promise.all([
    supabase.from('transactions')
      .select('descricao,valor,tipo,categoria,data_hora,conta_id')
      .eq('user_id', user.id)
      .gte('data_hora', inicio)
      .lte('data_hora', fim + 'T23:59:59')
      .order('data_hora', { ascending: false }),
    supabase.from('goals')
      .select('nome,valor_total,valor_atual,contribuicao_mensal,prazo')
      .eq('user_id', user.id).eq('ativo', true),
    supabase.from('orcamentos')
      .select('categoria,limite')
      .eq('user_id', user.id),
    supabase.from('profiles')
      .select('nome,plano,objetivo')
      .eq('id', user.id).single(),
  ])

  const plano = profile?.plano || 'free'
  const limite = await verificarLimiteTokens(user.id, plano)
  if (!limite.permitido) {
    return NextResponse.json({
      error: `Limite mensal de tokens atingido (${limite.usados.toLocaleString('pt-BR')} / ${limite.limite.toLocaleString('pt-BR')}).`,
      limite_atingido: true,
    }, { status: 429 })
  }

  const receitas = (txs || []).filter(t => t.tipo === 'credito').reduce((a, t) => a + t.valor, 0)
  const despesas = (txs || []).filter(t => t.tipo === 'debito').reduce((a, t) => a + Math.abs(t.valor), 0)
  const saldo    = receitas - despesas

  const porCategoria: Record<string, number> = {}
  ;(txs || []).filter(t => t.tipo === 'debito').forEach(t => {
    porCategoria[t.categoria] = (porCategoria[t.categoria] || 0) + Math.abs(t.valor)
  })
  const topCat = Object.entries(porCategoria).sort((a, b) => b[1] - a[1])

  const mesNome = new Date(mes + '-15').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  const objetivoTexto: Record<string, string> = {
    poupar:   'guardar dinheiro e construir reserva de emergência',
    quitar:   'quitar dívidas o mais rápido possível',
    investir: 'investir e crescer seu patrimônio',
  }
  const obj = objetivoTexto[(profile?.objetivo as string) || ''] || 'melhorar sua saúde financeira'

  const prompt = `Gere um relatório financeiro mensal completo e personalizado para o usuário abaixo.

Usuário: ${profile?.nome || 'usuário'}
Objetivo financeiro declarado: ${obj}
Mês de referência: ${mesNome}

=== DADOS DO MÊS ===
Total de transações: ${txs?.length || 0}
Receitas: R$ ${receitas.toFixed(2)}
Despesas: R$ ${despesas.toFixed(2)}
Resultado: ${saldo >= 0 ? '+' : ''}R$ ${saldo.toFixed(2)} (${receitas > 0 ? Math.round(((receitas - despesas) / receitas) * 100) : 0}% de sobra)

Gastos por categoria:
${topCat.map(([cat, val]) => `- ${cat}: R$ ${val.toFixed(2)} (${despesas > 0 ? Math.round((val / despesas) * 100) : 0}%)`).join('\n') || '- Nenhum gasto registrado'}

Orçamentos configurados:
${(orcamentos || []).map(o => {
  const gasto = porCategoria[o.categoria] || 0
  const pct   = o.limite > 0 ? Math.round((gasto / o.limite) * 100) : 0
  return `- ${o.categoria}: R$ ${gasto.toFixed(2)} de R$ ${(o.limite ?? 0).toFixed(2)} (${pct}%)${pct > 100 ? ' ⚠️ EXCEDIDO' : ''}`
}).join('\n') || '- Nenhum orçamento cadastrado'}

Metas ativas:
${(metas || []).map(m => `- ${m.nome}: R$ ${m.valor_atual} de R$ ${m.valor_total} (${m.valor_total > 0 ? Math.round((m.valor_atual / m.valor_total) * 100) : 0}%)`).join('\n') || '- Nenhuma meta cadastrada'}

=== FORMATO DO RELATÓRIO ===
Responda EXATAMENTE nesse formato com 4 seções separadas por "---":

## 📊 Resumo do mês
[2-3 frases resumindo o mês: resultado, destaque positivo e principal desafio]

---

## 🔍 Análise dos gastos
[3-4 pontos específicos sobre as categorias: o que foi bem, o que passou do orçamento, padrões identificados. Cite valores reais.]

---

## 📈 Tendências e alertas
[2-3 pontos sobre o que merece atenção: metas em risco, orçamentos estourados, oportunidades. Seja direto.]

---

## 💡 Recomendações para próximo mês
[3-4 sugestões práticas e específicas, personalizadas para o objetivo de "${obj}". Cada sugestão em nova linha com "→".]

Seja direto, cite valores reais, não use jargões. Responda em português brasileiro.`

  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (anthropicKey) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 1200,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      const data = await res.json()
      if (res.ok && data.content?.[0]?.text) {
        logIAUsage({
          user_id: user.id, endpoint: '/api/relatorio-ia', provider: 'anthropic',
          modelo: 'claude-sonnet-4-5',
          prompt_tokens:     data.usage?.input_tokens  || 0,
          completion_tokens: data.usage?.output_tokens || 0,
        })
        return NextResponse.json({ relatorio: data.content[0].text, mes: mesNome })
      }
    } catch { /* fallthrough */ }
  }

  const openaiKey = process.env.OPENAI_API_KEY
  if (openaiKey) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini', max_tokens: 1200,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      const data = await res.json()
      if (res.ok && data.choices?.[0]?.message?.content) {
        logIAUsage({
          user_id: user.id, endpoint: '/api/relatorio-ia', provider: 'openai',
          modelo: 'gpt-4o-mini',
          prompt_tokens:     data.usage?.prompt_tokens     || 0,
          completion_tokens: data.usage?.completion_tokens || 0,
        })
        return NextResponse.json({ relatorio: data.choices[0].message.content, mes: mesNome })
      }
    } catch { /* fallthrough */ }
  }

  return NextResponse.json({ error: 'Nenhuma API de IA configurada.' }, { status: 503 })
}
