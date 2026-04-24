import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Variáveis de ambiente necessárias na Vercel:
// EVOLUTION_API_KEY=069A835EF36F-42A0-943E-5F44E898BFB1
// EVOLUTION_URL=https://evo.mycomp.com.br
// NEXT_PUBLIC_APP_URL=https://fintrack-zeta-wine.vercel.app

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  const { nomeGrupo, userId } = await request.json()

  if (!nomeGrupo || !userId) {
    return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })
  }

  const instancia = `granaup_${userId.slice(0, 8)}`
  const evoUrl    = process.env.EVOLUTION_URL!
  const apiKey    = process.env.EVOLUTION_API_KEY!
  const appUrl    = process.env.NEXT_PUBLIC_APP_URL!

  const evoRes = await fetch(`${evoUrl}/instance/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': apiKey,
    },
    body: JSON.stringify({
      instanceName: instancia,
      integration:  'WHATSAPP-BAILEYS',
      qrcode:       true,
      webhook: {
        url:      `${appUrl}/api/whatsapp/parse`,
        byEvents: true,
        events:   ['MESSAGES_UPSERT'],
      },
    }),
  })

  if (!evoRes.ok) {
    const txt = await evoRes.text()
    return NextResponse.json({ error: `Erro Evolution API: ${txt}` }, { status: 502 })
  }

  const evoData = await evoRes.json()
  const qrcode  = evoData.qrcode?.base64 ?? evoData.base64 ?? null

  const supabase = getSupabase()

  await supabase
    .from('profiles')
    .update({ evolution_instancia: instancia })
    .eq('id', userId)

  await supabase
    .from('grupos')
    .insert({ nome: nomeGrupo, criado_por: userId })

  return NextResponse.json({ instancia, qrcode })
}
