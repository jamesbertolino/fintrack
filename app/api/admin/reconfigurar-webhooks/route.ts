import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/**
 * POST /api/admin/reconfigurar-webhooks
 *
 * Reaplica a configuração de webhook (com o header de autenticação) em todas as
 * instâncias Evolution ativas. Deve ser chamado uma vez após deploy do fix de
 * autenticação do /api/whatsapp/receber.
 */
export async function POST() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: profile } = await getServiceClient()
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'Acesso restrito a administradores' }, { status: 403 })
  }

  const evoUrl    = process.env.EVOLUTION_URL
  const evoKey    = process.env.EVOLUTION_API_KEY
  const appUrl    = process.env.NEXT_PUBLIC_APP_URL
  const secret    = process.env.N8N_WEBHOOK_SECRET

  if (!evoUrl || !evoKey || !appUrl || !secret) {
    return NextResponse.json({
      error: 'Variáveis de ambiente ausentes: EVOLUTION_URL, EVOLUTION_API_KEY, NEXT_PUBLIC_APP_URL, N8N_WEBHOOK_SECRET',
    }, { status: 500 })
  }

  // Busca todas as instâncias ativas
  const { data: perfis } = await getServiceClient()
    .from('profiles')
    .select('id, evolution_instancia')
    .not('evolution_instancia', 'is', null)

  const instancias = (perfis || [])
    .map(p => p.evolution_instancia as string)
    .filter(Boolean)

  const resultados: { instancia: string; ok: boolean; status?: number }[] = []

  for (const instancia of instancias) {
    const body = {
      webhook: {
        url:      `${appUrl}/api/whatsapp/receber`,
        enabled:  true,
        byEvents: false,
        base64:   false,
        events:   ['MESSAGES_UPSERT'],
        headers:  { 'x-webhook-secret': secret },
      },
    }

    try {
      const res = await fetch(`${evoUrl}/webhook/set/${instancia}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
        body:    JSON.stringify(body),
      })
      resultados.push({ instancia, ok: res.ok, status: res.status })
    } catch (err) {
      resultados.push({ instancia, ok: false, status: 0 })
      console.error(`[reconfigurar-webhooks] ${instancia}:`, err)
    }
  }

  return NextResponse.json({
    ok: true,
    total: instancias.length,
    sucesso: resultados.filter(r => r.ok).length,
    falhas:  resultados.filter(r => !r.ok).length,
    detalhes: resultados,
  })
}
