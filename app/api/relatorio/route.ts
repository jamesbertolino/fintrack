import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const ano = parseInt(searchParams.get('ano') || String(new Date().getFullYear()))
  const mes = parseInt(searchParams.get('mes') || String(new Date().getMonth() + 1))

  const inicio = new Date(ano, mes - 1, 1).toISOString()
  const fim    = new Date(ano, mes, 0, 23, 59, 59).toISOString()

  const [profileRes, txRes, metasRes, orcRes] = await Promise.all([
    supabase.from('profiles')
      .select('nome, sobrenome, plano, whatsapp')
      .eq('id', user.id).single(),
    supabase.from('transactions')
      .select('descricao, valor, tipo, categoria, data_hora')
      .eq('user_id', user.id)
      .gte('data_hora', inicio).lte('data_hora', fim)
      .order('data_hora', { ascending: false }),
    supabase.from('goals')
      .select('nome, valor_total, valor_atual, contribuicao_mensal, prazo, ativo')
      .eq('user_id', user.id).eq('ativo', true),
    supabase.from('orcamentos')
      .select('categoria, valor_limite')
      .eq('user_id', user.id),
  ])

  const profile = profileRes.data
  const txs     = txRes.data || []
  const metas   = metasRes.data || []
  const orc     = orcRes.data || []

  // Totais
  const receitas  = txs.filter(t => t.tipo === 'credito').reduce((a, t) => a + t.valor, 0)
  const despesas  = txs.filter(t => t.tipo === 'debito').reduce((a, t) => a + Math.abs(t.valor), 0)
  const saldo     = receitas - despesas

  // Gastos por categoria
  const porCategoria: Record<string, number> = {}
  for (const t of txs.filter(t => t.tipo === 'debito')) {
    const cat = t.categoria || 'Outros'
    porCategoria[cat] = (porCategoria[cat] || 0) + Math.abs(t.valor)
  }
  const categorias = Object.entries(porCategoria)
    .sort((a, b) => b[1] - a[1])
    .map(([nome, valor]) => {
      const limite = orc.find(o => o.categoria === nome)?.valor_limite ?? null
      return { nome, valor, limite, pct: limite > 0 ? Math.round((valor / limite) * 100) : null }
    })

  return NextResponse.json({
    periodo: { ano, mes },
    usuario: { nome: `${profile?.nome || ''} ${profile?.sobrenome || ''}`.trim(), plano: profile?.plano },
    resumo: { receitas, despesas, saldo },
    categorias,
    transacoes: txs,
    metas,
  })
}
