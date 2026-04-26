import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const EVO_URL    = () => process.env.EVOLUTION_URL!
const EVO_KEY    = () => process.env.EVOLUTION_API_KEY!
const evoHeaders = () => ({ 'Content-Type': 'application/json', 'apikey': EVO_KEY() })

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ instancia: string }> }
) {
  const { instancia } = await params
  const nomeGrupo = request.nextUrl.searchParams.get('grupo') || ''

  console.log('[status] instancia:', instancia)

  const res = await fetch(`${EVO_URL()}/instance/connectionState/${instancia}`, {
    headers: { 'apikey': EVO_KEY() },
  })

  if (!res.ok) {
    return NextResponse.json({ state: 'close' })
  }

  const data  = await res.json()
  const state: string = data.instance?.state ?? data.state ?? 'close'

  console.log('[status] state:', state)

  if (state === 'open') {
    const supabase = getSupabase()

    // Busca o user vinculado a esta instância
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, whatsapp')
      .eq('evolution_instancia', instancia)
      .single()

    console.log('[status] user encontrado:', profile?.id)

    // Marca setup completo
    await supabase
      .from('profiles')
      .update({ setup_completo: true })
      .eq('evolution_instancia', instancia)

    // Cria o grupo WhatsApp via Evolution (apenas se ainda não foi criado)
    if (nomeGrupo && profile?.id) {
      try {
        const participants = profile.whatsapp ? [profile.whatsapp] : []

        console.log('[status] criando grupo...')

        const grupoRes = await fetch(`${EVO_URL()}/group/create/${instancia}`, {
          method:  'POST',
          headers: evoHeaders(),
          body:    JSON.stringify({ subject: nomeGrupo, participants }),
        })

        const grupoText = await grupoRes.text()
        console.log('[status] grupo criado:', grupoRes.status, grupoText)

        if (grupoRes.ok) {
          const grupoData = JSON.parse(grupoText) as Record<string, unknown>
          const groupJid: string = (grupoData.id ?? grupoData.groupJid ?? grupoData.jid ?? '') as string

          console.log('[status] grupo salvo no banco:', grupoData)

          if (groupJid) {
            const { data: novoGrupo } = await supabase
              .from('grupos')
              .insert({
                nome:                nomeGrupo,
                criado_por:          profile.id,
                evolution_instancia: instancia,
                whatsapp_grupo_id:   groupJid,
              })
              .select('id')
              .single()

            if (novoGrupo?.id) {
              await supabase
                .from('profiles')
                .update({ grupo_id_principal: novoGrupo.id })
                .eq('id', profile.id)
            }
          }
        }
      } catch (err) {
        console.log('[evolution/status] erro ao criar grupo:', err)
      }
    }
  }

  return NextResponse.json({ state })
}
