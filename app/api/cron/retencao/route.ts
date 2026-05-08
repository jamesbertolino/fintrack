import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(request: NextRequest) {
  const secret = request.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const supabase = getServiceClient()
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  const [wl, al] = await Promise.all([
    supabase.from('whatsapp_logs').delete().lt('created_at', cutoff),
    supabase.from('audit_log').delete().lt('created_at', cutoff),
  ])

  return NextResponse.json({
    ok: true,
    whatsapp_logs: wl.error ? wl.error.message : 'ok',
    audit_log:     al.error ? al.error.message : 'ok',
    cutoff,
  })
}
