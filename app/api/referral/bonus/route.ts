import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const XP_REFERRAL = 500

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// Chamado no cadastro de um novo usuário que veio via link de indicação.
// Credita XP para quem indicou — sem auth requerida pois é chamado no fluxo de signup.
export async function POST(request: NextRequest) {
  const { referrer_id } = await request.json()
  if (!referrer_id || typeof referrer_id !== 'string') {
    return NextResponse.json({ error: 'referrer_id obrigatório' }, { status: 400 })
  }

  const supabase = getServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('xp_bonus')
    .eq('id', referrer_id)
    .maybeSingle()

  if (!profile) return NextResponse.json({ ok: true })

  await supabase
    .from('profiles')
    .update({ xp_bonus: (profile.xp_bonus || 0) + XP_REFERRAL })
    .eq('id', referrer_id)

  return NextResponse.json({ ok: true, xp: XP_REFERRAL })
}
