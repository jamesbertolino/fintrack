import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { mensagem, historico } = await request.json()

  const [{ data: transacoes }, { data: metas }, { data: profile }] = await Promise.all([
    supabase.from('transactions').select('descricao,valor,tipo,categoria,data_hora')
      .eq('user_id', user.id).order('data_hora', { ascending: false }).limit(50),
    supabase.from('goals').select('nome,valor_total,valor_atual,contribuicao_mensal,prazo')
      .eq('user_id', user.id).eq('ativo', true),
    supabase.from('profiles').select('nome,plano').eq('id', user.id).single(),
  ])

  const receitas = transacoes?.filter(t => t.tipo === 'credito').reduce((a, t) => a + t.valor, 0) ?? 0
  const despesas = transacoes?.filter(t => t.tipo === 'debito').reduce((a, t) => a + Math.abs(t.valor), 0) ?? 0
  const saldo    = receitas - despesas

  const porCategoria: Record<string, number> = {}
  transacoes?.filter(t => t.tipo === 'debito').forEach(t => {
    porCategoria[t.categoria] = (porCategoria[t.categoria] || 0) + Math.abs(t.valor)
  })
  const topCat = Object.entries(porCategoria).sort((a, b) => b[1] - a[1])

  const contexto = `
Você é o GranaBot, assistente financeiro pessoal do GranaUp.
Usuário: ${profile?.nome || 'usuário'}
Plano: ${profile?.plano || 'free'}

=== DADOS FINANCEIROS REAIS ===
Total de transações analisadas: ${transacoes?.length || 0}

Receitas totais: R$ ${receitas.toFixed(2)}
Despesas totais: R$ ${despesas.toFixed(2)}
Saldo atual: R$ ${saldo.toFixed(2)}
Taxa de poupança: ${receitas > 0 ? Math.round(((receitas - despesas) / receitas) * 100) : 0}%

Gastos por categoria:
${topCat.map(([cat, val]) => `- ${cat}: R$ ${val.toFixed(2)} (${despesas > 0 ? Math.round((val / despesas) * 100) : 0}% das despesas)`).join('\n') || 'Sem gastos registrados'}

Metas ativas:
${metas?.map(m => `- ${m.nome}: R$ ${m.valor_atual} de R$ ${m.valor_total} (${Math.round((m.valor_atual / m.valor_total) * 100)}%)`).join('\n') || 'Nenhuma meta cadastrada'}

Últimas transações:
${transacoes?.slice(0, 10).map(t => `- ${t.descricao}: ${t.tipo === 'credito' ? '+' : '-'}R$ ${Math.abs(t.valor).toFixed(2)} (${t.categoria})`).join('\n') || 'Nenhuma transação'}

=== INSTRUÇÕES ===
- Responda em português brasileiro, de forma direta e amigável
- Use os dados reais acima para dar conselhos personalizados
- Seja específico: cite valores e categorias reais
- Máximo 3-4 parágrafos por resposta
- Use emojis com moderação
- Encoraje hábitos financeiros saudáveis
`

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ resposta: 'Chave da API não configurada. Adicione ANTHROPIC_API_KEY nas variáveis de ambiente da Vercel.' })
    }

    const messages = [
      ...(historico || []),
      { role: 'user', content: mensagem }
    ]

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1000,
        system: contexto,
        messages,
      }),
    })

    const data = await res.json()

    if (!res.ok || data.error) {
      console.error('[ia] Erro Anthropic:', JSON.stringify(data))
      const msg = data.error?.message || data.error?.type || `HTTP ${res.status}`
      return NextResponse.json({ resposta: `Erro da API: ${msg}` })
    }

    const resposta = data.content?.[0]?.text || 'Resposta vazia.'
    return NextResponse.json({ resposta })

  } catch (err) {
    console.error('[ia] Erro:', err)
    return NextResponse.json({ error: 'Erro ao conectar com a IA' }, { status: 500 })
  }
}