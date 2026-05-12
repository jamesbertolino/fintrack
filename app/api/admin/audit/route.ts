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
    .select('id, user_id, action, resource_id, metadata, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * size, page * size + size - 1)

  if (action) query = query.eq('action', action)

  const { data: logs, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Busca nomes dos usuários separadamente (audit_log referencia auth.users, não profiles)
  const userIds = [...new Set((logs || []).map(l => l.user_id))]
  const { data: perfis } = userIds.length > 0
    ? await db.from('profiles').select('id, nome').in('id', userIds)
    : { data: [] }

  const nomeMap: Record<string, string> = {}
  for (const p of perfis || []) nomeMap[p.id] = p.nome

  const logsComNome = (logs || []).map(l => ({ ...l, nome_usuario: nomeMap[l.user_id] || l.user_id.slice(0, 8) }))

  return NextResponse.json({ logs: logsComNome, total: count ?? 0, page, size })
}
