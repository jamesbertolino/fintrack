import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: grupo } = await supabase
    .from('familia_grupos')
    .select('id, dono_id, created_at')
    .eq('dono_id', user.id)
    .single()

  if (!grupo) return NextResponse.json({ grupo: null, membros: [], convites: [] })

  const [{ data: membros }, { data: convites }] = await Promise.all([
    supabase
      .from('familia_membros')
      .select('id, permissao, created_at, membro_id, profiles!familia_membros_membro_id_fkey(nome, avatar_url)')
      .eq('grupo_id', grupo.id),
    supabase
      .from('familia_convites')
      .select('id, email, permissao, aceito, expires_at, created_at')
      .eq('grupo_id', grupo.id)
      .eq('aceito', false)
      .gt('expires_at', new Date().toISOString()),
  ])

  return NextResponse.json({ grupo, membros: membros || [], convites: convites || [] })
}

export async function POST() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data, error } = await supabase
    .from('familia_grupos')
    .upsert({ dono_id: user.id }, { onConflict: 'dono_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, grupo: data })
}
