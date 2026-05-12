import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

function service() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const SIZES_VALIDOS = [25, 50, 100, 500]

// GET /api/admin/audit?page=0&action=&user_id=&date_from=&date_to=&size=50
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const { searchParams } = req.nextUrl
  const page      = parseInt(searchParams.get('page') || '0')
  const action    = searchParams.get('action') || ''
  const userId    = searchParams.get('user_id') || ''
  const dateFrom  = searchParams.get('date_from') || ''  // YYYY-MM-DD
  const dateTo    = searchParams.get('date_to') || ''    // YYYY-MM-DD
  const sizeParam = parseInt(searchParams.get('size') || '50')
  const size      = SIZES_VALIDOS.includes(sizeParam) ? sizeParam : 50

  const db = service()

  // Se filtro por usuário via nome, primeiro resolve o user_id
  let filtroUserId = userId
  const userQ = searchParams.get('user_q') || ''
  if (userQ && !userId) {
    const { data: perfisMatch } = await db
      .from('profiles')
      .select('id')
      .ilike('nome', `%${userQ}%`)
      .limit(50)
    const ids = (perfisMatch || []).map(p => p.id)
    if (ids.length === 0) return NextResponse.json({ logs: [], total: 0, page, size })
    // passa lista de ids como filtro abaixo
    filtroUserId = ids.join(',')
  }

  let query = db
    .from('audit_log')
    .select('id, user_id, action, resource_id, metadata, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * size, page * size + size - 1)

  if (action)    query = query.eq('action', action)
  if (dateFrom)  query = query.gte('created_at', dateFrom + 'T00:00:00Z')
  if (dateTo)    query = query.lte('created_at', dateTo   + 'T23:59:59Z')

  if (filtroUserId) {
    const ids = filtroUserId.split(',')
    if (ids.length === 1) {
      query = query.eq('user_id', ids[0])
    } else {
      query = query.in('user_id', ids)
    }
  }

  const { data: logs, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Resolve nomes separadamente (audit_log.user_id → auth.users, não profiles)
  const userIds = [...new Set((logs || []).map(l => l.user_id))]
  const { data: perfis } = userIds.length > 0
    ? await db.from('profiles').select('id, nome').in('id', userIds)
    : { data: [] }

  const nomeMap: Record<string, string> = {}
  for (const p of perfis || []) nomeMap[p.id] = p.nome

  const logsComNome = (logs || []).map(l => ({
    ...l,
    nome_usuario: nomeMap[l.user_id] || l.user_id.slice(0, 8),
  }))

  return NextResponse.json({ logs: logsComNome, total: count ?? 0, page, size })
}
