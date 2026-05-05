import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const MAX_POR_DIA = 2

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

function extrairNotificacoes(text: string): Notif[] | null {
  const candidatos = [
    text.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1],
    text.match(/(\[[\s\S]*\])/)?.[1],
    text.match(/(\{[\s\S]*\})/)?.[1],
  ]
  for (const raw of candidatos) {
    if (!raw) continue
    try {
      const parsed = JSON.parse(raw.trim())
      if (Array.isArray(parsed) && parsed[0]?.titulo) return parsed
      if (parsed.notificacoes) return parsed.notificacoes
    } catch { /* continua */ }
  }
  return null
}

interface Notif {
  titulo: string
  mensagem: string
  tipo: string
  xp_recompensa: number
}

// POST /api/notificacoes/ia — gera notificações via IA (máx 2x por dia)
export async function POST() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const anthropicKey = process.env.ANTHROPIC_API_KEY
  const openaiKey    = process.env.OPENAI_API_KEY
  if (!anthropicKey && !openaiKey)
    return NextResponse.json({ ok: false, error: 'Nenhuma API de IA configurada.' })

  // Verifica limite diário
  const hoje = new Date().toISOString().slice(0, 10)
  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('tipo', 'ia_diaria')
    .gte('created_at', `${hoje}T00:00:00Z`)

  if ((count || 0) >= MAX_POR_DIA)
    return NextResponse.json({ ok: false, limite: true, error: 'Limite de análises diárias atingido.' })

  // Coleta dados do usuário
  const mesAtual = new Date().toISOString().slice(0, 7)
  const inicioMes = `${mesAtual}-01T00:00:00Z`

  const [
    { data: profile },
    { data: transacoesMes },
    { data: transacoesRecentes },
    { data: orcamentos },
    { data: metas },
  ] = await Promise.all([
    supabase.from('profiles').select('nome, prioridades, xp_bonus').eq('id', user.id).single(),
    supabase.from('transactions').select('categoria, valor, tipo, descricao, data_hora')
      .eq('user_id', user.id).gte('data_hora', inicioMes).order('data_hora', { ascending: false }),
    supabase.from('transactions').select('categoria, valor, tipo, descricao, data_hora')
      .eq('user_id', user.id).order('data_hora', { ascending: false }).limit(20),
    supabase.from('orcamentos').select('categoria, valor_planejado').eq('user_id', user.id).eq('mes', mesAtual),
    supabase.from('metas').select('titulo, valor_total, valor_atual, ativo').eq('user_id', user.id).eq('ativo', true),
  ])

  // Resumo financeiro do mês
  const receitas  = (transacoesMes || []).filter(t => t.tipo === 'credito').reduce((a, t) => a + t.valor, 0)
  const despesas  = (transacoesMes || []).filter(t => t.tipo === 'debito').reduce((a, t) => a + Math.abs(t.valor), 0)
  const saldo     = receitas - despesas

  const gastosPorCat: Record<string, number> = {}
  for (const t of transacoesMes || []) {
    if (t.tipo === 'debito') gastosPorCat[t.categoria] = (gastosPorCat[t.categoria] || 0) + Math.abs(t.valor)
  }

  const catExcedidas = (orcamentos || []).filter(o => (gastosPorCat[o.categoria] || 0) > o.valor_planejado)
  const catProximas  = (orcamentos || []).filter(o => {
    const gasto = gastosPorCat[o.categoria] || 0
    const pct = o.valor_planejado > 0 ? gasto / o.valor_planejado : 0
    return pct >= 0.8 && pct < 1
  })

  interface Prioridade { ordem: number; titulo: string; valor_alvo?: number; valor_atual?: number }
  const prioridades: Prioridade[] = Array.isArray(profile?.prioridades)
    ? [...profile.prioridades].sort((a, b) => a.ordem - b.ordem).slice(0, 3)
    : []

  const hoje2 = new Date()
  const diasNoMes = new Date(hoje2.getFullYear(), hoje2.getMonth() + 1, 0).getDate()
  const diaAtual  = hoje2.getDate()
  const diasRestantes = diasNoMes - diaAtual
  const ritmoGasto = despesas / diaAtual
  const projecaoFim = ritmoGasto * diasNoMes

  const prompt = `Você é um assistente financeiro pessoal empático e motivador. Analise a situação financeira de ${profile?.nome || 'este usuário'} e crie notificações úteis e encorajadoras.

DATA ATUAL: ${hoje2.toLocaleDateString('pt-BR')} (dia ${diaAtual}/${diasNoMes}, faltam ${diasRestantes} dias)

RESUMO DO MÊS (${mesAtual}):
- Receitas: R$ ${receitas.toFixed(2)}
- Despesas: R$ ${despesas.toFixed(2)}
- Saldo: R$ ${saldo.toFixed(2)}
- Projeção de gastos até fim do mês: R$ ${projecaoFim.toFixed(2)}

GASTOS POR CATEGORIA:
${Object.entries(gastosPorCat).map(([c, v]) => `- ${c}: R$ ${v.toFixed(2)}`).join('\n') || '- Sem gastos registrados'}

ORÇAMENTOS:
${(orcamentos || []).map(o => `- ${o.categoria}: planejado R$ ${o.valor_planejado}, gasto R$ ${(gastosPorCat[o.categoria] || 0).toFixed(2)}`).join('\n') || '- Nenhum orçamento definido'}

${catExcedidas.length > 0 ? `CATEGORIAS EXCEDIDAS: ${catExcedidas.map(c => c.categoria).join(', ')}` : ''}
${catProximas.length > 0 ? `CATEGORIAS PRÓXIMAS DO LIMITE (≥80%): ${catProximas.map(c => c.categoria).join(', ')}` : ''}

METAS ATIVAS:
${(metas || []).map(m => `- ${m.titulo}: R$ ${m.valor_atual}/${m.valor_total} (${Math.round((m.valor_atual / m.valor_total) * 100)}%)`).join('\n') || '- Nenhuma meta ativa'}

PRIORIDADES DO USUÁRIO:
${prioridades.map(p => `${p.ordem}. ${p.titulo}${p.valor_alvo ? ` (meta: R$ ${p.valor_alvo})` : ''}`).join('\n') || '- Não definidas'}

ÚLTIMAS TRANSAÇÕES:
${(transacoesRecentes || []).slice(0, 5).map(t => `- ${t.tipo === 'debito' ? '↓' : '↑'} R$ ${Math.abs(t.valor).toFixed(2)} em ${t.categoria} (${t.descricao || ''})`).join('\n')}

INSTRUÇÕES:
- Crie entre 2 e 3 notificações úteis, motivadoras e personalizadas
- Use tom positivo e encorajador, mesmo ao alertar sobre excessos
- Misture alertas, dicas e motivações — não crie só alertas negativos
- Cada notificação deve ter uma ação ou insight concreto
- Atribua xp_recompensa entre 10 e 50 XP por notificação (maior para ações mais importantes)
- Tipos disponíveis: alerta_gasto, dica_economia, progresso_meta, motivacao, planejamento

Responda APENAS com JSON:
[
  {"titulo":"Título curto","mensagem":"Mensagem motivadora e com ação concreta (máx 2 frases)","tipo":"tipo_aqui","xp_recompensa":25},
  ...
]`

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

  if (!texto)
    return NextResponse.json({ ok: false, error: `Erro ao contactar IA: ${erroMsg}` })

  const notifs = extrairNotificacoes(texto)
  if (!notifs?.length)
    return NextResponse.json({ ok: false, error: 'IA não retornou notificações válidas.' })

  const registros = notifs.slice(0, 3).map(n => ({
    user_id: user.id,
    tipo: 'ia_diaria',
    titulo: String(n.titulo || '').slice(0, 100),
    mensagem: String(n.mensagem || '').slice(0, 500),
    xp_recompensa: Math.min(50, Math.max(0, Number(n.xp_recompensa) || 20)),
    lida: false,
  }))

  const { error } = await supabase.from('notifications').insert(registros)
  if (error) return NextResponse.json({ ok: false, error: error.message })

  return NextResponse.json({ ok: true, criadas: registros.length })
}
