import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const body = await request.json()

  const campos: Record<string, unknown> = {}
  if ('conta_id'   in body) campos.conta_id   = body.conta_id
  if ('descricao'  in body) campos.descricao  = body.descricao
  if ('categoria'  in body) campos.categoria  = body.categoria
  if ('data_hora'  in body) campos.data_hora  = body.data_hora

  if (!Object.keys(campos).length)
    return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })

  const { error } = await supabase
    .from('transactions')
    .update(campos)
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}