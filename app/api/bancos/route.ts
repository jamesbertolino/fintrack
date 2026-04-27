import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data } = await supabase
    .from('bancos')
    .select('id, codigo, nome, nome_curto, cor, logo_url')
    .eq('ativo', true)
    .order('nome_curto')

  return NextResponse.json({ bancos: data || [] })
}
