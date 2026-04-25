import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  // O grupo WhatsApp continua existindo — apenas desativamos no banco.
  // Não fazemos leaveGroup para não remover o bot do grupo desnecessariamente.
  void request.json()
  return NextResponse.json({ ok: true })
}
