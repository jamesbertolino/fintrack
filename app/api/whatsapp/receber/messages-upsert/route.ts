import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    console.log('[whatsapp/receber] body inválido')
    return NextResponse.json({ ok: true })
  }

  console.log('[whatsapp/receber] body recebido:', JSON.stringify(body, null, 2))

  const evento  = body.event as string | undefined
  const data    = body.data as Record<string, unknown> | undefined
  const key     = data?.key as Record<string, unknown> | undefined
  const fromMe  = key?.fromMe as boolean | undefined

  // Ignora eventos que não são mensagens recebidas
  if (evento !== 'messages.upsert') {
    console.log('[whatsapp/receber] evento ignorado:', evento)
    return NextResponse.json({ ok: true })
  }

  if (fromMe) {
    console.log('[whatsapp/receber] mensagem própria ignorada')
    return NextResponse.json({ ok: true })
  }

  const remoteJid   = key?.remoteJid as string | undefined
  const participant = data?.participant as string | undefined
  const numero = (remoteJid ?? participant ?? '').replace('@s.whatsapp.net', '').replace('@g.us', '')

  const messageObj = data?.message as Record<string, unknown> | undefined
  const mensagem   = (messageObj?.conversation as string)
    || ((messageObj?.extendedTextMessage as Record<string, unknown>)?.text as string)
    || ''

  console.log('[whatsapp/receber] numero:', numero)
  console.log('[whatsapp/receber] mensagem:', mensagem)

  if (!mensagem || !numero) {
    console.log('[whatsapp/receber] sem mensagem ou número, ignorando')
    return NextResponse.json({ ok: true })
  }

  // Repassa para o endpoint de parse
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const secret = process.env.N8N_WEBHOOK_SECRET  || 'granaup-secret-2026'

  try {
    const parseRes = await fetch(`${appUrl}/api/whatsapp/parse`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-n8n-secret': secret },
      body: JSON.stringify({ numero, mensagem }),
    })
    const parseData = await parseRes.json()
    console.log('[whatsapp/receber] parse status:', parseRes.status, 'resposta:', JSON.stringify(parseData))
  } catch (err) {
    console.log('[whatsapp/receber] erro ao chamar parse:', err)
  }

  return NextResponse.json({ ok: true })
}
