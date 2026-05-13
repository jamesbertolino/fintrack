import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params

  // Garante que a importação pertence ao usuário
  const { data: imp } = await supabase
    .from('importacoes').select('id').eq('id', id).eq('user_id', user.id).single()
  if (!imp) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  const { data: transacoes } = await supabase
    .from('transactions')
    .select('id, descricao, valor, tipo, categoria, data_hora, ref_externa')
    .eq('importacao_id', id)
    .order('data_hora', { ascending: false })

  return NextResponse.json({ transacoes: transacoes || [] })
}
