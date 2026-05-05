import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

function extrairJSON(text: string): { analise: string; sugestoes: unknown[] } | null {
  const candidatos = [
    text.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1],
    text.match(/(\{[\s\S]*\})/)?.[1],
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

async function chamarAnthropic(prompt: string, key: string) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`)
  return data.content?.[0]?.text as string | undefined
}

async function chamarOpenAI(prompt: string, key: string) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`)
  return data.choices?.[0]?.message?.content as string | undefined
}

// GET /api/orcamento/ia?mes=YYYY-MM
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const anthropicKey = process.env.ANTHROPIC_API_KEY
  const openaiKey    = process.env.OPENAI_API_KEY
  if (!anthropicKey && !openaiKey) {
    return NextResponse.json({ ok: false, analise: 'Nenhuma API de IA configurada (ANTHROPIC_API_KEY ou OPENAI_API_KEY).', sugestoes: [] })
  }

  const mes = request.nextUrl.searchParams.get('mes') || new Date().toISOString().slice(0, 7)
  const [ano, mm] = mes.split('-').map(Number)

  const tresAtras = mm <= 3
    ? `${ano - 1}-${String(mm + 9).padStart(2, '0')}`
    : `${ano}-${String(mm - 3).padStart(2, '0')}`

  const [{ data: profile }, { data: transacoes }, { data: orcamentos }] = await Promise.all([
    supabase.from('profiles').select('nome, prioridades').eq('id', user.id).single(),
    supabase.from('transactions').select('categoria, valor, data_hora')
      .eq('user_id', user.id).eq('tipo', 'debito')
      .gte('data_hora', new Date(`${tresAtras}-01`).toISOString())
      .lt('data_hora', new Date(ano, mm, 1).toISOString()),
    supabase.from('orcamentos').select('categoria, valor_planejado').eq('user_id', user.id).eq('mes', mes),
  ])

  const porMes: Record<string, Record<string, number>> = {}
  for (const t of transacoes || []) {
    const mk = t.data_hora.slice(0, 7)
    if (!porMes[mk]) porMes[mk] = {}
    porMes[mk][t.categoria] = (porMes[mk][t.categoria] || 0) + Math.abs(t.valor)
  }
  const mesesComDados = Object.keys(porMes)
  const mediaCategoria: Record<string, number> = {}
  for (const cat of new Set((transacoes || []).map(t => t.categoria))) {
    const total = mesesComDados.reduce((a, mk) => a + (porMes[mk][cat] || 0), 0)
    mediaCategoria[cat] = total / Math.max(mesesComDados.length, 1)
  }

  const prioridades = Array.isArray(profile?.prioridades) ? profile.prioridades : []

  const prompt = `Você é um consultor financeiro pessoal analisando o orçamento de ${profile?.nome || 'um usuário'}.

HISTÓRICO (média mensal últimos 3 meses):
${Object.entries(mediaCategoria).map(([c, v]) => `- ${c}: R$ ${v.toFixed(2)}`).join('\n') || 'Sem histórico'}

ORÇAMENTO ATUAL (${mes}):
${(orcamentos || []).map(o => `- ${o.categoria}: R$ ${o.valor_planejado}`).join('\n') || 'Nenhum definido'}

PRIORIDADES DO USUÁRIO:
${prioridades.map((p: { ordem: number; titulo: string }) => `${p.ordem}. ${p.titulo}`).join('\n') || 'Não definidas'}

Sugira ajustes de orçamento para atingir as prioridades mais rápido. Responda APENAS com JSON válido:
{"analise":"2-3 linhas sobre o padrão de gastos","sugestoes":[{"categoria":"Nome","valor_sugerido":0,"motivo":"Motivo curto"}]}`

  let texto: string | undefined
  let erroMsg = ''

  if (anthropicKey) {
    try { texto = await chamarAnthropic(prompt, anthropicKey) }
    catch (e) { erroMsg = e instanceof Error ? e.message : String(e) }
  }

  if (!texto && openaiKey) {
    try { texto = await chamarOpenAI(prompt, openaiKey) }
    catch (e) { erroMsg = e instanceof Error ? e.message : String(e) }
  }

  if (!texto) {
    return NextResponse.json({ ok: false, analise: `Erro ao contactar IA: ${erroMsg}`, sugestoes: [] })
  }

  const parsed = extrairJSON(texto)
  if (!parsed) {
    return NextResponse.json({ ok: true, analise: texto.slice(0, 600), sugestoes: [] })
  }

  return NextResponse.json({ ok: true, ...parsed })
}
