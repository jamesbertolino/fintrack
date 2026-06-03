import { NextRequest, NextResponse } from 'next/server'
import { dbErr } from '@/lib/dbError'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

function getSvc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function findGrupoId(userId: string) {
  const svc = getSvc()
  const { data: dono } = await svc.from('familia_grupos').select('id').eq('dono_id', userId).single()
  if (dono) return dono.id
  const { data: membro } = await svc.from('familia_membros').select('grupo_id').eq('membro_id', userId).single()
  return membro?.grupo_id ?? null
}

// POST — compartilhar meta com grupo familiar
export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const { data: meta } = await supabase.from('goals').select('id').eq('id', id).eq('user_id', user.id).single()
  if (!meta) return NextResponse.json({ error: 'Meta não encontrada' }, { status: 404 })

  const grupoId = await findGrupoId(user.id)
  if (!grupoId) return NextResponse.json({ error: 'Você não pertence a nenhuma família' }, { status: 400 })

  const { error } = await getSvc().from('meta_compartilhamentos').upsert({ meta_id: id, grupo_id: grupoId, criado_por: user.id }, { onConflict: 'meta_id,grupo_id' })
  if (error) return NextResponse.json({ error: dbErr(error, 'compartilhar meta') }, { status: 500 })
  return NextResponse.json({ ok: true, grupo_id: grupoId })
}

// DELETE — remover compartilhamento
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const { error } = await getSvc().from('meta_compartilhamentos').delete().eq('meta_id', id).eq('criado_por', user.id)
  if (error) return NextResponse.json({ error: dbErr(error, 'compartilhar meta') }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// GET — verificar se a meta está compartilhada
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const { data } = await getSvc().from('meta_compartilhamentos').select('id, grupo_id').eq('meta_id', id).eq('criado_por', user.id).maybeSingle()
  return NextResponse.json({ compartilhada: !!data, grupo_id: data?.grupo_id ?? null })
}
