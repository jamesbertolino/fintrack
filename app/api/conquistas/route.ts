import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { rateLimit } from '@/lib/rateLimit'
import { CONQUISTAS } from '@/lib/conquistas'
import { verificarConquistas } from '@/lib/verificarConquistas'

// GET — apenas lista conquistas já desbloqueadas, sem verificar condições
export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  // 30 req / 60 s — listagem leve, sem verificação de condições
  const rl = await rateLimit({ key: `conquistas:${user.id}`, limit: 30, windowSec: 60 })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Muitas requisições' }, { status: 429 })
  }

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
    nova: false,
  }))

  return NextResponse.json({
    conquistas: lista,
    novas_desbloqueadas: [],
    total: CONQUISTAS.length,
    desbloqueadas: desbloqueadasMap.size,
  })
}

// POST — trigger de verificação real (chamado após eventos: lançamento, meta, etc.)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  // 5 req / 60 s — verificação é pesada (5+ queries)
  const rl = await rateLimit({ key: `conquistas-check:${user.id}`, limit: 5, windowSec: 60 })
  if (!rl.allowed) {
    return NextResponse.json({ novas: [], count: 0, rate_limited: true })
  }

  const novas = await verificarConquistas(supabase, user.id)

  // Retorna lista completa atualizada junto com as novas
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
    novas,
    count: novas.length,
    conquistas: lista,
    total: CONQUISTAS.length,
    desbloqueadas: desbloqueadasMap.size,
  })
}
