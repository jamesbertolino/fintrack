'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const MESES_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function fmtMes(yyyymm: string) {
  const [y, m] = yyyymm.split('-')
  return `${MESES_PT[parseInt(m) - 1]}/${y.slice(2)}`
}

function fmtBRL(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)
}

type MesDado = { total_tx: number; valor_debito: number; valor_credito: number; importacoes: number }
type Conta = {
  id: string; nome: string; tipo: string
  bancos: { nome_curto: string; cor: string } | null
  meses: Record<string, MesDado>
}
type Transferencia = {
  data: string; descricao: string; valor: number
  tx_saida_id: string; tx_entrada_id: string
  conta_saida_id: string | null; conta_entrada_id: string | null
}

export default function FaturasPage() {
  const router = useRouter()
  const [contas, setContas]   = useState<Conta[]>([])
  const [meses, setMeses]     = useState<string[]>([])
  const [transferencias, setTransferencias] = useState<Transferencia[]>([])
  const [contasMap, setContasMap] = useState<Record<string, Conta>>({})
  const [loading, setLoading] = useState(true)
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())
  const mesAtual = new Date().toISOString().slice(0, 7)

  useEffect(() => {
    fetch('/api/faturas/cobertura')
      .then(r => r.json())
      .then(d => {
        setContas(d.contas || [])
        setMeses(d.meses || [])
        setTransferencias(d.transferencias || [])
        setContasMap(d.contasMap || {})
        setLoading(false)
      })
  }, [])

  function toggleExpandido(id: string) {
    setExpandidos(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  function statusCell(dado: MesDado, mes: string) {
    const isFuturo = mes > mesAtual
    if (isFuturo) return 'futuro'
    if (dado.total_tx === 0 && dado.importacoes === 0) return 'ausente'
    if (dado.total_tx === 0 && dado.importacoes > 0) return 'vazio'
    return 'ok'
  }

  const cellColors: Record<string, string> = {
    ok:     'bg-emerald-900/60 text-emerald-300 border-emerald-700/50',
    ausente:'bg-red-900/40 text-red-400 border-red-700/40 cursor-pointer hover:bg-red-900/60',
    vazio:  'bg-yellow-900/40 text-yellow-400 border-yellow-700/40',
    futuro: 'bg-zinc-800/20 text-zinc-600 border-zinc-700/20',
  }

  const cellLabels: Record<string, string> = {
    ok:     '✓',
    ausente:'—',
    vazio:  '0',
    futuro: '·',
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[50vh] text-zinc-400">Carregando...</div>
  )

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto pb-24 md:pb-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-100">Controle de Faturas</h1>
          <p className="text-sm text-zinc-400 mt-0.5">Cobertura de importações por conta e mês</p>
        </div>
        <button
          onClick={() => router.push('/dashboard/lancamento')}
          className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors"
        >
          + Importar extrato
        </button>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap gap-3 mb-5 text-xs">
        {[
          { cor: 'bg-emerald-900/60 border-emerald-700/50', label: 'Importado' },
          { cor: 'bg-red-900/40 border-red-700/40', label: 'Sem dados — clique para importar' },
          { cor: 'bg-yellow-900/40 border-yellow-700/40', label: 'Import sem transações' },
          { cor: 'bg-zinc-800/20 border-zinc-700/20', label: 'Mês futuro' },
        ].map(({ cor, label }) => (
          <span key={label} className="flex items-center gap-1.5 text-zinc-400">
            <span className={`inline-block w-3 h-3 rounded border ${cor}`} />
            {label}
          </span>
        ))}
      </div>

      {/* Timeline grid */}
      {contas.length === 0 ? (
        <div className="text-zinc-400 text-sm text-center py-16">Nenhuma conta cadastrada.</div>
      ) : (
        <div className="rounded-xl border border-zinc-700/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-zinc-800/60">
                  <th className="text-left px-3 py-2.5 text-zinc-400 font-medium min-w-[140px] sticky left-0 bg-zinc-800/80 z-10">
                    Conta
                  </th>
                  {meses.map(mes => (
                    <th key={mes} className={`px-2 py-2.5 text-center font-medium min-w-[52px] ${mes === mesAtual ? 'text-indigo-300' : 'text-zinc-400'}`}>
                      {fmtMes(mes)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contas.map((conta, idx) => (
                  <>
                    <tr
                      key={conta.id}
                      className={`border-t border-zinc-700/30 ${idx % 2 === 0 ? 'bg-zinc-900/40' : 'bg-zinc-800/20'}`}
                    >
                      {/* Conta label */}
                      <td className={`px-3 py-2 sticky left-0 z-10 ${idx % 2 === 0 ? 'bg-zinc-900/80' : 'bg-zinc-800/60'}`}>
                        <div className="flex items-center gap-2">
                          {conta.bancos?.cor && (
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: conta.bancos.cor }}
                            />
                          )}
                          <div>
                            <div className="text-zinc-200 font-medium leading-tight">{conta.nome}</div>
                            {conta.bancos && (
                              <div className="text-zinc-500 text-[10px]">{conta.bancos.nome_curto} · {conta.tipo}</div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Células de mês */}
                      {meses.map(mes => {
                        const dado = conta.meses[mes] || { total_tx: 0, valor_debito: 0, valor_credito: 0, importacoes: 0 }
                        const status = statusCell(dado, mes)
                        return (
                          <td key={mes} className="px-1 py-1.5 text-center">
                            <button
                              disabled={status === 'futuro' || status === 'ok' || status === 'vazio'}
                              onClick={() => router.push('/dashboard/lancamento')}
                              title={
                                status === 'ok'
                                  ? `${dado.total_tx} transações\nGastos: ${fmtBRL(dado.valor_debito)}\nEntradas: ${fmtBRL(dado.valor_credito)}`
                                  : status === 'ausente' ? 'Clique para importar este mês'
                                  : ''
                              }
                              className={`w-full rounded border px-1 py-1.5 text-center leading-none transition-colors ${cellColors[status]}`}
                            >
                              <div className="font-semibold">{cellLabels[status]}</div>
                              {status === 'ok' && dado.valor_debito > 0 && (
                                <div className="text-[9px] text-emerald-400/70 mt-0.5 truncate">
                                  {fmtBRL(dado.valor_debito)}
                                </div>
                              )}
                              {status === 'ausente' && (
                                <div className="text-[9px] text-red-400/70 mt-0.5">imp</div>
                              )}
                            </button>
                          </td>
                        )
                      })}
                    </tr>

                    {/* Linha de detalhes expandível */}
                    {expandidos.has(conta.id) && (
                      <tr key={`${conta.id}-exp`} className="border-t border-zinc-700/20 bg-zinc-900/60">
                        <td colSpan={meses.length + 1} className="px-3 py-2">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-zinc-400">
                            {meses.filter(m => (conta.meses[m]?.total_tx || 0) > 0).map(m => {
                              const d = conta.meses[m]
                              return (
                                <div key={m} className="bg-zinc-800/60 rounded p-2">
                                  <div className="text-zinc-300 font-medium mb-1">{fmtMes(m)}</div>
                                  <div>{d.total_tx} transações</div>
                                  {d.valor_debito > 0 && <div className="text-red-400">−{fmtBRL(d.valor_debito)}</div>}
                                  {d.valor_credito > 0 && <div className="text-emerald-400">+{fmtBRL(d.valor_credito)}</div>}
                                </div>
                              )
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {/* Toggle detalhes por conta */}
          <div className="px-3 py-2 border-t border-zinc-700/30 flex flex-wrap gap-2">
            {contas.map(conta => (
              <button
                key={conta.id}
                onClick={() => toggleExpandido(conta.id)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  expandidos.has(conta.id)
                    ? 'bg-indigo-900/50 border-indigo-600/50 text-indigo-300'
                    : 'bg-zinc-800/40 border-zinc-600/40 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {expandidos.has(conta.id) ? '▾' : '▸'} {conta.nome}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Transferências entre contas */}
      {transferencias.length > 0 && (
        <div className="mt-8">
          <h2 className="text-base font-semibold text-zinc-200 mb-3">
            Transferências entre contas
            <span className="ml-2 text-xs text-zinc-500 font-normal">pagamentos de fatura e movimentações vinculadas</span>
          </h2>
          <div className="space-y-2">
            {transferencias.map(tr => {
              const contaSaida  = contasMap[tr.conta_saida_id || '']
              const contaEntrada = contasMap[tr.conta_entrada_id || '']
              const key = `${tr.tx_saida_id}-${tr.tx_entrada_id}`
              const expandido = expandidos.has(key)
              const dtFmt = `${tr.data.slice(8,10)}/${tr.data.slice(5,7)}/${tr.data.slice(0,4)}`
              return (
                <div key={key} className="rounded-xl border border-zinc-700/40 bg-zinc-800/30 overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-zinc-700/20 transition-colors"
                    onClick={() => toggleExpandido(key)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">↔</span>
                      <div>
                        <div className="text-sm text-zinc-200 font-medium">{tr.descricao}</div>
                        <div className="text-xs text-zinc-500 mt-0.5">{dtFmt}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-base font-semibold text-zinc-200">{fmtBRL(tr.valor)}</span>
                      <span className="text-zinc-500 text-sm">{expandido ? '▾' : '▸'}</span>
                    </div>
                  </button>

                  {expandido && (
                    <div className="border-t border-zinc-700/40 px-4 py-3 grid grid-cols-2 gap-4 bg-zinc-900/40">
                      {/* Saída */}
                      <div className="flex items-start gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                        <div>
                          <div className="text-xs text-zinc-400 mb-0.5">Saiu de</div>
                          {contaSaida ? (
                            <>
                              <div className="text-sm text-zinc-200 font-medium">{contaSaida.nome}</div>
                              {contaSaida.bancos && (
                                <div className="text-xs text-zinc-500">{contaSaida.bancos.nome_curto}</div>
                              )}
                            </>
                          ) : (
                            <div className="text-sm text-zinc-400 italic">conta não vinculada</div>
                          )}
                          <div className="text-sm text-red-400 font-semibold mt-1">−{fmtBRL(tr.valor)}</div>
                        </div>
                      </div>

                      {/* Entrada */}
                      <div className="flex items-start gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                        <div>
                          <div className="text-xs text-zinc-400 mb-0.5">Entrou em</div>
                          {contaEntrada ? (
                            <>
                              <div className="text-sm text-zinc-200 font-medium">{contaEntrada.nome}</div>
                              {contaEntrada.bancos && (
                                <div className="text-xs text-zinc-500">{contaEntrada.bancos.nome_curto}</div>
                              )}
                            </>
                          ) : (
                            <div className="text-sm text-zinc-400 italic">conta não vinculada</div>
                          )}
                          <div className="text-sm text-emerald-400 font-semibold mt-1">+{fmtBRL(tr.valor)}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {transferencias.length === 0 && (
        <div className="mt-8 rounded-xl border border-zinc-700/30 bg-zinc-800/20 p-6 text-center">
          <div className="text-zinc-500 text-sm">
            Nenhuma transferência entre contas detectada no período.
          </div>
          <div className="text-zinc-600 text-xs mt-1">
            Transferências são detectadas automaticamente ao importar faturas de cartão.
          </div>
        </div>
      )}
    </div>
  )
}
