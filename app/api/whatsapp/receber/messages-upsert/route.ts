import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  // Valida o mesmo secret usado pelo /api/whatsapp/receber e /api/whatsapp/parse
  const secret = request.headers.get('x-n8n-secret')
    || request.headers.get('x-webhook-secret')
  const expected = process.env.N8N_WEBHOOK_SECRET
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: true })
  }

  const evento  = body.event as string | undefined
  const data    = body.data as Record<string, unknown> | undefined
  const key     = data?.key as Record<string, unknown> | undefined

  // Ignora eventos que não são mensagens recebidas
  if (evento !== 'messages.upsert') {
    return NextResponse.json({ ok: true })
  }

  const remoteJid   = key?.remoteJid as string | undefined
  const participant = data?.participant as string | undefined

  // Ignora grupos e status broadcast
  if (remoteJid?.endsWith('@g.us') || remoteJid?.endsWith('@broadcast')) {
    return NextResponse.json({ ok: true })
  }

  const numero = (remoteJid ?? participant ?? '').replace('@s.whatsapp.net', '')

  const messageObj = data?.message as Record<string, unknown> | undefined
  const mensagem   = (messageObj?.conversation as string)
    || ((messageObj?.extendedTextMessage as Record<string, unknown>)?.text as string)
    || ''

  if (!mensagem || !numero) {
    return NextResponse.json({ ok: true })
  }

  // Repassa para o endpoint de parse
  const appUrl      = process.env.NEXT_PUBLIC_APP_URL || ''
  const parseSecret = process.env.N8N_WEBHOOK_SECRET || ''

  try {
    const parseRes = await fetch(`${appUrl}/api/whatsapp/parse`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-n8n-secret': parseSecret },
      body: JSON.stringify({ numero, mensagem }),
    })
    if (!parseRes.ok) {
      console.error('[messages-upsert] parse retornou', parseRes.status, 'para', numero)
    }
  } catch (err) {
    console.error('[messages-upsert] falha ao repassar mensagem de', numero, err)
  }

  return NextResponse.json({ ok: true })
}
