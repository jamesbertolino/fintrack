import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// POST /api/orcamento/duplicar — copia orçamentos do mês anterior para o mês atual
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { mes } = await request.json() // mes de destino (YYYY-MM)
  if (!mes) return NextResponse.json({ error: 'Mês obrigatório' }, { status: 400 })

  const [ano, mm] = mes.split('-').map(Number)
  const mesAnterior = mm === 1
    ? `${ano - 1}-12`
    : `${ano}-${String(mm - 1).padStart(2, '0')}`

  const { data: origem } = await supabase.from('orcamentos')
    .select('categoria, valor_planejado, limite')
    .eq('user_id', user.id)
    .eq('mes', mesAnterior)

  if (!origem?.length)
    return NextResponse.json({ error: 'Nenhum orçamento encontrado no mês anterior' }, { status: 404 })

  const registros = origem.map(o => ({
    user_id: user.id,
    categoria: o.categoria,
    valor_planejado: o.valor_planejado,
    limite: o.limite ?? o.valor_planejado,
    mes,
    mes_num: mm,
    ano,
  }))

  const { error } = await supabase.from('orcamentos')
    .upsert(registros, { onConflict: 'user_id,categoria,mes' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, copiados: registros.length })
}
