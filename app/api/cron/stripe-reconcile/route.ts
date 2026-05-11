import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-04-22.dahlia' })
}

const PLANO_POR_PRICE: Record<string, string> = {}

/**
 * Cron diário que reconcilia o plano dos usuários com o estado real no Stripe.
 * Corrige casos onde o webhook falhou na entrega.
 */
export async function GET(request: NextRequest) {
  const secret = request.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ ok: true, skipped: 'STRIPE_SECRET_KEY não configurado' })
  }

  // Mapeia price ids → plano
  const priceIdPro     = process.env.STRIPE_PRICE_PRO     || ''
  const priceIdFamilia = process.env.STRIPE_PRICE_FAMILIA || ''
  if (priceIdPro)     PLANO_POR_PRICE[priceIdPro]     = 'pro'
  if (priceIdFamilia) PLANO_POR_PRICE[priceIdFamilia] = 'familia'

  const supabase = getServiceClient()
  const stripe   = getStripe()

  // Busca usuários com stripe_customer_id registrado
  const { data: perfis, error } = await supabase
    .from('profiles')
    .select('id, plano, stripe_customer_id')
    .not('stripe_customer_id', 'is', null)

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  let corrigidos = 0
  const erros: string[] = []

  for (const perfil of perfis || []) {
    try {
      const subs = await stripe.subscriptions.list({
        customer: perfil.stripe_customer_id as string,
        status: 'active',
        limit: 1,
      })

      const subAtiva = subs.data[0]
      let planoCorreto = 'free'

      if (subAtiva) {
        const priceId = subAtiva.items.data[0]?.price.id
        planoCorreto  = PLANO_POR_PRICE[priceId] || 'pro'
      }

      if (planoCorreto !== perfil.plano) {
        await supabase
          .from('profiles')
          .update({ plano: planoCorreto })
          .eq('id', perfil.id)
        corrigidos++
        console.log(`[stripe-reconcile] ${perfil.id}: ${perfil.plano} → ${planoCorreto}`)
      }
    } catch (err) {
      erros.push(`${perfil.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return NextResponse.json({
    ok: true,
    verificados: (perfis || []).length,
    corrigidos,
    erros: erros.length > 0 ? erros : undefined,
  })
}
