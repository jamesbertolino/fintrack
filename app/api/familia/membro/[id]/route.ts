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

// DELETE /api/familia/membro/[id]
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = makeSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params

  // Verifica que o membro pertence ao grupo do usuário logado (dono)
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
