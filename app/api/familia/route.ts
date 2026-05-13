import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

function makeSupabase() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (list) => list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  )
}

// GET /api/familia — retorna grupo + membros + convites pendentes
export async function GET() {
  const supabase = makeSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  // Busca grupo onde o usuário é dono
  const { data: grupo } = await supabase
    .from('familia_grupos')
    .select('id, dono_id, created_at')
    .eq('dono_id', user.id)
    .single()

  if (!grupo) return NextResponse.json({ grupo: null, membros: [], convites: [] })

  const [{ data: membros }, { data: convites }] = await Promise.all([
    supabase
      .from('familia_membros')
      .select('id, permissao, created_at, membro_id, profiles!familia_membros_membro_id_fkey(nome, avatar_url, email:id)')
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

// POST /api/familia — cria o grupo (se não existir)
export async function POST() {
  const supabase = makeSupabase()
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
