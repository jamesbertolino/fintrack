import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// GET /api/orcamento?mes=YYYY-MM
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const mes = request.nextUrl.searchParams.get('mes') || new Date().toISOString().slice(0, 7)
  const [ano, mm] = mes.split('-').map(Number)
  const inicio = new Date(ano, mm - 1, 1).toISOString()
  const fim    = new Date(ano, mm, 1).toISOString()

  const [{ data: orcamentos }, { data: transacoes }] = await Promise.all([
    supabase.from('orcamentos').select('*').eq('user_id', user.id).eq('mes', mes).order('categoria'),
    supabase.from('transactions')
      .select('categoria, valor')
      .eq('user_id', user.id)
      .eq('tipo', 'debito')
      .gte('data_hora', inicio)
      .lt('data_hora', fim),
  ])

  // Agrega gastos reais por categoria
  const realizado: Record<string, number> = {}
  for (const t of transacoes || []) {
    realizado[t.categoria] = (realizado[t.categoria] || 0) + Math.abs(t.valor)
  }

  return NextResponse.json({ orcamentos: orcamentos || [], realizado })
}

// POST /api/orcamento — upsert
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()
  const { categoria, valor_planejado, mes } = body
  if (!categoria || valor_planejado == null || !mes)
    return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })

  const { data, error } = await supabase.from('orcamentos').upsert(
    { user_id: user.id, categoria, valor_planejado, mes },
    { onConflict: 'user_id,categoria,mes' }
  ).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, orcamento: data })
}
