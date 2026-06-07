import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { CATALOGO_DESAFIOS, getDesafio, type Desafio } from '@/lib/desafios'
import { logAudit } from '@/lib/auditLog'

function getSvc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// ─── GET /api/desafios ───────────────────────────────────────────────────────
// Retorna: catalogo, ativos (com progresso calculado), historico
export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  // Participações do usuário
  const { data: participacoes } = await supabase
    .from('desafios_usuario')
    .select('*')
    .eq('user_id', user.id)
    .order('iniciado_em', { ascending: false })

  const ativos    = (participacoes || []).filter(p => p.status === 'ativo')
  const historico = (participacoes || []).filter(p => p.status !== 'ativo')

  // IDs de desafios nos quais o usuário está ativo (para filtrar catálogo)
  const idsAtivos = new Set(ativos.map(p => p.desafio_id))

  if (ativos.length === 0) {
    return NextResponse.json({
      catalogo: CATALOGO_DESAFIOS,
      ativos: [],
      historico: historico.map(p => ({
        ...p,
        desafio: getDesafio(p.desafio_id),
      })),
    })
  }

  // Calcula progresso de cada desafio ativo
  const inicio = ativos.reduce((min, p) => p.iniciado_em < min ? p.iniciado_em : min, ativos[0].iniciado_em)

  const { data: transacoes } = await supabase
    .from('transactions')
    .select('tipo, valor, categoria, data_hora')
    .eq('user_id', user.id)
    .gte('data_hora', inicio)

  const txs = transacoes || []

  // Para desafios de família, busca aportes em metas compartilhadas do grupo
  const temFamilia = ativos.some(p => getDesafio(p.desafio_id)?.tipo === 'familia_poupanca')
  const familiaAportesMap: Record<string, number> = {} // iniciado_em → total aportado no período
  if (temFamilia) {
    const svc = getSvc()
    const { data: grupoDono } = await svc.from('familia_grupos').select('id').eq('dono_id', user.id).single()
    let grupoId = grupoDono?.id ?? null
    if (!grupoId) {
      const { data: memb } = await svc.from('familia_membros').select('grupo_id').eq('membro_id', user.id).single()
      grupoId = memb?.grupo_id ?? null
    }
    if (grupoId) {
      const { data: comps } = await svc.from('meta_compartilhamentos').select('meta_id').eq('grupo_id', grupoId)
      const metaIds = (comps || []).map(c => c.meta_id)
      if (metaIds.length) {
        const { data: aportes } = await svc.from('meta_aportes').select('valor, data, meta_id').in('meta_id', metaIds)
        for (const p of ativos.filter(p => getDesafio(p.desafio_id)?.tipo === 'familia_poupanca')) {
          familiaAportesMap[p.iniciado_em] = (aportes || [])
            .filter(a => a.data >= p.iniciado_em.slice(0, 10) && a.data <= p.termina_em.slice(0, 10))
            .reduce((s, a) => s + a.valor, 0)
        }
      }
    }
  }

  const ativosComProgresso = ativos.map(p => {
    const desafio = getDesafio(p.desafio_id)
    if (!desafio) return { ...p, desafio: null, progresso: 0, pct: 0 }

    const txPeriodo = txs.filter(t => t.data_hora >= p.iniciado_em && t.data_hora <= p.termina_em)
    const familiaTotal = desafio.tipo === 'familia_poupanca' ? (familiaAportesMap[p.iniciado_em] ?? 0) : undefined
    const { progresso, pct, status } = calcularProgresso(desafio, txPeriodo, p.iniciado_em, p.termina_em, familiaTotal)

    return { ...p, desafio, progresso, pct, status_calculado: status }
  })

  // Verifica se algum ativo venceu/falhou (para atualizar no banco)
  for (const a of ativosComProgresso) {
    if (!a.desafio) continue
    const terminou = new Date() >= new Date(a.termina_em)
    if (terminou || a.status_calculado === 'falhou') {
      const novoStatus = a.status_calculado === 'falhou' ? 'falhou'
        : a.pct >= 100 ? 'concluido' : 'falhou'
      if (novoStatus === 'concluido' || novoStatus === 'falhou') {
        await supabase.from('desafios_usuario').update({ status: novoStatus }).eq('id', a.id)
        // erro ignorado — falha de status não bloqueia a resposta do dashboard
        if (novoStatus === 'concluido') {
          logAudit({ user_id: user.id, action: 'desafio.concluido', resource_id: a.id, metadata: { desafio_id: a.desafio_id, xp: a.desafio?.xp } })
        }
      }
    }
  }

  return NextResponse.json({
    catalogo: CATALOGO_DESAFIOS.filter(d => !idsAtivos.has(d.id)),
    ativos: ativosComProgresso,
    historico: historico.map(p => ({ ...p, desafio: getDesafio(p.desafio_id) })),
  })
}

