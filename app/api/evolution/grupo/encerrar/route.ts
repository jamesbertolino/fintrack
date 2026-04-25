import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { instancia, grupoJid } = await request.json()

  const res = await fetch(`${process.env.EVOLUTION_URL}/group/leaveGroup/${instancia}?groupJid=${grupoJid}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'apikey': process.env.EVOLUTION_API_KEY!,
    },
  })

  const text = await res.text()
  console.log('[encerrar-grupo] status:', res.status, 'data:', text)
  return NextResponse.json({ ok: res.ok })
}
