import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { logAudit } from '@/lib/auditLog'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

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
  if ('valor'      in body) campos.valor      = body.valor
  if ('tipo'       in body) campos.tipo       = body.tipo

  if (!Object.keys(campos).length)
    return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })

  const { data: updated, error } = await supabase
    .from('transactions')
    .update(campos)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!updated?.length) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  logAudit({ user_id: user.id, action: 'transaction.update', resource_id: id, metadata: campos })

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params

  // Confirma que o lançamento pertence ao usuário
  const { data: tx } = await supabase
    .from('transactions')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!tx) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  // Usa service role para remover FK em whatsapp_logs antes de deletar
  const service = getServiceClient()
  const { error: errFk } = await service.from('whatsapp_logs').update({ transacao_id: null }).eq('transacao_id', id)
  if (errFk) return NextResponse.json({ error: `Erro ao desvincular logs: ${errFk.message}` }, { status: 500 })

  const { error } = await service.from('transactions').delete().eq('id', id).eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  logAudit({ user_id: user.id, action: 'transaction.delete', resource_id: id })

  return NextResponse.json({ ok: true })
}