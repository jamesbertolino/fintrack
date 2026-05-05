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
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1200, messages: [{ role: 'user', content: prompt }] }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`)
  return data.content?.[0]?.text as string | undefined
}

async function chamarOpenAI(prompt: string, key: string) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: 1200, messages: [{ role: 'user', content: prompt }] }),
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

  // Últimos 3 meses para calcular média
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

  // Médias mensais por categoria
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

  const totalMedioMensal = Object.values(mediaCategoria).reduce((a, v) => a + v, 0)

  // Prioridades ordenadas do perfil
  interface Prioridade {
    ordem: number
    titulo: string
    valor_alvo?: number
    valor_atual?: number
    contribuicao_mensal?: number
    prazo_meses?: number
  }
  const prioridades: Prioridade[] = Array.isArray(profile?.prioridades)
    ? [...profile.prioridades].sort((a, b) => a.ordem - b.ordem)
    : []

  // Calcula quanto seria necessário poupar mensalmente para cada prioridade
  const metasMensais = prioridades.map(p => {
    const falta = (p.valor_alvo || 0) - (p.valor_atual || 0)
    const prazo = p.prazo_meses || 12
    const necessario = falta > 0 ? Math.ceil(falta / prazo) : 0
    return { titulo: p.titulo, ordem: p.ordem, necessario, contribuicao_mensal: p.contribuicao_mensal || 0 }
  }).filter(p => p.necessario > 0 || p.contribuicao_mensal > 0)

  const totalNecessario = metasMensais.reduce((a, p) => a + Math.max(p.necessario, p.contribuicao_mensal), 0)

  const prompt = `Você é um consultor financeiro pessoal. Analise os gastos de ${profile?.nome || 'este usuário'} e sugira um orçamento otimizado para ${mes} que respeite as prioridades do usuário.

GASTO MÉDIO MENSAL POR CATEGORIA (últimos 3 meses):
${Object.entries(mediaCategoria).map(([c, v]) => `- ${c}: R$ ${v.toFixed(2)}`).join('\n') || '- Sem histórico suficiente'}

TOTAL MÉDIO MENSAL DE GASTOS: R$ ${totalMedioMensal.toFixed(2)}

ORÇAMENTO ATUAL DEFINIDO PARA ${mes}:
${(orcamentos || []).map(o => `- ${o.categoria}: R$ ${o.valor_planejado}`).join('\n') || '- Nenhum definido'}

PRIORIDADES DO USUÁRIO (em ordem de importância):
${prioridades.length > 0
  ? prioridades.map(p => {
      const falta = (p.valor_alvo || 0) - (p.valor_atual || 0)
      return `${p.ordem}. ${p.titulo}${p.valor_alvo ? ` — meta: R$ ${p.valor_alvo}, falta: R$ ${falta.toFixed(2)}, prazo: ${p.prazo_meses || 12} meses` : ''}`
    }).join('\n')
  : '- Não definidas'}

${metasMensais.length > 0 ? `ECONOMIA MENSAL NECESSÁRIA PARA ATINGIR AS METAS: R$ ${totalNecessario.toFixed(2)}` : ''}

INSTRUÇÕES:
- Sugira ajustes nas categorias de gasto para liberar economia suficiente para as prioridades acima
- Prioridade 1 é a mais importante: garanta que a economia necessária para ela seja preservada primeiro
- Indique quais categorias reduzir e por quanto, justificando com base nas prioridades
- Não sugira cortes irreais (máximo 40% de redução por categoria)
- Se não houver prioridades definidas, sugira um orçamento equilibrado baseado no histórico
- Responda APENAS com JSON válido no formato:
{"analise":"2-3 frases sobre o padrão de gastos e quanto precisa economizar para as prioridades","sugestoes":[{"categoria":"Nome","valor_sugerido":0,"motivo":"Como este ajuste ajuda a prioridade X"}]}`

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
