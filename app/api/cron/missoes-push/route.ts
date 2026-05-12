import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notificarMissoesDia } from '@/lib/pushEventos'
import { MISSOES_DIARIAS } from '@/lib/missoes'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// Roda às 7h BRT (10h UTC) — lembra usuários das missões do dia
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (!auth || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const supabase = getServiceClient()

  // Busca usuários com push subscription ativa
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('user_id')

  if (!subs?.length) return NextResponse.json({ ok: true, enviados: 0 })

  const userIds = [...new Set(subs.map(s => s.user_id))]
  const inicioDiaHoje = new Date()
  inicioDiaHoje.setHours(0, 0, 0, 0)

  let enviados = 0

  for (const userId of userIds) {
    // Conta missões já concluídas hoje
    const { data: missoesConcluidas } = await supabase
      .from('missoes_usuario')
      .select('missao_id')
      .eq('user_id', userId)
      .eq('concluida', true)
      .gte('periodo', inicioDiaHoje.toISOString())

    const concluidasIds = new Set((missoesConcluidas || []).map(m => m.missao_id))
    const pendentes = MISSOES_DIARIAS.filter(m => !concluidasIds.has(m.id)).length

    if (pendentes > 0) {
      notificarMissoesDia(userId, pendentes)
      enviados++
    }
  }

  return NextResponse.json({ ok: true, enviados, total: userIds.length })
}
