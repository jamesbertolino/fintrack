import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    EVOLUTION_API_KEY:   process.env.EVOLUTION_API_KEY ? process.env.EVOLUTION_API_KEY.slice(0, 8) + '...' : 'NAO_DEFINIDA',
    EVOLUTION_URL:       process.env.EVOLUTION_URL       || 'NAO_DEFINIDA',
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'NAO_DEFINIDA',
  })
}
