import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// GET /api/orcamento/ia?mes=YYYY-MM
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

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
    const m = t.data_hora.slice(0, 7)
    if (!porMes[m]) porMes[m] = {}
    porMes[m][t.categoria] = (porMes[m][t.categoria] || 0) + Math.abs(t.valor)
  }
  const meses = Object.keys(porMes)
  const mediaCategoria: Record<string, number> = {}
  for (const cat of new Set((transacoes || []).map(t => t.categoria))) {
    const total = meses.reduce((a, m) => a + (porMes[m][cat] || 0), 0)
    mediaCategoria[cat] = total / Math.max(meses.length, 1)
  }

  const prioridades = Array.isArray(profile?.prioridades) ? profile.prioridades : []

  const prompt = `
Você é um consultor financeiro pessoal analisando o orçamento de ${profile?.nome || 'um usuário'}.

=== HISTÓRICO (média mensal últimos 3 meses) ===
${Object.entries(mediaCategoria).map(([cat, val]) => `- ${cat}: R$ ${val.toFixed(2)}`).join('\n') || 'Sem histórico ainda'}

=== ORÇAMENTO ATUAL (${mes}) ===
${(orcamentos || []).map(o => `- ${o.categoria}: R$ ${o.valor_planejado}`).join('\n') || 'Nenhum orçamento definido'}

=== PRIORIDADES DO USUÁRIO ===
${prioridades.map((p: { ordem: number; titulo: string }) => `${p.ordem}. ${p.titulo}`).join('\n') || 'Não definidas'}

Analise os gastos e sugira ajustes de orçamento para ajudar o usuário a atingir suas prioridades mais rápido.
Responda SOMENTE com JSON no formato:
{
  "analise": "Análise concisa em 2-3 linhas sobre o padrão de gastos",
  "sugestoes": [
    { "categoria": "Nome", "valor_sugerido": 0, "motivo": "Motivo curto" }
  ]
}
Inclua apenas categorias que precisam de ajuste. Máximo 5 sugestões.`

  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (anthropicKey) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 800, messages: [{ role: 'user', content: prompt }] }),
      })
      const data = await res.json()
      if (res.ok && data.content?.[0]?.text) {
        try {
          const json = JSON.parse(data.content[0].text.replace(/```json\n?|\n?```/g, '').trim())
          return NextResponse.json({ ok: true, ...json })
        } catch { /* parse error, fall through */ }
      }
    } catch { /* network error, fall through */ }
  }

  return NextResponse.json({
    ok: true,
    analise: 'Configure ANTHROPIC_API_KEY para ativar análises automáticas.',
    sugestoes: [],
  })
}
