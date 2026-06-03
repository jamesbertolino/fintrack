import { NextRequest, NextResponse } from 'next/server'
import { dbErr } from '@/lib/dbError'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { CATEGORIAS_PADRAO } from '@/lib/categorias'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data } = await supabase
    .from('categorias_personalizadas')
    .select('*')
    .eq('user_id', user.id)
    .eq('ativo', true)
    .order('created_at')

  return NextResponse.json({ categorias: data || [], padrao: CATEGORIAS_PADRAO })
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { nome, cor, icone, tipo } = await request.json()
  if (!nome?.trim()) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })

  const { data, error } = await supabase.from('categorias_personalizadas').insert({
    user_id: user.id,
    nome:    nome.trim(),
    cor:     cor    || '#6b7280',
    icone:   icone  || '📌',
    tipo:    tipo   || 'ambos',
  }).select().single()

  if (error) return NextResponse.json({ error: dbErr(error, 'salvar categoria') }, { status: 500 })
  return NextResponse.json({ categoria: data })
}
