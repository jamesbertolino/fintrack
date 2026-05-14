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

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const grupoId = await findGrupoId(user.id)
  if (!grupoId) return NextResponse.json({ movimentos: [], saldo: 0 })

  const svc = getSvc()
  const { searchParams } = new URL(request.url)
  const origem_id = searchParams.get('origem_id')
  const limit = parseInt(searchParams.get('limit') || '100')

  let q = svc
    .from('grupo_movimentos')
    .select('*, grupo_origens(nome,tipo), profiles(nome,avatar_url)')
    .eq('grupo_id', grupoId)
    .order('data', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (origem_id) q = q.eq('origem_id', origem_id)

  const { data: movimentos, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // running balance (cronológico invertido, calculamos do mais antigo para o mais novo)
  const sorted = [...(movimentos || [])].reverse()
  let running = 0
  const comSaldo = sorted.map(mv => {
    running += mv.tipo === 'entrada' ? mv.valor : -mv.valor
    return { ...mv, saldo_acumulado: running }
  }).reverse()

  const saldo = running
  return NextResponse.json({ movimentos: comSaldo, saldo, grupoId })
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const grupoId = await findGrupoId(user.id)
  if (!grupoId) return NextResponse.json({ error: 'Sem grupo familiar' }, { status: 400 })

  const { origem_id, tipo, valor, descricao, categoria, data, meta_id, divida_id } = await request.json()
  if (!origem_id || !tipo || !valor || valor <= 0) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  if (!descricao?.trim()) return NextResponse.json({ error: 'Descrição obrigatória' }, { status: 400 })

  // verify origin belongs to group
  const { data: origem } = await getSvc().from('grupo_origens').select('id').eq('id', origem_id).eq('grupo_id', grupoId).single()
  if (!origem) return NextResponse.json({ error: 'Origem não pertence ao grupo' }, { status: 403 })

  const { data: mv, error } = await getSvc().from('grupo_movimentos').insert({
    grupo_id: grupoId, origem_id, user_id: user.id,
    tipo, valor, descricao: descricao.trim(), categoria: categoria || 'Outros',
    data: data || new Date().toISOString().slice(0, 10),
    meta_id: meta_id || null,
    divida_id: divida_id || null,
  }).select('*, grupo_origens(nome,tipo), profiles(nome,avatar_url)').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ movimento: mv })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await request.json()
  await getSvc().from('grupo_movimentos').delete().eq('id', id).eq('user_id', user.id)
  return NextResponse.json({ ok: true })
}
