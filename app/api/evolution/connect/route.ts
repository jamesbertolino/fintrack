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

  const evoRes = await fetch(`${process.env.EVOLUTION_URL}/instance/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': process.env.EVOLUTION_API_KEY!,
    },
    body: JSON.stringify({
      instanceName: instancia,
      integration:  'WHATSAPP-BAILEYS',
      qrcode:       true,
      webhook: {
        url:      `${process.env.NEXT_PUBLIC_APP_URL}/api/whatsapp/receber`,
        byEvents: true,
        events:   ['MESSAGES_UPSERT'],
      },
    }),
  })

  const evoText = await evoRes.text()
  console.log('[evolution/connect] status:', evoRes.status, 'body:', evoText)

  if (!evoText || !evoRes.ok) {
    return NextResponse.json({ error: `Evolution API erro ${evoRes.status}: ${evoText}` }, { status: 500 })
  }

  let evoData: Record<string, unknown>
  try {
    evoData = JSON.parse(evoText)
  } catch {
    return NextResponse.json({ error: `Resposta inválida da Evolution: ${evoText.slice(0, 200)}` }, { status: 500 })
  }

  const qrcode = (evoData.qrcode as Record<string, unknown>)?.base64 ?? evoData.base64 ?? null

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
