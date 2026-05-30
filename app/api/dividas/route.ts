import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data, error } = await supabase
    .from('dividas')
    .select('*')
    .eq('user_id', user.id)
    .eq('ativo', true)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ dividas: data || [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { nome, saldo, taxa_juros, pagamento_minimo } = await request.json()
  if (!nome || saldo == null || taxa_juros == null || pagamento_minimo == null) {
    return NextResponse.json({ error: 'Campos obrigatórios: nome, saldo, taxa_juros, pagamento_minimo' }, { status: 400 })
  }
  if (saldo <= 0) return NextResponse.json({ error: 'Saldo deve ser maior que zero' }, { status: 400 })
  if (taxa_juros < 0) return NextResponse.json({ error: 'Taxa de juros não pode ser negativa' }, { status: 400 })
  if (pagamento_minimo <= 0) return NextResponse.json({ error: 'Pagamento mínimo deve ser maior que zero' }, { status: 400 })

  const { data, error } = await supabase.from('dividas').insert({
    user_id: user.id, nome, saldo, taxa_juros, pagamento_minimo,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ divida: data })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await request.json()
  const { error } = await supabase.from('dividas').update({ ativo: false }).eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
