import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { logAudit } from '@/lib/auditLog'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { transacoes, conta_id } = await request.json()
  if (!transacoes?.length) return NextResponse.json({ error: 'Nenhuma transação' }, { status: 400 })

  const inserir = transacoes.map((t: {
    descricao: string; valor: number; tipo: string; categoria: string; data_hora: string; ref_externa?: string
  }) => ({
    user_id:      user.id,
    descricao:    t.descricao.toUpperCase(),
    valor:        t.tipo === 'debito' ? -Math.abs(t.valor) : Math.abs(t.valor),
    tipo:         t.tipo,
    categoria:    t.categoria,
    data_hora:    t.data_hora || new Date().toISOString(),
    conta_id:     conta_id || null,
    origem:       'upload',
    ref_externa:  t.ref_externa || null,
  }))

  const { data, error } = await supabase.from('transactions').insert(inserir).select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  logAudit({ user_id: user.id, action: 'transaction.create', metadata: { count: data.length, origem: 'upload' } })

  return NextResponse.json({ ok: true, lançados: data.length })
}
