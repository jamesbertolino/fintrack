import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-04-22.dahlia' })

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const PLANO_POR_PRICE: Record<string, string> = {
  [process.env.STRIPE_PRICE_PRO     || 'UNSET_PRO']:     'pro',
  [process.env.STRIPE_PRICE_FAMILIA || 'UNSET_FAMILIA']: 'familia',
}

async function atualizarPlano(userId: string, plano: string) {
  const supabase = getServiceClient()
  await supabase.from('profiles').update({ plano }).eq('id', userId)
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig  = request.headers.get('stripe-signature') || ''

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('[stripe/webhook] assinatura inválida:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = getServiceClient()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      // Metadata do subscription está no objeto subscription, não na session
      const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
      if (subId) {
        const sub = await stripe.subscriptions.retrieve(subId)
        const userId = sub.metadata?.supabase_user_id
        const plano  = sub.metadata?.plano
        if (userId && plano) await atualizarPlano(userId, plano)
      }
      break
    }

    case 'customer.subscription.updated': {
      const sub    = event.data.object as Stripe.Subscription
      const userId = sub.metadata?.supabase_user_id
      if (!userId) break
      const priceId = sub.items.data[0]?.price.id
      const plano   = PLANO_POR_PRICE[priceId] || 'free'
      if (sub.status === 'active' || sub.status === 'trialing') {
        await atualizarPlano(userId, plano)
      }
      break
    }

    case 'customer.subscription.deleted': {
      const sub    = event.data.object as Stripe.Subscription
      const userId = sub.metadata?.supabase_user_id
      if (userId) {
        await supabase.from('profiles').update({ plano: 'free', stripe_customer_id: null }).eq('id', userId)
      }
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice & { subscription?: string | null }
      const subId   = typeof invoice.subscription === 'string' ? invoice.subscription : null
      if (subId) {
        const sub = await stripe.subscriptions.retrieve(subId)
        const userId = sub.metadata?.supabase_user_id
        if (userId) {
          await supabase.from('notificacoes').insert({
            user_id: userId,
            titulo:  'Pagamento falhou',
            mensagem: 'Não conseguimos processar seu pagamento. Atualize seu método de pagamento para continuar no plano premium.',
            tipo:    'aviso',
            lida:    false,
          })
        }
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}
