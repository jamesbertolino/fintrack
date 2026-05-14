import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { chave, categoria } = await request.json()
  if (!chave || !categoria) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

  const { error } = await supabase.from('categoria_aprendida').upsert(
    { user_id: user.id, chave, categoria, vezes: 1, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,chave' }
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
