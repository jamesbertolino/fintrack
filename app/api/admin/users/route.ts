import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

function service() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function verificarAdmin() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  return profile?.is_admin ? user : null
}

// GET /api/admin/users?q=&plano=&page=0
export async function GET(req: NextRequest) {
  const admin = await verificarAdmin()
  if (!admin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const { searchParams } = req.nextUrl
  const q     = searchParams.get('q') || ''
  const plano = searchParams.get('plano') || ''
  const page  = parseInt(searchParams.get('page') || '0')
  const size  = 20

  const db = service()
  let query = db
    .from('profiles')
    .select('id, nome, plano, created_at, xp_total, referido_por, stripe_customer_id, stripe_subscription_id', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * size, page * size + size - 1)

  if (q) query = query.ilike('nome', `%${q}%`)
  if (plano) query = query.eq('plano', plano)

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ users: data, total: count ?? 0, page, size })
}

// PATCH /api/admin/users — alterar plano
export async function PATCH(req: NextRequest) {
  const admin = await verificarAdmin()
  if (!admin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const { user_id, plano } = await req.json()
  if (!user_id || !plano) return NextResponse.json({ error: 'user_id e plano obrigatórios' }, { status: 400 })

  const planos_validos = ['free', 'pro', 'familia']
  if (!planos_validos.includes(plano)) return NextResponse.json({ error: 'Plano inválido' }, { status: 400 })

  const { error } = await service().from('profiles').update({ plano }).eq('id', user_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
