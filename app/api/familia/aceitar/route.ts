import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'login_required' }, { status: 401 })

  const { token } = await req.json()
  if (!token) return NextResponse.json({ error: 'Token obrigatório' }, { status: 400 })

  const { data: convite } = await supabase
    .from('familia_convites')
    .select('id, grupo_id, permissao, aceito, expires_at')
    .eq('token', token)
    .single()

  if (!convite)                                    return NextResponse.json({ error: 'Convite não encontrado' }, { status: 404 })
  if (convite.aceito)                              return NextResponse.json({ error: 'Convite já utilizado' }, { status: 409 })
  if (new Date(convite.expires_at) < new Date())  return NextResponse.json({ error: 'Convite expirado' }, { status: 410 })

  const { data: grupo } = await supabase.from('familia_grupos').select('dono_id').eq('id', convite.grupo_id).single()
  if (grupo?.dono_id === user.id) return NextResponse.json({ error: 'Você é o dono deste grupo' }, { status: 400 })

  const { error: memErr } = await supabase
    .from('familia_membros')
    .upsert({ grupo_id: convite.grupo_id, membro_id: user.id, permissao: convite.permissao }, { onConflict: 'grupo_id,membro_id' })

  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 500 })

  const { error: convErr } = await supabase.from('familia_convites').update({ aceito: true }).eq('id', convite.id)
  if (convErr) return NextResponse.json({ error: convErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, permissao: convite.permissao })
}
