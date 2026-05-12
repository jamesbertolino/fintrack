import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function getWebPush() {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL || 'privacidade@poupaup.com.br'}`,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  )
  return webpush
}

export interface PushPayload {
  title: string
  body: string
  url?: string
  icon?: string
}

/** Envia push para todos os dispositivos de um usuário. Uso interno. */
export async function enviarPushParaUsuario(userId: string, payload: PushPayload) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return

  const svc = getServiceClient()
  const { data: subs } = await svc
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (!subs?.length) return

  const wp = getWebPush()
  const body = JSON.stringify({ ...payload, icon: payload.icon || '/logo.png', badge: '/logo.png' })

  await Promise.allSettled(
    subs.map(sub =>
      wp.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, body)
        .catch(async err => {
          // Subscription expirada → remove
          if (err.statusCode === 410 || err.statusCode === 404) {
            await svc.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
          }
        })
    )
  )
}

// Endpoint interno (cron / webhook) protegido por CRON_SECRET
export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (!auth || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { user_id, title, body, url } = await request.json()
  if (!user_id || !title || !body) {
    return NextResponse.json({ error: 'Parâmetros obrigatórios: user_id, title, body' }, { status: 400 })
  }

  await enviarPushParaUsuario(user_id, { title, body, url })
  return NextResponse.json({ ok: true })
}
