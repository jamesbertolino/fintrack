import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { instancia, grupoJid, numero } = await request.json()

  const numeroFormatado = numero.includes('@') ? numero : `${numero}@s.whatsapp.net`

  const res = await fetch(`${process.env.EVOLUTION_URL}/group/updateParticipant/${instancia}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': process.env.EVOLUTION_API_KEY!,
    },
    body: JSON.stringify({
      groupJid: grupoJid,
      action: 'remove',
      participants: [numeroFormatado],
    }),
  })

  const data = await res.json()
  console.log('[remover-membro] status:', res.status, 'data:', JSON.stringify(data))
  return NextResponse.json({ ok: res.ok, data })
}
