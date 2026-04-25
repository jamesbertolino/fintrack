import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { instancia, grupoJid, numero } = await request.json()

  const numeroFormatado = numero.replace(/\D/g, '')
  const participante    = `${numeroFormatado}@s.whatsapp.net`

  const body = JSON.stringify({
    groupJid:     grupoJid,
    action:       'remove',
    participants: [participante],
  })

  console.log('[remover-membro] body enviado:', body)

  const res = await fetch(`${process.env.EVOLUTION_URL}/group/updateParticipant/${instancia}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': process.env.EVOLUTION_API_KEY!,
    },
    body,
  })

  const data = await res.json()
  console.log('[remover-membro] status:', res.status, 'resposta:', JSON.stringify(data))
  return NextResponse.json({ ok: res.ok, data })
}
