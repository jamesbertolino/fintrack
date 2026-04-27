import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { transacoes } = await request.json()
  if (!transacoes?.length) return NextResponse.json({ error: 'Nenhuma transação' }, { status: 400 })

  const inserir = transacoes.map((t: {
    descricao: string; valor: number; tipo: string; categoria: string; data_hora: string
  }) => ({
    user_id:   user.id,
    descricao: t.descricao,
    valor:     t.tipo === 'debito' ? -Math.abs(t.valor) : Math.abs(t.valor),
    tipo:      t.tipo,
    categoria: t.categoria,
    data_hora: t.data_hora || new Date().toISOString(),
    origem:    'upload',
  }))

  const { data, error } = await supabase.from('transactions').insert(inserir).select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, lançados: data.length })
}
