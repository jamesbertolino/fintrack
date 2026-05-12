import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { enviarEmailBoasVindas } from '@/lib/email'

export async function POST(_request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('nome, boas_vindas_enviado')
    .eq('id', user.id)
    .maybeSingle()

  // Idempotente — só envia uma vez
  if (profile?.boas_vindas_enviado) return NextResponse.json({ ok: true, skipped: true })

  const nome = profile?.nome || user.user_metadata?.nome || user.email?.split('@')[0] || 'usuário'
  if (user.email) {
    await enviarEmailBoasVindas(user.email, nome)
    await supabase.from('profiles').update({ boas_vindas_enviado: true }).eq('id', user.id)
  }

  return NextResponse.json({ ok: true })
}
