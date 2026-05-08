import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') || '/dashboard'

  if (code) {
    const supabase = await createServerSupabaseClient()
    await supabase.auth.exchangeCodeForSession(code)

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      // Garante perfil mínimo para primeiro login OAuth
      const { data: profile } = await supabase
        .from('profiles')
        .select('lgpd_aceito_em')
        .eq('id', user.id)
        .maybeSingle()

      if (!profile) {
        const nome = (user.user_metadata?.full_name as string)?.split(' ')[0] || user.email?.split('@')[0] || 'Usuário'
        const sobrenome = (user.user_metadata?.full_name as string)?.split(' ').slice(1).join(' ') || ''
        await supabase.from('profiles').upsert({ id: user.id, nome, sobrenome, plano: 'free' })
      }

      // Exige aceite LGPD se não aceitou ainda (fluxo OAuth)
      if (!profile?.lgpd_aceito_em) {
        return NextResponse.redirect(new URL(`/aceite-lgpd?next=${encodeURIComponent(next)}`, request.url))
      }
    }
  }

  return NextResponse.redirect(new URL(next, request.url))
}
