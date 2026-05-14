import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// GET /api/orcamento/check?categoria=X&mes=YYYY-MM
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const categoria = request.nextUrl.searchParams.get('categoria') || ''
  const mes       = request.nextUrl.searchParams.get('mes') || new Date().toISOString().slice(0, 7)
  if (!categoria) return NextResponse.json({ limite: null })

  const [ano, mm] = mes.split('-').map(Number)
  const inicio = new Date(ano, mm - 1, 1).toISOString()
  const fim    = new Date(ano, mm, 1).toISOString()

  const [{ data: orc }, { data: txs }] = await Promise.all([
    supabase.from('orcamentos').select('valor_planejado').eq('user_id', user.id).eq('categoria', categoria).eq('mes', mes).maybeSingle(),
    supabase.from('transactions').select('valor').eq('user_id', user.id).eq('tipo', 'debito').eq('categoria', categoria).gte('data_hora', inicio).lt('data_hora', fim),
  ])

  if (!orc) return NextResponse.json({ limite: null })

  const gasto      = (txs || []).reduce((s, t) => s + Math.abs(t.valor), 0)
  const limite     = orc.valor_planejado
  const percentual = limite > 0 ? gasto / limite : 0
  const excedido   = gasto >= limite

  return NextResponse.json({ limite, gasto, percentual, excedido })
}
