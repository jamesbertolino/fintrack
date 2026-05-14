import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

function getSvc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function findGrupoId(userId: string) {
  const svc = getSvc()
  const { data: d } = await svc.from('familia_grupos').select('id').eq('dono_id', userId).single()
  if (d) return d.id
  const { data: m } = await svc.from('familia_membros').select('grupo_id').eq('membro_id', userId).single()
  return m?.grupo_id ?? null
}

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const grupoId = await findGrupoId(user.id)
  if (!grupoId) return NextResponse.json({ origens: [] })

  const svc = getSvc()

  const [{ data: origens }, { data: movimentos }] = await Promise.all([
    svc.from('grupo_origens').select('*, contas(nome, bancos(nome_curto,cor))').eq('grupo_id', grupoId).eq('ativo', true).order('created_at'),
    svc.from('grupo_movimentos').select('origem_id, tipo, valor').eq('grupo_id', grupoId),
  ])

  // Calcular saldo atual de cada origem
  const saldoMap: Record<string, number> = {}
  for (const mv of movimentos || []) {
    if (!saldoMap[mv.origem_id]) saldoMap[mv.origem_id] = 0
    saldoMap[mv.origem_id] += mv.tipo === 'entrada' ? mv.valor : -mv.valor
  }

  const result = (origens || []).map(o => ({
    ...o,
    saldo_atual: (o.saldo_inicial || 0) + (saldoMap[o.id] || 0),
  }))

  return NextResponse.json({ origens: result, grupoId })
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const grupoId = await findGrupoId(user.id)
  if (!grupoId) return NextResponse.json({ error: 'Sem grupo familiar' }, { status: 400 })

  const { nome, tipo, conta_id, saldo_inicial } = await request.json()
  if (!nome?.trim()) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })

  const { data, error } = await getSvc().from('grupo_origens').insert({
    grupo_id: grupoId, criado_por: user.id,
    nome: nome.trim(), tipo: tipo || 'conta_bancaria',
    conta_id: conta_id || null,
    saldo_inicial: saldo_inicial || 0,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ origem: { ...data, saldo_atual: data.saldo_inicial } })
}
