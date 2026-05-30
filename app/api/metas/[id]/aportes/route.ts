import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const { data, error } = await supabase
    .from('meta_aportes')
    .select('*')
    .eq('meta_id', id)
    .eq('user_id', user.id)
    .order('data', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ aportes: data || [] })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const { valor, nota, data } = await request.json()
  if (!valor || valor <= 0) return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })

  // verify meta belongs to user
  const { data: meta } = await supabase.from('goals').select('id, valor_atual').eq('id', id).eq('user_id', user.id).single()
  if (!meta) return NextResponse.json({ error: 'Meta não encontrada' }, { status: 404 })

  const [{ data: aporte, error: errAporte }] = await Promise.all([
    supabase.from('meta_aportes').insert({ meta_id: id, user_id: user.id, valor, nota: nota || null, data: data || new Date().toISOString().slice(0, 10) }).select().single(),
  ])
  if (errAporte) return NextResponse.json({ error: errAporte.message }, { status: 500 })

  // update valor_atual on goals
  const novoValor = (meta.valor_atual || 0) + valor
  const { error: errMeta } = await supabase.from('goals').update({ valor_atual: novoValor }).eq('id', id)
  if (errMeta) return NextResponse.json({ error: errMeta.message }, { status: 500 })

  return NextResponse.json({ aporte, valor_atual: novoValor })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const { aporte_id } = await request.json()

  // get aporte value before deleting
  const { data: aporte } = await supabase.from('meta_aportes').select('valor, meta_id').eq('id', aporte_id).eq('user_id', user.id).single()
  if (!aporte) return NextResponse.json({ error: 'Aporte não encontrado' }, { status: 404 })

  const { error: errDel } = await supabase.from('meta_aportes').delete().eq('id', aporte_id).eq('user_id', user.id)
  if (errDel) return NextResponse.json({ error: errDel.message }, { status: 500 })

  // revert valor_atual
  const { data: meta } = await supabase.from('goals').select('valor_atual').eq('id', id).single()
  if (meta) {
    const novoValor = Math.max(0, (meta.valor_atual || 0) - aporte.valor)
    const { error: errMeta } = await supabase.from('goals').update({ valor_atual: novoValor }).eq('id', id)
    if (errMeta) return NextResponse.json({ error: errMeta.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
