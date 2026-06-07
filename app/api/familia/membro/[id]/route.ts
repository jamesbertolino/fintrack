import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params

  const { data: membro } = await supabase
    .from('familia_membros')
    .select('id, grupo_id')
    .eq('id', id)
    .single()

  if (!membro) return NextResponse.json({ error: 'Membro não encontrado' }, { status: 404 })

  const { data: grupo } = await supabase
    .from('familia_grupos')
    .select('dono_id')
    .eq('id', membro.grupo_id)
    .single()

  if (grupo?.dono_id !== user.id) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  await supabase.from('familia_membros').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const { data: membro } = await supabase
    .from('familia_membros').select('id, grupo_id').eq('id', id).single()
  if (!membro) return NextResponse.json({ error: 'Membro não encontrado' }, { status: 404 })

  const { data: grupo } = await supabase
    .from('familia_grupos').select('dono_id').eq('id', membro.grupo_id).single()
  if (grupo?.dono_id !== user.id) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const campos: Record<string, unknown> = {}
  if (typeof body.incluir_consolidado === 'boolean') campos.incluir_consolidado = body.incluir_consolidado
  if (typeof body.permissao === 'string') campos.permissao = body.permissao

  const { error } = await supabase.from('familia_membros').update(campos).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
