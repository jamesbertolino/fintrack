import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

function extrairJSON(text: string): { analise: string; sugestoes: unknown[] } | null {
  // Tenta extrair JSON de dentro de blocos de código ou texto puro
  const candidatos = [
    // Bloco ```json ... ```
    text.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1],
    // Objeto JSON direto
    text.match(/(\{[\s\S]*\})/)?.[1],
    // O texto inteiro
    text.trim(),
  ]
  for (const raw of candidatos) {
    if (!raw) continue
    try {
      const parsed = JSON.parse(raw.trim())
      if (typeof parsed.analise === 'string') return parsed
    } catch { /* continua */ }
  }
  return null
}

// GET /api/orcamento/ia?mes=YYYY-MM
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicKey) {
    return NextResponse.json({
      ok: false,
      analise: 'ANTHROPIC_API_KEY não configurada nas variáveis de ambiente.',
      sugestoes: [],
    })
  }

  const mes = request.nextUrl.searchParams.get('mes') || new Date().toISOString().slice(0, 7)
  const [ano, mm] = mes.split('-').map(Number)

  // Últimos 3 meses de transações por categoria
  const tresAtras = mm <= 3
    ? `${ano - 1}-${String(mm + 9).padStart(2, '0')}`
    : `${ano}-${String(mm - 3).padStart(2, '0')}`
  const inicioHistorico = new Date(`${tresAtras}-01`).toISOString()
  const fimMesAtual     = new Date(ano, mm, 1).toISOString()

  const [{ data: profile }, { data: transacoes }, { data: orcamentos }] = await Promise.all([
    supabase.from('profiles').select('nome, prioridades, data_nascimento, genero').eq('id', user.id).single(),
    supabase.from('transactions').select('categoria, valor, data_hora, tipo')
      .eq('user_id', user.id).eq('tipo', 'debito')
      .gte('data_hora', inicioHistorico).lt('data_hora', fimMesAtual),
    supabase.from('orcamentos').select('categoria, valor_planejado').eq('user_id', user.id).eq('mes', mes),
  ])

  // Média mensal por categoria nos últimos 3 meses
  const porMes: Record<string, Record<string, number>> = {}
  for (const t of transacoes || []) {
    const mesKey = t.data_hora.slice(0, 7)
    if (!porMes[mesKey]) porMes[mesKey] = {}
    porMes[mesKey][t.categoria] = (porMes[mesKey][t.categoria] || 0) + Math.abs(t.valor)
  }
  const mesesComDados = Object.keys(porMes)
  const mediaCategoria: Record<string, number> = {}
  for (const cat of new Set((transacoes || []).map(t => t.categoria))) {
    const total = mesesComDados.reduce((a, mk) => a + (porMes[mk][cat] || 0), 0)
    mediaCategoria[cat] = total / Math.max(mesesComDados.length, 1)
  }

  const prioridades = Array.isArray(profile?.prioridades) ? profile.prioridades : []

  const prompt = `Você é um consultor financeiro pessoal analisando o orçamento de ${profile?.nome || 'um usuário'}.

=== HISTÓRICO (média mensal últimos 3 meses) ===
${Object.entries(mediaCategoria).map(([cat, val]) => `- ${cat}: R$ ${val.toFixed(2)}`).join('\n') || 'Sem histórico ainda'}

=== ORÇAMENTO ATUAL (${mes}) ===
${(orcamentos || []).map(o => `- ${o.categoria}: R$ ${o.valor_planejado}`).join('\n') || 'Nenhum orçamento definido'}

=== PRIORIDADES DO USUÁRIO ===
${prioridades.map((p: { ordem: number; titulo: string }) => `${p.ordem}. ${p.titulo}`).join('\n') || 'Não definidas'}

Analise os gastos e sugira ajustes de orçamento para ajudar o usuário a atingir suas prioridades mais rápido.
Responda SOMENTE com JSON válido no formato abaixo, sem texto adicional:
{"analise":"Análise concisa em 2-3 linhas","sugestoes":[{"categoria":"Nome","valor_sugerido":0,"motivo":"Motivo curto"}]}`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const apiData = await res.json()

    if (!res.ok) {
      const msg = apiData?.error?.message || `Erro HTTP ${res.status}`
      return NextResponse.json({ ok: false, analise: `Erro da API: ${msg}`, sugestoes: [] })
    }

    const text: string = apiData.content?.[0]?.text || ''
    if (!text) {
      return NextResponse.json({ ok: false, analise: 'Resposta vazia da IA.', sugestoes: [] })
    }

    const parsed = extrairJSON(text)
    if (!parsed) {
      // Retorna o texto bruto como análise se não conseguiu parsear
      return NextResponse.json({ ok: true, analise: text.slice(0, 500), sugestoes: [] })
    }

    return NextResponse.json({ ok: true, ...parsed })

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro de conexão'
    return NextResponse.json({ ok: false, analise: `Erro ao contactar IA: ${msg}`, sugestoes: [] })
  }
}
