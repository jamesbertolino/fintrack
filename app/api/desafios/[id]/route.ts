import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { logAudit } from '@/lib/auditLog'

// POST /api/desafios/[id]/abandonar  (body: { acao: 'abandonar' })
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params

  const { error } = await supabase
    .from('desafios_usuario')
    .update({ status: 'abandonado' })
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('status', 'ativo')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  logAudit({ user_id: user.id, action: 'desafio.abandonado', resource_id: id })

  return NextResponse.json({ ok: true })
}
