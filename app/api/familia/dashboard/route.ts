import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

function getSvcClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/**
 * Retorna o dashboard consolidado da família do usuário logado.
 * O usuário pode ser dono ou membro de um grupo.
 */
export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const svc = getSvcClient()

  // 1. Descobre grupo: pode ser dono ou membro
  let grupoId: string | null = null
  let donoId: string | null  = null

  const { data: grupoDono } = await svc
    .from('familia_grupos')
    .select('id, dono_id')
    .eq('dono_id', user.id)
    .single()

  if (grupoDono) {
    grupoId = grupoDono.id
    donoId  = grupoDono.dono_id
  } else {
    const { data: membroRec } = await svc
      .from('familia_membros')
      .select('grupo_id, familia_grupos!familia_membros_grupo_id_fkey(dono_id)')
      .eq('membro_id', user.id)
      .single()
    if (membroRec) {
      grupoId = membroRec.grupo_id
      donoId  = (membroRec.familia_grupos as unknown as { dono_id: string })?.dono_id ?? null
    }
  }

  if (!grupoId || !donoId) {
    return NextResponse.json({ error: 'Você não pertence a nenhuma família' }, { status: 404 })
  }

  // 2. Busca todos os membros + dono
  const { data: membros } = await svc
    .from('familia_membros')
    .select('id, membro_id, permissao, incluir_consolidado, profiles!familia_membros_membro_id_fkey(nome, avatar_url)')
    .eq('grupo_id', grupoId)

  const { data: donoPerfil } = await svc
    .from('profiles')
    .select('nome, avatar_url')
    .eq('id', donoId)
    .single()

  // Lista de todos (dono + membros) com flag incluir_consolidado
  const participantes: { id: string; nome: string; avatar_url: string | null; papel: string; membro_id_row?: string; incluir_consolidado: boolean }[] = [
    { id: donoId, nome: donoPerfil?.nome || 'Dono', avatar_url: donoPerfil?.avatar_url ?? null, papel: 'dono', incluir_consolidado: true },
    ...((membros || []).map(m => ({
      id:                  m.membro_id,
      nome:                (m.profiles as unknown as { nome: string })?.nome || 'Membro',
      avatar_url:          (m.profiles as unknown as { avatar_url: string | null })?.avatar_url ?? null,
      papel:               m.permissao,
      membro_id_row:       m.id,
      incluir_consolidado: m.incluir_consolidado !== false,
    }))),
  ]

  // 3. Busca dados financeiros de cada participante
  const mesAtual    = new Date().toISOString().slice(0, 7)
  const inicioMes   = `${mesAtual}-01`
  const inicioMes30 = new Date(Date.now() - 30 * 86400000).toISOString()

  const dadosMembros = await Promise.all(
    participantes.map(async p => {
      const [{ data: contas }, { data: metas }] = await Promise.all([
        svc.from('contas')
          .select('id, nome, saldo, mostrar_saldo')
          .eq('user_id', p.id)
          .eq('ativo', true),
        svc.from('goals')
          .select('nome, valor_total, valor_atual')
          .eq('user_id', p.id)
          .eq('ativo', true),
      ])

      // Só contas visíveis (mostrar_saldo=true)
      const contasVisiveis = (contas || []).filter(c => c.mostrar_saldo !== false)
      const contaIds = contasVisiveis.map(c => c.id)
      const saldo    = contasVisiveis.reduce((a, c) => a + (c.saldo || 0), 0)

      // Transações do mês filtradas pelas contas visíveis
      let txMes: { valor: number; tipo: string; categoria: string; data_hora: string; origem?: string | null }[] = []
      if (contaIds.length) {
        const { data } = await svc.from('transactions')
          .select('valor, tipo, categoria, data_hora, origem')
          .eq('user_id', p.id)
          .in('conta_id', contaIds)
          .gte('data_hora', inicioMes)
          .neq('origem', 'saldo_inicial')
        txMes = data || []
      }

      const receitas = txMes.filter(t => t.tipo === 'credito' && t.origem !== 'saldo_inicial').reduce((a, t) => a + t.valor, 0)
      const despesas = txMes.filter(t => t.tipo === 'debito'  && t.origem !== 'saldo_inicial').reduce((a, t) => a + Math.abs(t.valor), 0)
      const porCat: Record<string, number> = {}
      txMes.filter(t => t.tipo === 'debito' && t.origem !== 'saldo_inicial').forEach(t => {
        porCat[t.categoria] = (porCat[t.categoria] || 0) + Math.abs(t.valor)
      })

      return {
        ...p,
        receitas,
        despesas,
        saldo,
        contas:   contasVisiveis.map(c => ({ nome: c.nome, mostrar_saldo: c.mostrar_saldo })),
        metas:    metas || [],
        topCats:  Object.entries(porCat).sort((a, b) => b[1] - a[1]).slice(0, 3),
        txCount:  txMes.length,
      }
    })
  )

  // Membros incluídos no consolidado
  const noConsolidado = dadosMembros.filter(m => m.incluir_consolidado)

  // 4. Histórico de saldo familiar (últimos 30 dias) — só membros consolidados
  const { data: txHistorico } = await svc
    .from('transactions')
    .select('valor, tipo, data_hora, user_id')
    .in('user_id', noConsolidado.map(p => p.id))
    .gte('data_hora', inicioMes30)
    .order('data_hora')

  const porDia: Record<string, number> = {}
  ;(txHistorico || []).forEach(t => {
    const dia = t.data_hora.slice(0, 10)
    porDia[dia] = (porDia[dia] || 0) + t.valor
  })
  const historico = Object.entries(porDia).sort(([a], [b]) => a.localeCompare(b))

  // Participação % de cada membro no consolidado
  const totalSaldo    = noConsolidado.reduce((a, m) => a + m.saldo, 0)
  const totalReceitas = noConsolidado.reduce((a, m) => a + m.receitas, 0)
  const totalDespesas = noConsolidado.reduce((a, m) => a + m.despesas, 0)

  const membrosComParticipacao = dadosMembros.map(m => ({
    ...m,
    pct_saldo:    totalSaldo    > 0 ? Math.round((m.saldo    / totalSaldo)    * 100) : 0,
    pct_receitas: totalReceitas > 0 ? Math.round((m.receitas / totalReceitas) * 100) : 0,
    pct_despesas: totalDespesas > 0 ? Math.round((m.despesas / totalDespesas) * 100) : 0,
  }))

  return NextResponse.json({
    grupoId,
    membros:       membrosComParticipacao,
    historico,
    totalReceitas,
    totalDespesas,
    totalSaldo,
    mes:           mesAtual,
  })
}
