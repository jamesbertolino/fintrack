import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  // Todas as contas
  const { data: contas } = await supabase
    .from('contas')
    .select('id, nome, tipo, ativo, bancos(nome_curto)')
    .eq('user_id', user.id)
    .order('created_at')

  // Todas as importações
  const { data: importacoes } = await supabase
    .from('importacoes')
    .select('id, conta_id, arquivo_nome, created_at, total_inseridas, total_duplicatas')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  // Transações agrupadas por conta_id (conta quantas há por conta)
  const { data: txSample } = await supabase
    .from('transactions')
    .select('id, conta_id, data_hora, tipo, valor, origem')
    .eq('user_id', user.id)
    .neq('origem', 'saldo_inicial')
    .order('data_hora', { ascending: false })
    .limit(50)

  const txPorConta: Record<string, number> = {}
  const txSemConta = txSample?.filter(t => !t.conta_id).length || 0
  for (const tx of txSample || []) {
    if (!tx.conta_id) continue
    txPorConta[tx.conta_id] = (txPorConta[tx.conta_id] || 0) + 1
  }

  return NextResponse.json({
    user_id: user.id,
    contas: (contas || []).map(c => ({
      id: c.id,
      nome: c.nome,
      tipo: c.tipo,
      ativo: c.ativo,
      banco: (c.bancos as unknown as { nome_curto: string } | null)?.nome_curto,
      tx_nas_ultimas_50: txPorConta[c.id] || 0,
    })),
    importacoes_recentes: (importacoes || []).map(i => ({
      id: i.id,
      conta_id: i.conta_id,
      arquivo: i.arquivo_nome,
      data: i.created_at?.slice(0, 10),
      inseridas: i.total_inseridas,
      duplicatas: i.total_duplicatas,
      conta_nome: contas?.find(c => c.id === i.conta_id)?.nome || (i.conta_id ? '(não encontrada)' : 'SEM CONTA'),
    })),
    tx_sem_conta_vinculada: txSemConta,
  })
}
