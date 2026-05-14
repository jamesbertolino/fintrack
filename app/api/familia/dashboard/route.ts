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
    .select('membro_id, permissao, profiles!familia_membros_membro_id_fkey(nome, avatar_url)')
    .eq('grupo_id', grupoId)

  const { data: donoPerfil } = await svc
    .from('profiles')
    .select('nome, avatar_url')
    .eq('id', donoId)
    .single()

  // Lista de IDs de todos (dono + membros)
  const participantes: { id: string; nome: string; avatar_url: string | null; papel: string }[] = [
    { id: donoId, nome: donoPerfil?.nome || 'Dono', avatar_url: donoPerfil?.avatar_url ?? null, papel: 'dono' },
    ...((membros || []).map(m => ({
      id:         m.membro_id,
      nome:       (m.profiles as unknown as { nome: string })?.nome || 'Membro',
      avatar_url: (m.profiles as unknown as { avatar_url: string | null })?.avatar_url ?? null,
      papel:      m.permissao,
    }))),
  ]

  // 3. Busca dados financeiros de cada participante
  const mesAtual    = new Date().toISOString().slice(0, 7)
  const inicioMes   = `${mesAtual}-01`
  const inicioMes30 = new Date(Date.now() - 30 * 86400000).toISOString()

  const dadosMembros = await Promise.all(
    participantes.map(async p => {
      const [{ data: txMes }, { data: contas }, { data: metas }] = await Promise.all([
        svc.from('transactions')
          .select('valor, tipo, categoria, data_hora')
          .eq('user_id', p.id)
          .gte('data_hora', inicioMes),
        svc.from('contas')
          .select('nome, mostrar_saldo')
          .eq('user_id', p.id)
          .eq('ativo', true),
        svc.from('goals')
          .select('nome, valor_total, valor_atual')
          .eq('user_id', p.id)
          .eq('ativo', true),
      ])

      const receitas = (txMes || []).filter(t => t.tipo === 'credito').reduce((a, t) => a + t.valor, 0)
      const despesas = (txMes || []).filter(t => t.tipo === 'debito').reduce((a, t) => a + Math.abs(t.valor), 0)

      const porCat: Record<string, number> = {}
      ;(txMes || []).filter(t => t.tipo === 'debito').forEach(t => {
        porCat[t.categoria] = (porCat[t.categoria] || 0) + Math.abs(t.valor)
      })

      // Saldo via transactions (sum of all time)
      const { data: allTx } = await svc.from('transactions').select('valor').eq('user_id', p.id)
      const saldo = (allTx || []).reduce((a, t) => a + t.valor, 0)

      return {
        ...p,
        receitas,
        despesas,
        saldo,
        contas:      contas || [],
        metas:       metas  || [],
        topCats:     Object.entries(porCat).sort((a, b) => b[1] - a[1]).slice(0, 3),
        txCount:     (txMes || []).length,
      }
    })
  )

  // 4. Busca histórico de saldo familiar (últimos 30 dias) pelo dono
  const { data: txHistorico } = await svc
    .from('transactions')
    .select('valor, tipo, data_hora, user_id')
    .in('user_id', participantes.map(p => p.id))
    .gte('data_hora', inicioMes30)
    .order('data_hora')

  // Agrega por dia
  const porDia: Record<string, number> = {}
  ;(txHistorico || []).forEach(t => {
    const dia = t.data_hora.slice(0, 10)
    porDia[dia] = (porDia[dia] || 0) + t.valor
  })
  const historico = Object.entries(porDia).sort(([a], [b]) => a.localeCompare(b))

  return NextResponse.json({
    grupoId,
    membros: dadosMembros,
    historico,
    totalReceitas: dadosMembros.reduce((a, m) => a + m.receitas, 0),
    totalDespesas: dadosMembros.reduce((a, m) => a + m.despesas, 0),
    totalSaldo:    dadosMembros.reduce((a, m) => a + m.saldo, 0),
    mes:           mesAtual,
  })
}
