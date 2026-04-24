import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ instancia: string }> }
) {
  const { instancia } = await params
  const evoUrl = process.env.EVOLUTION_URL!
  const apiKey = process.env.EVOLUTION_API_KEY!

  const res = await fetch(`${evoUrl}/instance/connectionState/${instancia}`, {
    headers: { 'apikey': apiKey },
  })

  if (!res.ok) {
    return NextResponse.json({ state: 'close' })
  }

  const data  = await res.json()
  const state: string = data.instance?.state ?? data.state ?? 'close'

  if (state === 'open') {
    const supabase = getSupabase()
    await supabase
      .from('profiles')
      .update({ setup_completo: true })
      .eq('evolution_instancia', instancia)
  }

  return NextResponse.json({ state })
}
