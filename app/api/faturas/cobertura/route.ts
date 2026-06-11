import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

/** Gera os últimos N meses no formato YYYY-MM */
function gerarMeses(n = 13): string[] {
  const meses: string[] = []
  const hoje = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
    meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return meses
}

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const meses = gerarMeses(13)
  const inicio = `${meses[0]}-01T00:00:00`
  const fimDate = new Date()
  fimDate.setDate(fimDate.getDate() + 1)
  const fim = fimDate.toISOString()

  // Busca todas as contas ativas
  const { data: contas } = await supabase
    .from('contas')
    .select('id, nome, tipo, bancos(id, nome_curto, cor)')
    .eq('user_id', user.id)
    .eq('ativo', true)
    .order('created_at')

  if (!contas?.length) return NextResponse.json({ contas: [], transferencias: [], meses })

  // Transações no período, agrupadas por conta + mês
  const { data: txs } = await supabase
    .from('transactions')
    .select('conta_id, data_hora, valor, tipo, conciliacao_id, id, descricao')
    .eq('user_id', user.id)
    .gte('data_hora', inicio)
    .lte('data_hora', fim)
    .neq('origem', 'saldo_inicial')

  // Importações no período
  const { data: importacoes } = await supabase
    .from('importacoes')
    .select('conta_id, created_at, total_inseridas, arquivo_nome')
    .eq('user_id', user.id)
    .gte('created_at', inicio)
    .lte('created_at', fim)

  // Monta cobertura por conta
  const cobertura = (contas || []).map(conta => {
    const mesCoverage: Record<string, {
      total_tx: number
      valor_debito: number
      valor_credito: number
      importacoes: number
    }> = {}

    for (const mes of meses) {
      mesCoverage[mes] = { total_tx: 0, valor_debito: 0, valor_credito: 0, importacoes: 0 }
    }

    for (const tx of txs || []) {
      if (tx.conta_id !== conta.id) continue
      const mes = tx.data_hora.slice(0, 7)
      if (!mesCoverage[mes]) continue
      mesCoverage[mes].total_tx++
      if (tx.tipo === 'debito') mesCoverage[mes].valor_debito += Math.abs(tx.valor)
      else mesCoverage[mes].valor_credito += Math.abs(tx.valor)
    }

    for (const imp of importacoes || []) {
      if (imp.conta_id !== conta.id) continue
      const mes = imp.created_at.slice(0, 7)
      if (!mesCoverage[mes]) continue
      mesCoverage[mes].importacoes++
    }

    return { ...conta, meses: mesCoverage }
  })

  // Transferências entre contas: transações com conciliacao_id preenchido
  const txComConc = (txs || []).filter(t => t.conciliacao_id)
  const transferencias: {
    data: string
    descricao: string
    valor: number
    tx_saida_id: string
    tx_entrada_id: string
    conta_saida_id: string | null
    conta_entrada_id: string | null
  }[] = []

  const vistosIds = new Set<string>()
  for (const tx of txComConc) {
    if (vistosIds.has(tx.id)) continue
    const par = (txs || []).find(t => t.id === tx.conciliacao_id)
    if (!par) continue
    vistosIds.add(tx.id)
    vistosIds.add(par.id)
    // tx = entrada (crédito no cartão), par = débito na conta corrente
    const saida  = tx.tipo === 'debito' ? tx : par
    const entrada = tx.tipo === 'credito' ? tx : par
    transferencias.push({
      data:           saida.data_hora.slice(0, 10),
      descricao:      saida.descricao,
      valor:          Math.abs(saida.valor),
      tx_saida_id:    saida.id,
      tx_entrada_id:  entrada.id,
      conta_saida_id: saida.conta_id,
      conta_entrada_id: entrada.conta_id,
    })
  }
  transferencias.sort((a, b) => b.data.localeCompare(a.data))

  // Mapa de contas para lookup nas transferências
  const contasMap = Object.fromEntries((contas || []).map(c => [c.id, c]))

  // Debug: mostra o que foi encontrado para a Nubank
  const nubankId = 'fe825c02-da1a-4dd9-8c20-74ceeb3f814b'
  const nubankCob = cobertura.find(c => c.id === nubankId)
  const _debug = {
    total_txs_na_query: txs?.length ?? 0,
    nubank_meses: nubankCob ? Object.fromEntries(
      Object.entries(nubankCob.meses).filter(([, v]) => v.total_tx > 0)
    ) : 'conta não encontrada na cobertura',
    txs_nubank_na_query: txs?.filter(t => t.conta_id === nubankId).length ?? 0,
  }

  return NextResponse.json({ contas: cobertura, transferencias, meses, contasMap, _debug })
}
