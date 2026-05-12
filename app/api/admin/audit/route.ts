import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

function service() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET /api/admin/audit?page=0&action=
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const { searchParams } = req.nextUrl
  const page   = parseInt(searchParams.get('page') || '0')
  const action = searchParams.get('action') || ''
  const size   = 50

  const db = service()
  let query = db
    .from('audit_log')
    .select('id, user_id, action, resource_id, metadata, created_at, profiles!inner(nome)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * size, page * size + size - 1)

  if (action) query = query.eq('action', action)

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ logs: data, total: count ?? 0, page, size })
}
