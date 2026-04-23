import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// GET — buscar notificações do usuário
export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  return NextResponse.json({ notificacoes: data || [] })
}

// PATCH — marcar como lida
export async function PATCH(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id, todas } = await request.json()

  if (todas) {
    await supabase.from('notifications').update({ lida: true }).eq('user_id', user.id).eq('lida', false)
  } else if (id) {
    await supabase.from('notifications').update({ lida: true }).eq('id', id).eq('user_id', user.id)
  }

  return NextResponse.json({ ok: true })
}

// DELETE — apagar notificação
export async function DELETE(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await request.json()
  await supabase.from('notifications').delete().eq('id', id).eq('user_id', user.id)

  return NextResponse.json({ ok: true })
}