// ─── POST /api/desafios ──────────────────────────────────────────────────────
// Body: { desafio_id }
// Aceita um desafio do catálogo
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { desafio_id } = await request.json()
  const desafio = getDesafio(desafio_id)
  if (!desafio) return NextResponse.json({ error: 'Desafio não encontrado' }, { status: 404 })

  // Verifica se já está ativo
  const { data: existente } = await supabase
    .from('desafios_usuario')
    .select('id')
    .eq('user_id', user.id)
    .eq('desafio_id', desafio_id)
    .eq('status', 'ativo')
    .maybeSingle()

  if (existente) return NextResponse.json({ error: 'Desafio já está ativo' }, { status: 409 })

  const iniciado_em = new Date().toISOString()
  const termina_em  = new Date(Date.now() + desafio.duracao_dias * 86400_000).toISOString()

  const { data, error } = await supabase
    .from('desafios_usuario')
    .insert({ user_id: user.id, desafio_id, iniciado_em, termina_em, status: 'ativo' })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  logAudit({ user_id: user.id, action: 'desafio.aceito', resource_id: data.id, metadata: { desafio_id } })

  return NextResponse.json({ ok: true, id: data.id })
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type Tx = { tipo: string; valor: number; categoria: string; data_hora: string }

function calcularProgresso(
  desafio: Desafio,
  txs: Tx[],
  iniciado_em: string,
  termina_em: string,
  familiaTotal?: number,
): { progresso: number; pct: number; status: 'ativo' | 'concluido' | 'falhou' } {
  const terminou = new Date() >= new Date(termina_em)

  if (desafio.tipo === 'limite_categoria') {
    const gasto = txs
      .filter(t => t.tipo === 'debito' && t.categoria === desafio.categoria)
      .reduce((s, t) => s + Math.abs(t.valor), 0)
    const pct = Math.min(100, (gasto / desafio.valor_meta) * 100)
    const status = gasto > desafio.valor_meta ? 'falhou'
      : terminou ? 'concluido' : 'ativo'
    return { progresso: gasto, pct, status }
  }

  if (desafio.tipo === 'sem_categoria') {
    const gastou = txs.some(t => t.tipo === 'debito' && t.categoria === desafio.categoria)
    const status = gastou ? 'falhou' : terminou ? 'concluido' : 'ativo'
    return { progresso: gastou ? 1 : 0, pct: gastou ? 100 : 0, status }
  }

  if (desafio.tipo === 'economia') {
    const receitas  = txs.filter(t => t.tipo === 'credito').reduce((s, t) => s + t.valor, 0)
    const despesas  = txs.filter(t => t.tipo === 'debito').reduce((s, t) => s + Math.abs(t.valor), 0)
    const economizado = Math.max(0, receitas - despesas)
    const pct = Math.min(100, (economizado / desafio.valor_meta) * 100)
    const status = terminou ? (economizado >= desafio.valor_meta ? 'concluido' : 'falhou') : 'ativo'
    return { progresso: economizado, pct, status }
  }

  if (desafio.tipo === 'habito') {
    const inicio = new Date(iniciado_em)
    const dias = new Set<string>()
    txs.forEach(t => dias.add(t.data_hora.slice(0, 10)))
    // Só conta dias dentro do período do desafio
    const diasValidos = [...dias].filter(d => {
      const dt = new Date(d)
      return dt >= inicio && dt <= new Date(termina_em)
    })
    const pct = Math.min(100, (diasValidos.length / desafio.valor_meta) * 100)
    const status = terminou ? (diasValidos.length >= desafio.valor_meta ? 'concluido' : 'falhou') : 'ativo'
    return { progresso: diasValidos.length, pct, status }
  }

  if (desafio.tipo === 'familia_poupanca') {
    const total = familiaTotal ?? 0
    const pct   = Math.min(100, (total / desafio.valor_meta) * 100)
    const terminou = new Date() >= new Date(termina_em)
    const status = terminou ? (total >= desafio.valor_meta ? 'concluido' : 'falhou') : 'ativo'
    return { progresso: total, pct, status }
  }

  return { progresso: 0, pct: 0, status: 'ativo' }
}
