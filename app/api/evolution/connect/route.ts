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

const EVO_URL    = () => process.env.EVOLUTION_URL!
const EVO_KEY    = () => process.env.EVOLUTION_API_KEY!
const evoHeaders = () => ({ 'Content-Type': 'application/json', 'apikey': EVO_KEY() })

export async function POST(request: NextRequest) {
  const { userId } = await request.json()

  if (!userId) {
    return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })
  }

  const supabase = getSupabase()

  // Busca whatsapp do perfil
  const { data: profile } = await supabase
    .from('profiles')
    .select('whatsapp, nome')
    .eq('id', userId)
    .single()

  if (!profile?.whatsapp) {
    return NextResponse.json(
      { error: 'Cadastre seu número WhatsApp no perfil antes de conectar' },
      { status: 422 }
    )
  }

  const instancia = `granaup_${profile.whatsapp}`

  // Verifica se instância já existe
  const fetchRes = await fetch(`${EVO_URL()}/instance/fetchInstances`, {
    headers: evoHeaders(),
  })

  if (fetchRes.ok) {
    const fetchText = await fetchRes.text()
    try {
      const instances = JSON.parse(fetchText) as Array<{
        instance?: { instanceName?: string; state?: string }
        name?: string
        state?: string
      }>

      console.log('[evolution/connect] instâncias encontradas:', instances.map(i => ({
        name: i.instance?.instanceName ?? i.name,
        state: i.instance?.state ?? i.state,
      })))

      const existing = instances.find(
        i => (i.instance?.instanceName ?? i.name) === instancia
      )

      if (existing) {
        const state = existing.instance?.state ?? existing.state ?? ''
        console.log('[evolution/connect] instância existente:', instancia, 'state:', state)

        if (state === 'open') {
          // Já conectada — marca setup completo e retorna
          await supabase
            .from('profiles')
            .update({ setup_completo: true, evolution_instancia: instancia })
            .eq('id', userId)

          return NextResponse.json({ instancia, jaConectada: true })
        }

        // Instância existe mas não está conectada — salva e retorna sem criar
        await supabase
          .from('profiles')
          .update({ evolution_instancia: instancia })
          .eq('id', userId)

        // Tenta buscar o QR Code atual da instância existente
        const qrRes = await fetch(`${EVO_URL()}/instance/connect/${instancia}`, {
          headers: evoHeaders(),
        })
        const qrText = await qrRes.text()
        console.log('[evolution/connect] connect existente status:', qrRes.status, 'body:', qrText)

        let qrcode: string | null = null
        try {
          const qrData = JSON.parse(qrText) as Record<string, unknown>
          qrcode = (qrData.qrcode as Record<string, unknown>)?.base64 as string
            ?? qrData.base64 as string
            ?? null
        } catch { /* sem QR disponível ainda */ }

        return NextResponse.json({ instancia, qrcode })
      }
    } catch {
      console.log('[evolution/connect] fetchInstances parse error, prosseguindo com criação')
    }
  } else {
    console.log('[evolution/connect] fetchInstances falhou:', fetchRes.status)
  }

  // Cria instância na Evolution API
  const evoRes = await fetch(`${EVO_URL()}/instance/create`, {
    method:  'POST',
    headers: evoHeaders(),
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
  console.log('[evolution/connect] create status:', evoRes.status, 'body:', evoText)

  if (!evoText || !evoRes.ok) {
    return NextResponse.json(
      { error: `Evolution API erro ${evoRes.status}: ${evoText}` },
      { status: 500 }
    )
  }

  let evoData: Record<string, unknown>
  try {
    evoData = JSON.parse(evoText)
  } catch {
    return NextResponse.json(
      { error: `Resposta inválida da Evolution: ${evoText.slice(0, 200)}` },
      { status: 500 }
    )
  }

  console.log('[evolution/connect] evoData:', JSON.stringify(evoData, null, 2))

  // Verifica campos de erro da Evolution v2.x
  const evoError = (evoData.error ?? evoData.message) as string | undefined
  if (evoError && !evoData.instance && !evoData.qrcode) {
    return NextResponse.json(
      { error: `Evolution: ${evoError}` },
      { status: 500 }
    )
  }

  const qrcode = (evoData.qrcode as Record<string, unknown>)?.base64 ?? evoData.base64 ?? null

  // Salva instância no perfil
  await supabase
    .from('profiles')
    .update({ evolution_instancia: instancia })
    .eq('id', userId)

  return NextResponse.json({ instancia, qrcode })
}
