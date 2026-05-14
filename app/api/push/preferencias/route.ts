import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data } = await supabase
    .from('push_preferencias')
    .select('resumo_semanal, aviso_meta, alerta_orcamento')
    .eq('user_id', user.id)
    .single()

  return NextResponse.json({
    resumo_semanal:   data?.resumo_semanal   ?? true,
    aviso_meta:       data?.aviso_meta       ?? true,
    alerta_orcamento: data?.alerta_orcamento ?? true,
  })
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { resumo_semanal, aviso_meta, alerta_orcamento } = await request.json()

  const { error } = await supabase.from('push_preferencias').upsert({
    user_id: user.id,
    resumo_semanal:   resumo_semanal   ?? true,
    aviso_meta:       aviso_meta       ?? true,
    alerta_orcamento: alerta_orcamento ?? true,
    updated_at:       new Date().toISOString(),
  }, { onConflict: 'user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
