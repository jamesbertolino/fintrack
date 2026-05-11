import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServerSupabaseClient } from '@/lib/supabase-server'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-04-22.dahlia' })
}

const PRICE_IDS: Record<string, string> = {
  pro:     process.env.STRIPE_PRICE_PRO     || '',
  familia: process.env.STRIPE_PRICE_FAMILIA || '',
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { plano } = await request.json()
  const priceId = PRICE_IDS[plano]
  if (!priceId) return NextResponse.json({ error: 'Plano inválido' }, { status: 400 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('nome, stripe_customer_id')
    .eq('id', user.id)
    .single()

  let customerId = profile?.stripe_customer_id as string | undefined

  const stripe = getStripe()

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: profile?.nome || undefined,
      metadata: { supabase_user_id: user.id },
    })
    customerId = customer.id
    await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id)
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/dashboard?upgrade=success`,
    cancel_url:  `${baseUrl}/dashboard/perfil?upgrade=cancelled`,
    subscription_data: {
      metadata: { supabase_user_id: user.id, plano },
    },
  })

  return NextResponse.json({ url: session.url })
}
