import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

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

export async function PATCH(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id, todas } = await request.json()
  let xpGanho = 0

  if (todas) {
    // Soma XP de todas não lidas antes de marcar
    const { data: naoLidas } = await supabase
      .from('notifications')
      .select('xp_recompensa')
      .eq('user_id', user.id)
      .eq('lida', false)

    xpGanho = (naoLidas || []).reduce((a, n) => a + (n.xp_recompensa || 0), 0)
    const { error: e1 } = await supabase.from('notifications').update({ lida: true }).eq('user_id', user.id).eq('lida', false)
    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })
  } else if (id) {
    const { data: notif } = await supabase
      .from('notifications')
      .select('xp_recompensa, lida')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (notif && !notif.lida) {
      xpGanho = notif.xp_recompensa || 0
      const { error: e2 } = await supabase.from('notifications').update({ lida: true }).eq('id', id).eq('user_id', user.id)
      if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
    }
  }

  // Credita XP bonus no perfil
  if (xpGanho > 0) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('xp_bonus')
      .eq('id', user.id)
      .single()

    const { error: e3 } = await supabase.from('profiles')
      .update({ xp_bonus: (profile?.xp_bonus || 0) + xpGanho })
      .eq('id', user.id)
    if (e3) return NextResponse.json({ error: e3.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, xpGanho })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await request.json()
  const { error } = await supabase.from('notifications').delete().eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
