import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ instancia: string }> }
) {
  const { instancia } = await params
  const { searchParams } = new URL(request.url)
  const grupo  = searchParams.get('grupo') || 'Família PoupaUp'
  const userId = searchParams.get('user_id')

  if (!userId) {
    return NextResponse.json({ error: 'user_id obrigatório' }, { status: 400 })
  }

  const evoRes = await fetch(
    `${process.env.EVOLUTION_URL}/instance/connectionState/${instancia}`,
    { headers: { 'apikey': process.env.EVOLUTION_API_KEY! } }
  )
  const evoData = await evoRes.json()
  const state: string = evoData.instance?.state || evoData.state || 'close'

  if (state !== 'open') {
    return NextResponse.json({ state })
  }

  const supabase = getSupabase()

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, nome, whatsapp')
    .eq('id', userId)
    .single()

  // Marca setup_completo e salva instância
  await supabase.from('profiles').update({
    setup_completo: true,
    evolution_instancia: instancia,
  }).eq('id', userId)

  // Cria grupo WhatsApp
  let grupoJid: string | null = null
  if (profile?.whatsapp) {
    const grupoRes = await fetch(
      `${process.env.EVOLUTION_URL}/group/create/${instancia}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': process.env.EVOLUTION_API_KEY! },
        body:    JSON.stringify({ subject: grupo, participants: [profile.whatsapp] }),
      }
    )
    const grupoData = await grupoRes.json()
    grupoJid = (grupoData.id ?? grupoData.groupJid ?? grupoData.jid ?? null) as string | null

    // Define imagem do grupo como logo do app
    if (grupoJid) {
      const logoUrl = `${process.env.NEXT_PUBLIC_APP_URL}/logo.png`
      await fetch(`${process.env.EVOLUTION_URL}/group/updateGroupPicture/${instancia}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json', 'apikey': process.env.EVOLUTION_API_KEY! },
        body:    JSON.stringify({ groupJid: grupoJid, image: logoUrl }),
      }).catch(() => {/* não bloqueia se falhar */})
    }
  }

  // Salva grupo no banco
  if (grupoJid) {
    const { data: novoGrupo } = await supabase
      .from('grupos')
      .insert({
        nome:                grupo,
        criado_por:          userId,
        evolution_instancia: instancia,
        whatsapp_grupo_id:   grupoJid,
      })
      .select('id')
      .single()

    if (novoGrupo?.id) {
      await supabase.from('profiles').update({
        grupo_id_principal: novoGrupo.id,
      }).eq('id', userId)
    }
  }

  // Configura webhook
  await fetch(`${process.env.EVOLUTION_URL}/webhook/set/${instancia}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': process.env.EVOLUTION_API_KEY! },
    body:    JSON.stringify({
      webhook: {
        url:      `${process.env.NEXT_PUBLIC_APP_URL}/api/whatsapp/receber`,
        enabled:  true,
        byEvents: false,
        base64:   false,
        events:   ['MESSAGES_UPSERT'],
      },
    }),
  })

  return NextResponse.json({ state: 'open' })
}
