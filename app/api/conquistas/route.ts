import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { CONQUISTAS } from '@/lib/conquistas'
import { verificarConquistas } from '@/lib/verificarConquistas'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  // Verifica e desbloqueia automaticamente
  const novas = await verificarConquistas(supabase, user.id)

  const { data: desbloqueadas } = await supabase
    .from('conquistas_usuario')
    .select('conquista_id, desbloqueada_em')
    .eq('user_id', user.id)
    .order('desbloqueada_em', { ascending: false })

  const desbloqueadasMap = new Map(
    (desbloqueadas || []).map((r: { conquista_id: string; desbloqueada_em: string }) => [r.conquista_id, r.desbloqueada_em])
  )

  const lista = CONQUISTAS.map(c => ({
    ...c,
    desbloqueada: desbloqueadasMap.has(c.id),
    desbloqueada_em: desbloqueadasMap.get(c.id) || null,
    nova: novas.some(n => n.id === c.id),
  }))

  return NextResponse.json({
    conquistas: lista,
    novas_desbloqueadas: novas,
    total: CONQUISTAS.length,
    desbloqueadas: desbloqueadasMap.size,
  })
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_request: NextRequest) {
  // Trigger manual de verificação (chamado após eventos)
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const novas = await verificarConquistas(supabase, user.id)
  return NextResponse.json({ novas, count: novas.length })
}
