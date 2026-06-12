import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const NUBANK_ATIVO = 'fe825c02-da1a-4dd9-8c20-74ceeb3f814b'

  // Transações de maio/junho 2026 do usuário, independente de conta
  const { data: maio2026 } = await supabase
    .from('transactions')
    .select('id, conta_id, data_hora, tipo, valor, descricao, ref_externa, origem')
    .eq('user_id', user.id)
    .gte('data_hora', '2026-04-01T00:00:00')
    .lte('data_hora', '2026-06-30T23:59:59')
    .order('data_hora', { ascending: false })

  // FITIDs do OFX enviado pelo usuário
  const fitidsOfx = [
    '6a160f8d-e92c-49ee-9c55-ad10704449ae',
    '6a103a2b-dc00-445c-96c2-ca49e091c933',
    '6a0d8445-0685-4c00-949a-0d1d4dc03aab',
    '6a07b8f2-2d69-4a07-bea0-ed9aab090ec3',
    '6a01b6e1-b754-4183-9f44-aaf5a32bf6a4',
    '69fdefca-0658-40ed-962c-b35bb2d3abd7',
    '69f8b6dc-f6fb-4380-848c-321b8f497040',
    '69f732d8-606e-49b9-93e7-fad618c1ccab',
    '69ceb6c0-2666-4a33-86a9-25909108afb6',
    '698f6dab-2f78-4bdb-96a4-69438dee4123',
    '68fd8c8b-8596-47bd-a992-1b000599f0d8',
    '69e147ff-c980-4387-9f79-ff65f0209482',
    '6856db91-0f10-420a-90e1-5a93a3ccbe28',
    '0ff01a8d-3b0a-33e8-81f0-9bf8f8a171cd',
  ]

  // Busca por ref_externa contendo os FITIDs
  const { data: porFitid } = await supabase
    .from('transactions')
    .select('id, conta_id, data_hora, valor, descricao, ref_externa')
    .eq('user_id', user.id)
    .or(fitidsOfx.map(f => `ref_externa.ilike.%${f}%`).join(','))

  // Agrupa transações de abr-jun 2026 por conta_id
  const porConta: Record<string, { count: number; datas: string[] }> = {}
  for (const tx of maio2026 || []) {
    const key = tx.conta_id || 'SEM_CONTA'
    if (!porConta[key]) porConta[key] = { count: 0, datas: [] }
    porConta[key].count++
    porConta[key].datas.push(tx.data_hora?.slice(0, 10))
  }

  return NextResponse.json({
    nubank_ativo_id: NUBANK_ATIVO,
    txs_abr_jun_2026_por_conta: porConta,
    txs_encontradas_pelos_fitids_do_ofx: (porFitid || []).map(t => ({
      conta_id: t.conta_id,
      data: t.data_hora?.slice(0, 10),
      valor: t.valor,
      descricao: t.descricao,
      ref_externa: t.ref_externa,
    })),
  })
}
