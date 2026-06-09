'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useIsMobile } from '@/hooks/useIsMobile'

const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function fmtMes(yyyymm: string) {
  const [y, m] = yyyymm.split('-')
  return `${MESES_PT[parseInt(m) - 1]} ${y}`
}
function fmtBRL(v: number) {
  return 'R$ ' + Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

type MesDado    = { total_tx: number; valor_debito: number; valor_credito: number; importacoes: number }
type Conta      = { id: string; nome: string; tipo: string; bancos: { nome_curto: string; cor: string } | null; meses: Record<string, MesDado> }
type Transferencia = { data: string; descricao: string; valor: number; tx_saida_id: string; tx_entrada_id: string; conta_saida_id: string | null; conta_entrada_id: string | null }

export default function FaturasPage() {
  const router    = useRouter()
  const isMobile  = useIsMobile(640)
  const [contas, setContas]             = useState<Conta[]>([])
  const [meses, setMeses]               = useState<string[]>([])
  const [transferencias, setTransferencias] = useState<Transferencia[]>([])
  const [contasMap, setContasMap]       = useState<Record<string, Conta>>({})
  const [loading, setLoading]           = useState(true)
  const [expandidos, setExpandidos]     = useState<Set<string>>(new Set())
  const mesAtual = new Date().toISOString().slice(0, 7)

  useEffect(() => {
    fetch('/api/faturas/cobertura').then(r => r.json()).then(d => {
      setContas(d.contas || [])
      setMeses(d.meses || [])
      setTransferencias(d.transferencias || [])
      setContasMap(d.contasMap || {})
      setLoading(false)
    })
  }, [])

  function toggle(id: string) {
    setExpandidos(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  const maxDebito = Math.max(1, ...contas.flatMap(c => meses.map(m => c.meses[m]?.valor_debito || 0)))

  return (
    <div className="dashboard-page-body" style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: 'system-ui, sans-serif', fontSize: 15, color: '#fff' }}>

      {/* Topbar — igual ao padrão das outras páginas */}
      <div style={{ borderBottom: '1px solid #1a1a2e', background: '#0a0a0a' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.875rem 1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => router.push('/dashboard')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.4)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Dashboard
            </button>
            <span style={{ color: 'rgba(255,255,255,.2)' }}>/</span>
            <span style={{ fontSize: 15, fontWeight: 500 }}>Faturas</span>
          </div>
          <button
            onClick={() => router.push('/dashboard/lancamento')}
            style={{ background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            + Importar extrato
          </button>
        </div>
      </div>

      {/* Corpo */}
      <div style={{ padding: isMobile ? '16px 12px' : '20px 24px', maxWidth: 800, margin: '0 auto', paddingBottom: 96 }}>

        {loading ? (
          <div style={{ color: 'rgba(255,255,255,.3)', textAlign: 'center', paddingTop: 64 }}>Carregando...</div>
        ) : contas.length === 0 ? (
          <div style={{ color: 'rgba(255,255,255,.3)', textAlign: 'center', paddingTop: 64 }}>
            <p>Nenhuma conta cadastrada.</p>
            <button onClick={() => router.push('/dashboard/contas')} style={{ marginTop: 12, background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>
              Cadastrar conta
            </button>
          </div>
        ) : (
          <>
            {/* Legenda */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 20, fontSize: 12, color: 'rgba(255,255,255,.4)' }}>
              {[
                { bg: '#16a34a', label: 'Importado' },
                { bg: '#dc2626', label: 'Sem dados — clique para importar' },
                { bg: '#d97706', label: 'Importado, sem transações' },
                { bg: '#3f3f46', label: 'Mês futuro' },
              ].map(({ bg, label }) => (
                <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: bg, display: 'inline-block', flexShrink: 0 }} />
                  {label}
                </span>
              ))}
            </div>

            {/* Cards mensais — mais recente primeiro */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[...meses].reverse().map(mes => {
                const isFuturo  = mes > mesAtual
                const isAtual   = mes === mesAtual
                const exp       = expandidos.has(mes)
                const contasComDados = contas.filter(c => (c.meses[mes]?.total_tx || 0) > 0)
                const totalGasto = contas.reduce((s, c) => s + (c.meses[mes]?.valor_debito || 0), 0)

                return (
                  <div
                    key={mes}
                    style={{
                      borderRadius: 12,
                      border: isAtual ? '1px solid rgba(99,102,241,.45)' : '1px solid rgba(255,255,255,.08)',
                      background: 'rgba(255,255,255,.03)',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Header clicável */}
                    <button
                      onClick={() => !isFuturo && toggle(mes)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 16px', background: 'transparent', border: 'none',
                        cursor: isFuturo ? 'default' : 'pointer', color: '#fff', textAlign: 'left', gap: 8,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <span style={{ fontWeight: 600, fontSize: 14, color: isAtual ? '#a5b4fc' : isFuturo ? 'rgba(255,255,255,.2)' : '#fff' }}>
                          {fmtMes(mes)}
                        </span>
                        {isAtual && (
                          <span style={{ fontSize: 10, background: 'rgba(99,102,241,.2)', color: '#a5b4fc', borderRadius: 4, padding: '1px 6px', whiteSpace: 'nowrap' }}>
                            mês atual
                          </span>
                        )}
                        {!isFuturo && (
                          <span style={{ fontSize: 12, color: contasComDados.length > 0 ? 'rgba(255,255,255,.35)' : '#f87171' }}>
                            {contasComDados.length > 0
                              ? `${contasComDados.length}/${contas.length} conta${contas.length > 1 ? 's' : ''}`
                              : 'sem dados'}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                        {totalGasto > 0 && (
                          <span style={{ fontSize: 13, color: 'rgba(255,255,255,.5)' }}>{fmtBRL(totalGasto)}</span>
                        )}
                        {!isFuturo && (
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,.25)' }}>{exp ? '▾' : '▸'}</span>
                        )}
                      </div>
                    </button>

                    {/* Barras resumo (sempre visível quando não expandido e não futuro) */}
                    {!exp && !isFuturo && (
                      <div style={{ padding: '0 16px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {contas.map(conta => {
                          const d      = conta.meses[mes]
                          const temTx  = (d?.total_tx || 0) > 0
                          const pct    = temTx ? Math.max(3, Math.round((d.valor_debito / maxDebito) * 100)) : 0
                          const cor    = conta.bancos?.cor || '#6366f1'
                          return (
                            <div key={conta.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', width: isMobile ? 72 : 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                {conta.bancos?.nome_curto || conta.nome}
                              </span>
                              <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,.06)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                                {temTx ? (
                                  <div style={{ height: '100%', width: `${pct}%`, background: cor, borderRadius: 4 }} />
                                ) : (
                                  <div style={{ height: '100%', width: '100%', background: 'rgba(220,38,38,.12)', borderRadius: 4 }} />
                                )}
                              </div>
                              <span style={{ fontSize: 11, color: temTx ? 'rgba(255,255,255,.4)' : '#f87171', width: isMobile ? 60 : 80, textAlign: 'right', flexShrink: 0 }}>
                                {temTx ? fmtBRL(d.valor_debito) : '—'}
                              </span>
                              {!temTx && (
                                <button
                                  onClick={e => { e.stopPropagation(); router.push('/dashboard/lancamento') }}
                                  style={{ fontSize: 10, color: '#f87171', background: 'rgba(220,38,38,.12)', border: '1px solid rgba(220,38,38,.3)', borderRadius: 4, padding: '2px 7px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
                                >
                                  imp
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Detalhe expandido */}
                    {exp && (
                      <div style={{ borderTop: '1px solid rgba(255,255,255,.06)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {contas.map(conta => {
                          const d     = conta.meses[mes]
                          const temTx = (d?.total_tx || 0) > 0
                          const pct   = temTx ? Math.max(3, Math.round((d.valor_debito / maxDebito) * 100)) : 0
                          const cor   = conta.bancos?.cor || '#6366f1'
                          return (
                            <div key={conta.id} style={{ background: 'rgba(255,255,255,.04)', borderRadius: 8, padding: '10px 12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: temTx ? 8 : 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  {conta.bancos?.cor && <span style={{ width: 8, height: 8, borderRadius: '50%', background: conta.bancos.cor, display: 'inline-block' }} />}
                                  <span style={{ fontSize: 13, fontWeight: 600 }}>{conta.nome}</span>
                                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>{conta.bancos?.nome_curto}</span>
                                </div>
                                {!temTx && (
                                  <button
                                    onClick={() => router.push('/dashboard/lancamento')}
                                    style={{ fontSize: 11, color: '#f87171', background: 'rgba(220,38,38,.12)', border: '1px solid rgba(220,38,38,.3)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}
                                  >
                                    Importar
                                  </button>
                                )}
                              </div>
                              {temTx ? (
                                <>
                                  <div style={{ height: 8, background: 'rgba(255,255,255,.06)', borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
                                    <div style={{ height: '100%', width: `${pct}%`, background: cor, borderRadius: 4 }} />
                                  </div>
                                  <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'rgba(255,255,255,.4)' }}>
                                    <span>{d.total_tx} transações</span>
                                    {d.valor_debito  > 0 && <span style={{ color: '#f87171' }}>−{fmtBRL(d.valor_debito)}</span>}
                                    {d.valor_credito > 0 && <span style={{ color: '#4ade80' }}>+{fmtBRL(d.valor_credito)}</span>}
                                  </div>
                                </>
                              ) : (
                                <p style={{ fontSize: 12, color: 'rgba(255,255,255,.2)', margin: 0 }}>Nenhuma importação</p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {isFuturo && (
                      <div style={{ padding: '0 16px 10px' }}>
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,.15)' }}>Mês ainda não disponível</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Transferências entre contas */}
            {transferencias.length > 0 && (
              <div style={{ marginTop: 32 }}>
                <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 12px', color: 'rgba(255,255,255,.8)' }}>
                  Transferências entre contas
                  <span style={{ fontSize: 12, fontWeight: 400, color: 'rgba(255,255,255,.3)', marginLeft: 8 }}>pagamentos de fatura detectados</span>
                </h2>
                {transferencias.map(tr => {
                  const saida   = contasMap[tr.conta_saida_id   || '']
                  const entrada = contasMap[tr.conta_entrada_id || '']
                  const key     = `${tr.tx_saida_id}-${tr.tx_entrada_id}`
                  const exp     = expandidos.has(key)
                  const dtFmt   = `${tr.data.slice(8,10)}/${tr.data.slice(5,7)}/${tr.data.slice(0,4)}`
                  return (
                    <div key={key} style={{ borderRadius: 10, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.03)', overflow: 'hidden', marginBottom: 8 }}>
                      <button
                        onClick={() => toggle(key)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#fff', textAlign: 'left' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 18, lineHeight: 1 }}>↔</span>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500 }}>{tr.descricao}</div>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', marginTop: 2 }}>{dtFmt}</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 14, fontWeight: 600 }}>{fmtBRL(tr.valor)}</span>
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,.25)' }}>{exp ? '▾' : '▸'}</span>
                        </div>
                      </button>
                      {exp && (
                        <div style={{ borderTop: '1px solid rgba(255,255,255,.06)', padding: '12px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                          {[
                            { cor: '#ef4444', label: 'Saiu de',   conta: saida,   val: `-${fmtBRL(tr.valor)}`, valCor: '#f87171' },
                            { cor: '#22c55e', label: 'Entrou em', conta: entrada, val: `+${fmtBRL(tr.valor)}`, valCor: '#4ade80' },
                          ].map(({ cor, label, conta, val, valCor }) => (
                            <div key={label} style={{ display: 'flex', gap: 8 }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: cor, marginTop: 5, flexShrink: 0 }} />
                              <div>
                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', marginBottom: 2 }}>{label}</div>
                                <div style={{ fontSize: 13, fontWeight: 500 }}>{conta?.nome || <em style={{ color: 'rgba(255,255,255,.3)', fontStyle: 'italic' }}>não vinculada</em>}</div>
                                {conta?.bancos && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>{conta.bancos.nome_curto}</div>}
                                <div style={{ fontSize: 13, fontWeight: 600, color: valCor, marginTop: 4 }}>{val}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {transferencias.length === 0 && (
              <div style={{ marginTop: 32, borderRadius: 10, border: '1px solid rgba(255,255,255,.06)', background: 'rgba(255,255,255,.02)', padding: '20px', textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,.25)' }}>Nenhuma transferência entre contas detectada.</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.15)', marginTop: 4 }}>Detectadas automaticamente ao importar faturas de cartão.</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
