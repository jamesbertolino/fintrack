import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { instancia, grupoJid } = await request.json()

  // 1. Bot sai do grupo
  if (grupoJid) {
    await fetch(
      `${process.env.EVOLUTION_URL}/group/leaveGroup/${instancia}?groupJid=${grupoJid}`,
      {
        method: 'DELETE',
        headers: { 'apikey': process.env.EVOLUTION_API_KEY! },
      }
    )
  }

  // 2. Deleta a instância na Evolution
  const deleteRes = await fetch(
    `${process.env.EVOLUTION_URL}/instance/delete/${instancia}`,
    {
      method: 'DELETE',
      headers: { 'apikey': process.env.EVOLUTION_API_KEY! },
    }
  )
  await deleteRes.text()

  return NextResponse.json({ ok: true })
}
