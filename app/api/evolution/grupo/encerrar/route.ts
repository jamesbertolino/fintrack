import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { instancia, grupoJid } = await request.json()

  // 1. Bot sai do grupo
  if (grupoJid) {
    const leaveRes = await fetch(
      `${process.env.EVOLUTION_URL}/group/leaveGroup/${instancia}?groupJid=${grupoJid}`,
      {
        method: 'DELETE',
        headers: { 'apikey': process.env.EVOLUTION_API_KEY! },
      }
    )
    console.log('[encerrar-grupo] leaveGroup status:', leaveRes.status)
  }

  // 2. Deleta a instância na Evolution
  const deleteRes = await fetch(
    `${process.env.EVOLUTION_URL}/instance/delete/${instancia}`,
    {
      method: 'DELETE',
      headers: { 'apikey': process.env.EVOLUTION_API_KEY! },
    }
  )
  const deleteText = await deleteRes.text()
  console.log('[encerrar-grupo] deleteInstance status:', deleteRes.status, deleteText)

  return NextResponse.json({ ok: true })
}
