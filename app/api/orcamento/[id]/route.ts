import { NextRequest, NextResponse } from 'next/server'
import { dbErr } from '@/lib/dbError'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const { valor_planejado } = await request.json()

  const { error } = await supabase.from('orcamentos')
    .update({ valor_planejado })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: dbErr(error, 'atualizar orçamento') }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const { error } = await supabase.from('orcamentos')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: dbErr(error, 'atualizar orçamento') }, { status: 500 })
  return NextResponse.json({ ok: true })
}
