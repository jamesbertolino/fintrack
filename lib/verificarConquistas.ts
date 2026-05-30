import { SupabaseClient } from '@supabase/supabase-js'
import { CONQUISTAS, Conquista } from './conquistas'
import { notificarConquista } from './pushEventos'

export interface ConquistaDesbloqueada {
  conquista: Conquista
  nova: boolean
}

/**
 * Verifica e desbloqueia conquistas para um usuário.
 * Retorna apenas as que foram desbloqueadas nesta chamada (novas).
 */
export async function verificarConquistas(
  supabase: SupabaseClient,
  user_id: string,
): Promise<Conquista[]> {
  // Busca conquistas já desbloqueadas
  const { data: jaDesbloqueadas } = await supabase
    .from('conquistas_usuario')
    .select('conquista_id')
    .eq('user_id', user_id)

  const jaIds = new Set((jaDesbloqueadas || []).map((r: { conquista_id: string }) => r.conquista_id))

  // Dados necessários para avaliar condições
  const [
    { count: totalTx },
    { data: profile },
    { data: metas },
    { data: txMes },
    { data: orcamentos },
  ] = await Promise.all([
    supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('user_id', user_id),
    supabase.from('profiles').select('nome,data_nascimento,genero,prioridades,nivel,xp').eq('id', user_id).single(),
    supabase.from('goals').select('id,valor_atual,valor_total,ativo').eq('user_id', user_id),
    supabase.from('transactions')
      .select('tipo,valor,categoria,data_hora')
      .eq('user_id', user_id)
      .gte('data_hora', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    supabase.from('orcamentos').select('id,categoria,valor_limite').eq('user_id', user_id),
  ])

  const receitas = (txMes || []).filter((t: { tipo: string }) => t.tipo === 'credito').reduce((a: number, t: { valor: number }) => a + t.valor, 0)
  const despesas = (txMes || []).filter((t: { tipo: string }) => t.tipo === 'debito').reduce((a: number, t: { valor: number }) => a + Math.abs(t.valor), 0)
  const saldoMes = receitas - despesas

  const metasAtivas = (metas || []).filter((m: { ativo: boolean }) => m.ativo)
  const metasConcluidas = (metas || []).filter((m: { valor_atual: number; valor_total: number }) => m.valor_atual >= m.valor_total)
  const totalPoupado = metasAtivas.reduce((a: number, m: { valor_atual: number }) => a + m.valor_atual, 0)
  const totalInvestido = (txMes || [])
    .filter((t: { categoria: string; tipo: string }) => t.categoria?.toLowerCase().includes('invest') && t.tipo === 'credito')
    .reduce((a: number, t: { valor: number }) => a + t.valor, 0)

  const profileCompleto = !!(
    profile?.nome &&
    profile?.data_nascimento &&
    profile?.genero &&
    Array.isArray(profile?.prioridades) && profile.prioridades.length > 0
  )

  // Verifica streak de dias consecutivos
  const { data: txDias } = await supabase
    .from('transactions')
    .select('data_hora')
    .eq('user_id', user_id)
    .order('data_hora', { ascending: false })
    .limit(200)

  const diasUnicos = new Set(
    (txDias || []).map((t: { data_hora: string }) => t.data_hora.slice(0, 10))
  )
  let streak = 0
  const hoje = new Date()
  for (let i = 0; i < 60; i++) {
    const d = new Date(hoje)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    if (diasUnicos.has(key)) streak++
    else break
  }

  // Verifica se tem upload feito
  const { count: uploadCount } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user_id)
    .eq('origem', 'upload')

  // Verifica orçamento (sem estouro no mês)
  const semEstouro = (orcamentos || []).length > 0 && (orcamentos || []).every((orc: { categoria: string; valor_limite: number }) => {
    const gasto = (txMes || [])
      .filter((t: { categoria: string; tipo: string }) => t.categoria === orc.categoria && t.tipo === 'debito')
      .reduce((a: number, t: { valor: number }) => a + Math.abs(t.valor), 0)
    return gasto <= orc.valor_limite
  })

  // Mapa de condições por conquista_id
  const condicoes: Record<string, boolean> = {
    welcome:        true, // sempre verdade para quem tem conta
    first_tx:       (totalTx || 0) >= 1,
    profile_complete: profileCompleto,
    streak_7:       streak >= 7,
    streak_30:      streak >= 30,
    tx_50:          (totalTx || 0) >= 50,
    tx_100:         (totalTx || 0) >= 100,
    leveled:        (profile?.nivel || 1) > 1,
    positive_bal:   saldoMes > 0,
    budget_week:    semEstouro,
    perfect_month:  semEstouro && (orcamentos || []).length > 0,
    no_debt:        despesas === 0 && receitas > 0,
    first_goal:     (metas || []).length >= 1,
    goal_done:      metasConcluidas.length >= 1,
    multi_goals:    metasAtivas.length >= 3,
    big_saver:      totalPoupado >= 1000,
    investor:       totalInvestido >= 5000,
    group_invite:   false, // verificado em evento de convite
    upload_1:       (uploadCount || 0) >= 1,
    dedicated:      diasUnicos.size >= 10,
  }

  // Determina quais desbloquear agora
  const novas: Conquista[] = []
  const paraInserir: { user_id: string; conquista_id: string }[] = []

  for (const conquista of CONQUISTAS) {
    if (jaIds.has(conquista.id)) continue
    if (condicoes[conquista.id]) {
      novas.push(conquista)
      paraInserir.push({ user_id, conquista_id: conquista.id })
    }
  }

  if (paraInserir.length > 0) {
    const { error: errInsert } = await supabase.from('conquistas_usuario').insert(paraInserir)
    if (errInsert) return []

    // Soma XP das novas conquistas
    const xpGanho = novas.reduce((a, c) => a + c.xp, 0)
    if (xpGanho > 0) {
      const xpAtual = profile?.xp || 0
      const novoXP = xpAtual + xpGanho
      const novoNivel = Math.floor(novoXP / 500) + 1
      await supabase
        .from('profiles')
        .update({ xp: novoXP, nivel: novoNivel })
        .eq('id', user_id)
    }

    // Push para cada conquista desbloqueada (não-bloqueante)
    for (const conquista of novas) {
      notificarConquista(user_id, conquista)
    }
  }

  return novas
}

/** Desbloqueia uma conquista específica (para eventos pontuais como convite de grupo). */
export async function desbloquearConquista(
  supabase: SupabaseClient,
  user_id: string,
  conquista_id: string,
): Promise<boolean> {
  const { error } = await supabase
    .from('conquistas_usuario')
    .insert({ user_id, conquista_id })

  if (error) return false // já desbloqueada ou erro

  const conquista = CONQUISTAS.find(c => c.id === conquista_id)
  if (conquista && conquista.xp > 0) {
    const { data: profile } = await supabase.from('profiles').select('xp').eq('id', user_id).single()
    const novoXP = (profile?.xp || 0) + conquista.xp
    const novoNivel = Math.floor(novoXP / 500) + 1
    await supabase.from('profiles').update({ xp: novoXP, nivel: novoNivel }).eq('id', user_id)
  }

  return true
}
