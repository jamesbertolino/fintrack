import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

function makeSupabase() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (list) => list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  )
}

// POST /api/familia/aceitar — aceita convite pelo token
export async function POST(req: NextRequest) {
  const supabase = makeSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'login_required' }, { status: 401 })

  const { token } = await req.json()
  if (!token) return NextResponse.json({ error: 'Token obrigatório' }, { status: 400 })

  // Busca convite válido
  const { data: convite } = await supabase
    .from('familia_convites')
    .select('id, grupo_id, permissao, aceito, expires_at')
    .eq('token', token)
    .single()

  if (!convite)               return NextResponse.json({ error: 'Convite não encontrado' }, { status: 404 })
  if (convite.aceito)         return NextResponse.json({ error: 'Convite já utilizado' }, { status: 409 })
  if (new Date(convite.expires_at) < new Date()) return NextResponse.json({ error: 'Convite expirado' }, { status: 410 })

  // Verifica se não é o próprio dono
  const { data: grupo } = await supabase.from('familia_grupos').select('dono_id').eq('id', convite.grupo_id).single()
  if (grupo?.dono_id === user.id) return NextResponse.json({ error: 'Você é o dono deste grupo' }, { status: 400 })

  // Adiciona como membro
  const { error: memErr } = await supabase
    .from('familia_membros')
    .upsert({ grupo_id: convite.grupo_id, membro_id: user.id, permissao: convite.permissao }, { onConflict: 'grupo_id,membro_id' })

  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 500 })

  // Marca convite como aceito
  await supabase.from('familia_convites').update({ aceito: true }).eq('id', convite.id)

  return NextResponse.json({ ok: true, permissao: convite.permissao })
}
