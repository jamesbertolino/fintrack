import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    N8N_WEBHOOK_SECRET: process.env.N8N_WEBHOOK_SECRET ? 'DEFINIDA' : 'NAO_DEFINIDA',
    N8N_SECRET_VALUE: process.env.N8N_WEBHOOK_SECRET?.slice(0, 5) + '...' || 'vazia',
  })
}
