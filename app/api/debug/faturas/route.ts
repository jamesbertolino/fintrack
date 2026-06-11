import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const NUBANK_ID = 'fe825c02-da1a-4dd9-8c20-74ceeb3f814b'

  const inicio13meses = (() => {
    const hoje = new Date()
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - 12, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01T00:00:00`
  })()

  const { data: txsNubank, count: totalNubank } = await supabase
    .from('transactions')
    .select('data_hora, tipo, valor, origem', { count: 'exact' })
    .eq('user_id', user.id)
    .eq('conta_id', NUBANK_ID)
    .order('data_hora', { ascending: false })
    .limit(30)

  const { count: noPeriodo } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('conta_id', NUBANK_ID)
    .gte('data_hora', inicio13meses)
    .neq('origem', 'saldo_inicial')

  const { count: totalUsuario } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .neq('origem', 'saldo_inicial')

  return NextResponse.json({
    inicio_periodo_13meses: inicio13meses,
    total_tx_usuario: totalUsuario,
    total_tx_nubank: totalNubank,
    tx_nubank_no_periodo_13meses: noPeriodo,
    ultimas_30_tx_nubank: (txsNubank || []).map(t => ({
      data_hora: t.data_hora,
      tipo: t.tipo,
      valor: t.valor,
      origem: t.origem,
    })),
  })
}
