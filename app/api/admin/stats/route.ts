import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

function service() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET /api/admin/stats — apenas admins (is_admin = true)
export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const db = service()

  const [
    { count: totalUsuarios },
    { count: totalTransacoes },
    { data: usuariosPorPlano },
    { data: iaUsage30d },
    { data: topUsersIA },
    { data: transacoesPorDia },
    { data: cadastrosPorDia },
    { data: usuariosAtivos },
    { data: referrals },
  ] = await Promise.all([
    // total usuários
    db.from('profiles').select('*', { count: 'exact', head: true }),

    // total transações
    db.from('transactions').select('*', { count: 'exact', head: true }),

    // distribuição por plano
    db.from('profiles').select('plano'),

    // consumo IA últimos 30 dias
    db.from('ia_usage_logs')
      .select('endpoint, provider, total_tokens, created_at')
      .gte('created_at', new Date(Date.now() - 30 * 86400_000).toISOString())
      .order('created_at', { ascending: false }),

    // top 10 usuários por consumo de tokens no mês
    db.from('ia_usage_logs')
      .select('user_id, total_tokens, profiles!inner(nome, plano)')
      .gte('created_at', new Date(new Date().setDate(1)).toISOString())
      .order('total_tokens', { ascending: false })
      .limit(50),

    // transações por dia (últimos 30 dias)
    db.from('transactions')
      .select('data_hora')
      .gte('data_hora', new Date(Date.now() - 30 * 86400_000).toISOString()),

    // cadastros por dia (últimos 30 dias)
    db.from('profiles')
      .select('created_at')
      .gte('created_at', new Date(Date.now() - 30 * 86400_000).toISOString()),

    // usuários com pelo menos 1 transação nos últimos 7 dias (ativos)
    db.from('transactions')
      .select('user_id')
      .gte('data_hora', new Date(Date.now() - 7 * 86400_000).toISOString()),

    // quem indicou quem (referral)
    db.from('profiles')
      .select('referido_por, id, nome')
      .not('referido_por', 'is', null),
  ])

  // Distribuição por plano
  const planoDist: Record<string, number> = {}
  for (const u of usuariosPorPlano || []) {
    const p = u.plano || 'free'
    planoDist[p] = (planoDist[p] || 0) + 1
  }

  // Consumo IA agregado por endpoint e provider
  const iaAgg: Record<string, { total: number; calls: number }> = {}
  let totalTokens30d = 0
  for (const r of iaUsage30d || []) {
    const k = `${r.provider}:${r.endpoint}`
    if (!iaAgg[k]) iaAgg[k] = { total: 0, calls: 0 }
    iaAgg[k].total += r.total_tokens || 0
    iaAgg[k].calls++
    totalTokens30d += r.total_tokens || 0
  }

  // Consumo IA por dia (últimos 30d)
  const iaTokensPorDia: Record<string, number> = {}
  for (const r of iaUsage30d || []) {
    const d = r.created_at.slice(0, 10)
    iaTokensPorDia[d] = (iaTokensPorDia[d] || 0) + (r.total_tokens || 0)
  }

  // Top usuários IA no mês (agrupado)
  const topUsersAgg: Record<string, { user_id: string; nome: string; plano: string; total: number }> = {}
  for (const r of topUsersIA || []) {
    if (!topUsersAgg[r.user_id]) {
      const prof = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
      topUsersAgg[r.user_id] = { user_id: r.user_id, nome: prof?.nome || r.user_id.slice(0, 8), plano: prof?.plano || 'free', total: 0 }
    }
    topUsersAgg[r.user_id].total += r.total_tokens || 0
  }
  const topUsersLista = Object.values(topUsersAgg).sort((a, b) => b.total - a.total).slice(0, 10)

  // Transações por dia
  const txPorDia: Record<string, number> = {}
  for (const t of transacoesPorDia || []) {
    const d = t.data_hora.slice(0, 10)
    txPorDia[d] = (txPorDia[d] || 0) + 1
  }

  // Cadastros por dia
  const cadPorDia: Record<string, number> = {}
  for (const p of cadastrosPorDia || []) {
    const d = p.created_at.slice(0, 10)
    cadPorDia[d] = (cadPorDia[d] || 0) + 1
  }

  // Usuários únicos ativos nos últimos 7 dias
  const ativosSet = new Set((usuariosAtivos || []).map(r => r.user_id))

  // Referral: top indicadores
  const referralPorIndicador: Record<string, number> = {}
  for (const r of referrals || []) {
    const ind = r.referido_por as string
    referralPorIndicador[ind] = (referralPorIndicador[ind] || 0) + 1
  }

  // Busca nomes dos top indicadores
  const topIndicadoresIds = Object.entries(referralPorIndicador)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id]) => id)

  const { data: indicadoresProfiles } = await db
    .from('profiles')
    .select('id, nome, plano')
    .in('id', topIndicadoresIds.length > 0 ? topIndicadoresIds : ['00000000-0000-0000-0000-000000000000'])

  const topIndicadores = topIndicadoresIds.map(id => {
    const p = (indicadoresProfiles || []).find(x => x.id === id)
    return { user_id: id, nome: p?.nome || id.slice(0, 8), plano: p?.plano || 'free', total: referralPorIndicador[id] }
  })

  return NextResponse.json({
    resumo: {
      total_usuarios:   totalUsuarios || 0,
      total_transacoes: totalTransacoes || 0,
      ativos_7d:        ativosSet.size,
      tokens_30d:       totalTokens30d,
      calls_ia_30d:     iaUsage30d?.length || 0,
    },
    planos:         planoDist,
    ia_por_endpoint: iaAgg,
    ia_tokens_por_dia: iaTokensPorDia,
    top_users_ia:   topUsersLista,
    tx_por_dia:     txPorDia,
    cad_por_dia:    cadPorDia,
    referral: {
      total_indicacoes: referrals?.length ?? 0,
      top_indicadores:  topIndicadores,
    },
  })
}
