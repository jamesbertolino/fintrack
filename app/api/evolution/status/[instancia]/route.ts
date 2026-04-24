import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const EVO_URL  = () => process.env.EVOLUTION_URL!
const EVO_KEY  = () => process.env.EVOLUTION_API_KEY!
const evoHeaders = () => ({ 'Content-Type': 'application/json', 'apikey': EVO_KEY() })

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ instancia: string }> }
) {
  const { instancia } = await params
  const nomeGrupo = request.nextUrl.searchParams.get('grupo') || ''

  const res = await fetch(`${EVO_URL()}/instance/connectionState/${instancia}`, {
    headers: { 'apikey': EVO_KEY() },
  })

  if (!res.ok) {
    return NextResponse.json({ state: 'close' })
  }

  const data  = await res.json()
  const state: string = data.instance?.state ?? data.state ?? 'close'

  if (state === 'open') {
    const supabase = getSupabase()

    // Busca o user_id vinculado a esta instância
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('evolution_instancia', instancia)
      .single()

    // Marca setup completo
    await supabase
      .from('profiles')
      .update({ setup_completo: true })
      .eq('evolution_instancia', instancia)

    // Cria o grupo WhatsApp via Evolution
    if (nomeGrupo && profile?.id) {
      try {
        const grupoRes = await fetch(`${EVO_URL()}/group/create/${instancia}`, {
          method:  'POST',
          headers: evoHeaders(),
          body: JSON.stringify({ subject: nomeGrupo, participants: [] }),
        })

        if (grupoRes.ok) {
          const grupoData = await grupoRes.json()
          const groupJid: string = grupoData.id ?? grupoData.groupJid ?? grupoData.jid ?? ''

          if (groupJid) {
            await supabase.from('grupos').insert({
              nome:              nomeGrupo,
              criado_por:        profile.id,
              whatsapp_grupo_id: groupJid,
            })
          }
        } else {
          console.log('[evolution/status] group/create falhou:', grupoRes.status, await grupoRes.text())
        }
      } catch (err) {
        console.log('[evolution/status] erro ao criar grupo:', err)
      }
    }
  }

  return NextResponse.json({ state })
}
