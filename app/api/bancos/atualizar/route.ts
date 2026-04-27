import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-n8n-secret')
  if (secret !== process.env.N8N_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const res = await fetch('https://brasilapi.com.br/api/banks/v1')
  const bancos = await res.json()

  let atualizados = 0
  for (const banco of bancos) {
    if (!banco.code) continue
    const codigo = String(banco.code).padStart(3, '0')

    await supabase.from('bancos').upsert({
      codigo,
      ispb:      banco.ispb,
      nome:      banco.fullName || banco.name,
      nome_curto: banco.name,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'codigo' })

    atualizados++
  }

  return NextResponse.json({ ok: true, atualizados })
}
