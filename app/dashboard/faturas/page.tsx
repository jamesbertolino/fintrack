'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useIsMobile } from '@/hooks/useIsMobile'

const MESES_PT   = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function fmtMes(yyyymm: string) {
  const [y, m] = yyyymm.split('-')
  return `${MESES_FULL[parseInt(m) - 1]} de ${y}`
}
function fmtMesCurto(yyyymm: string) {
  const [, m] = yyyymm.split('-')
  return MESES_PT[parseInt(m) - 1]
}
function fmtAno(yyyymm: string) {
  return yyyymm.slice(2, 4)
}
function fmtBRL(v: number) {
  return 'R$ ' + Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtBRLCurto(v: number) {
  return 'R$ ' + Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

type MesDado    = { total_tx: number; valor_debito: number; valor_credito: number; importacoes: number }
type Conta      = { id: string; nome: string; tipo: string; bancos: { nome_curto: string; cor: string } | null; meses: Record<string, MesDado> }
type Transferencia = { data: string; descricao: string; valor: number; tx_saida_id: string; tx_entrada_id: string; conta_saida_id: string | null; conta_entrada_id: string | null }

export default function FaturasPage() {
  const router    = useRouter()
  const isMobile  = useIsMobile(640)
  const chartRef  = useRef<HTMLDivElement>(null)

  const [contas, setContas]                 = useState<Conta[]>([])
  const [meses, setMeses]                   = useState<string[]>([])
  const [transferencias, setTransferencias] = useState<Transferencia[]>([])
  const [contasMap, setContasMap]           = useState<Record<string, Conta>>({})
  const [loading, setLoading]               = useState(true)
  const [mesSel, setMesSel]                 = useState<string>('')
  const [showDropdown, setShowDropdown]     = useState(false)
  const [showGrafico, setShowGrafico]       = useState(true)
  const [expandidos, setExpandidos]         = useState<Set<string>>(new Set())
  const [abaAtiva, setAbaAtiva]             = useState<'tudo' | 'cartoes'>('cartoes')

  const mesAtual = new Date().toISOString().slice(0, 7)

  useEffect(() => {
    fetch('/api/faturas/cobertura').then(r => r.json()).then(d => {
      setContas(d.contas || [])
      setMeses(d.meses || [])
      setTransferencias(d.transferencias || [])
      setContasMap(d.contasMap || {})
      const todos: string[] = d.meses || []
      const passados = [...todos].reverse().filter((m: string) => m <= new Date().toISOString().slice(0, 7))
      setMesSel(passados[0] || todos[todos.length - 1] || '')
      setLoading(false)
    })
  }, [])

  // Scroll chart para o mês selecionado
  useEffect(() => {
    if (!chartRef.current || !mesSel || !meses.length) return
    const mesesRev = [...meses].reverse()
    const idx = mesesRev.indexOf(mesSel)
    if (idx < 0) return
    const el = chartRef.current.children[idx] as HTMLElement
    if (el) el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [mesSel, meses])

  function toggle(id: string) {
    setExpandidos(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  const mesesRev   = [...meses].reverse()
  const maxDebito  = Math.max(1, ...contas.flatMap(c => meses.map(m => c.meses[m]?.valor_debito || 0)))
  const totalMesSel = contas.reduce((s, c) => s + (c.meses[mesSel]?.valor_debito || 0), 0)

  const contasVisiveis = abaAtiva === 'cartoes'
    ? contas.filter(c => c.tipo === 'crédito' || c.tipo === 'credito')
    : contas

  const PURPLE = '#8b5cf6'
  const PURPLE_DIM = 'rgba(139,92,246,.22)'

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: 'system-ui, sans-serif', fontSize: 15, color: '#fff' }}>

      {/* Topbar */}
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
            style={{ background: PURPLE, color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            + Importar
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ color: 'rgba(255,255,255,.3)', textAlign: 'center', paddingTop: 64 }}>Carregando...</div>
      ) : contas.length === 0 ? (
        <div style={{ color: 'rgba(255,255,255,.3)', textAlign: 'center', paddingTop: 64 }}>
          <p>Nenhuma conta cadastrada.</p>
          <button onClick={() => router.push('/dashboard/contas')} style={{ marginTop: 12, background: PURPLE, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>
            Cadastrar conta
          </button>
        </div>
      ) : (
        <div style={{ maxWidth: 600, margin: '0 auto', paddingBottom: 48 }}>

          {/* Seletor de mês + toggle gráfico */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 16px 0' }}>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowDropdown(v => !v)}
                style={{
                  background: 'rgba(255,255,255,.07)', border: '1.5px solid rgba(255,255,255,.14)',
                  borderRadius: 20, padding: '7px 14px 7px 16px', color: '#fff',
                  fontSize: 14, fontWeight: 500, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {mesSel ? fmtMes(mesSel) : '—'}
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {showDropdown && (
                <div
                  style={{
                    position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50,
                    background: '#161625', border: '1px solid rgba(255,255,255,.1)',
                    borderRadius: 14, overflow: 'hidden', minWidth: 220,
                    boxShadow: '0 12px 40px rgba(0,0,0,.7)',
                  }}
                >
                  {mesesRev.map(m => (
                    <button
                      key={m}
                      onClick={() => { setMesSel(m); setShowDropdown(false) }}
                      style={{
                        display: 'block', width: '100%', padding: '11px 18px',
                        background: m === mesSel ? 'rgba(139,92,246,.18)' : 'transparent',
                        border: 'none',
                        color: m === mesSel ? '#c4b5fd' : m > mesAtual ? 'rgba(255,255,255,.3)' : '#fff',
                        fontSize: 14, cursor: m > mesAtual ? 'default' : 'pointer', textAlign: 'left',
                        fontWeight: m === mesSel ? 600 : 400,
                      }}
                    >
                      {fmtMes(m)}
                      {m === mesAtual && <span style={{ marginLeft: 8, fontSize: 11, color: '#a78bfa' }}>atual</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => setShowGrafico(v => !v)}
              style={{
                background: showGrafico ? 'rgba(139,92,246,.18)' : 'rgba(255,255,255,.06)',
                border: `1.5px solid ${showGrafico ? 'rgba(139,92,246,.45)' : 'rgba(255,255,255,.12)'}`,
                borderRadius: 20, padding: '7px 14px', cursor: 'pointer',
                color: showGrafico ? '#c4b5fd' : 'rgba(255,255,255,.45)',
                fontSize: 14, display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              {showGrafico && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
              Gráfico
            </button>
          </div>

          {/* Gráfico de barras horizontal */}
          {showGrafico && (
            <div style={{ padding: '20px 0 0' }}>
              <div
                ref={chartRef}
                style={{
                  display: 'flex', alignItems: 'flex-end', gap: isMobile ? 4 : 6,
                  overflowX: 'auto', padding: '0 16px 4px',
                  scrollbarWidth: 'none',
                }}
              >
                {mesesRev.map(m => {
                  const total  = contas.reduce((s, c) => s + (c.meses[m]?.valor_debito || 0), 0)
                  const pct    = total > 0 ? Math.max(12, Math.round((total / maxDebito) * 100)) : 6
                  const isSel  = m === mesSel
                  const isFut  = m > mesAtual
                  const isAtual = m === mesAtual
                  return (
                    <button
                      key={m}
                      onClick={() => { if (!isFut) setMesSel(m) }}
                      title={total > 0 ? fmtBRLCurto(total) : undefined}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                        background: 'none', border: 'none',
                        cursor: isFut ? 'default' : 'pointer', flexShrink: 0, padding: '0 2px',
                      }}
                    >
                      <div style={{ width: isMobile ? 28 : 32, height: 72, display: 'flex', alignItems: 'flex-end' }}>
                        <div style={{
                          width: '100%', height: `${pct}%`,
                          background: isFut ? 'rgba(255,255,255,.05)'
                            : isSel ? PURPLE
                            : isAtual ? 'rgba(139,92,246,.45)'
                            : PURPLE_DIM,
                          borderRadius: '4px 4px 2px 2px',
                          transition: 'background .15s, height .2s',
                        }} />
                      </div>
                      <div style={{ textAlign: 'center', lineHeight: 1.3 }}>
                        <div style={{
                          fontSize: 10, fontWeight: isSel ? 700 : 400,
                          color: isSel ? '#c4b5fd' : isFut ? 'rgba(255,255,255,.2)' : 'rgba(255,255,255,.38)',
                          whiteSpace: 'nowrap',
                        }}>
                          {fmtMesCurto(m).toUpperCase()}
                        </div>
                        <div style={{
                          fontSize: 9,
                          color: isSel ? 'rgba(196,181,253,.6)' : 'rgba(255,255,255,.18)',
                        }}>
                          {fmtAno(m)}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
              <div style={{ height: 1, background: 'rgba(255,255,255,.06)', margin: '0 16px' }} />
            </div>
          )}

          {/* Total do mês */}
          {mesSel && (
            <div style={{ padding: '20px 16px 0' }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: .6, fontWeight: 500 }}>
                Total em {fmtMes(mesSel)}
              </div>
              <div style={{ fontSize: 30, fontWeight: 700, color: totalMesSel > 0 ? '#f87171' : 'rgba(255,255,255,.2)', letterSpacing: -.5 }}>
                {totalMesSel > 0 ? fmtBRL(totalMesSel) : '—'}
              </div>
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: 'flex', padding: '20px 16px 0', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
            {(['tudo', 'cartoes'] as const).map(aba => (
              <button
                key={aba}
                onClick={() => setAbaAtiva(aba)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '8px 18px 12px', fontSize: 14,
                  fontWeight: abaAtiva === aba ? 600 : 400,
                  color: abaAtiva === aba ? '#fff' : 'rgba(255,255,255,.35)',
                  borderBottom: abaAtiva === aba ? `2px solid ${PURPLE}` : '2px solid transparent',
                  marginBottom: -1,
                  transition: 'color .15s',
                }}
              >
                {aba === 'tudo' ? 'Tudo' : 'Cartões'}
              </button>
            ))}
          </div>

          {/* Lista de contas */}
          <div>
            {contasVisiveis.length === 0 && (
              <div style={{ padding: '40px 16px', textAlign: 'center', color: 'rgba(255,255,255,.25)', fontSize: 13 }}>
                {abaAtiva === 'cartoes' ? 'Nenhuma conta de crédito cadastrada.' : 'Nenhuma conta encontrada.'}
              </div>
            )}

            {contasVisiveis.map((conta, i) => {
              const d      = mesSel ? conta.meses[mesSel] : null
              const temTx  = (d?.total_tx || 0) > 0
              const exp    = expandidos.has(conta.id)
              const cor    = conta.bancos?.cor || PURPLE
              const isFut  = mesSel > mesAtual
              const isLast = i === contasVisiveis.length - 1

              // Meses com dados para esta conta (fora do selecionado)
              const mesesComDados = meses.filter(m => m !== mesSel && (conta.meses[m]?.total_tx || 0) > 0)
              const temDadosOutroMes = !temTx && !isFut && mesesComDados.length > 0

              return (
                <div
                  key={conta.id}
                  style={{ borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,.05)' }}
                >
                  {/* Linha principal */}
                  <button
                    onClick={() => temTx && toggle(conta.id)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 16px', background: 'transparent', border: 'none',
                      cursor: temTx ? 'pointer' : 'default', color: '#fff',
                      textAlign: 'left', gap: 14,
                    }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: 42, height: 42, borderRadius: 12,
                      background: `${cor}18`, border: `1.5px solid ${cor}35`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, fontSize: 13, fontWeight: 700, color: cor,
                      letterSpacing: -.3,
                    }}>
                      {(conta.bancos?.nome_curto || conta.nome).slice(0, 3).toUpperCase()}
                    </div>

                    {/* Nome + banco */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {conta.nome}
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,.38)', marginTop: 2 }}>
                        {conta.bancos?.nome_curto || (conta.tipo === 'crédito' || conta.tipo === 'credito' ? 'Cartão' : 'Conta')}
                        {temDadosOutroMes && (
                          <span style={{ marginLeft: 6, color: '#a78bfa' }}>
                            · dados em {fmtMesCurto([...mesesComDados].reverse()[0])} — selecione no gráfico
                          </span>
                        )}
                        {!temTx && !isFut && !temDadosOutroMes && (
                          <span style={{ marginLeft: 6, color: '#f87171' }}>· sem dados neste mês</span>
                        )}
                      </div>
                    </div>

                    {/* Valor + chevron */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 15, fontWeight: 600, color: temTx ? '#f87171' : 'rgba(255,255,255,.2)' }}>
                          {temTx ? fmtBRL(d!.valor_debito) : isFut ? '—' : '—'}
                        </div>
                        {temTx && (d?.valor_credito || 0) > 0 && (
                          <div style={{ fontSize: 11, color: '#4ade80', marginTop: 1 }}>
                            +{fmtBRL(d!.valor_credito)}
                          </div>
                        )}
                      </div>

                      {temTx ? (
                        <svg
                          width="16" height="16" viewBox="0 0 16 16" fill="none"
                          style={{ opacity: .4, transform: exp ? 'rotate(180deg)' : 'none', transition: 'transform .18s', flexShrink: 0 }}
                        >
                          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      ) : temDadosOutroMes ? (
                        <button
                          onClick={e => { e.stopPropagation(); setMesSel([...mesesComDados].reverse()[0]) }}
                          style={{
                            fontSize: 11, color: '#a78bfa',
                            background: 'rgba(139,92,246,.12)', border: '1px solid rgba(139,92,246,.3)',
                            borderRadius: 6, padding: '4px 10px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                          }}
                        >
                          Ver mês
                        </button>
                      ) : !isFut ? (
                        <button
                          onClick={e => { e.stopPropagation(); router.push('/dashboard/lancamento') }}
                          style={{
                            fontSize: 11, color: '#a78bfa',
                            background: 'rgba(139,92,246,.12)', border: '1px solid rgba(139,92,246,.3)',
                            borderRadius: 6, padding: '4px 10px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                          }}
                        >
                          Importar
                        </button>
                      ) : null}
                    </div>
                  </button>

                  {/* Painel expandido */}
                  {exp && temTx && (
                    <div style={{ padding: '0 16px 16px' }}>
                      <div style={{ background: 'rgba(255,255,255,.04)', borderRadius: 12, padding: '14px 16px' }}>
                        {/* Barra */}
                        <div style={{ height: 5, background: 'rgba(255,255,255,.06)', borderRadius: 3, overflow: 'hidden', marginBottom: 14 }}>
                          <div style={{
                            height: '100%',
                            width: `${Math.max(3, Math.round((d!.valor_debito / maxDebito) * 100))}%`,
                            background: cor, borderRadius: 3,
                          }} />
                        </div>

                        <div style={{ display: 'flex', gap: 24 }}>
                          <div>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: .5 }}>Transações</div>
                            <div style={{ fontSize: 15, fontWeight: 600 }}>{d!.total_tx}</div>
                          </div>
                          {d!.valor_debito > 0 && (
                            <div>
                              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: .5 }}>Débitos</div>
                              <div style={{ fontSize: 15, fontWeight: 600, color: '#f87171' }}>−{fmtBRL(d!.valor_debito)}</div>
                            </div>
                          )}
                          {d!.valor_credito > 0 && (
                            <div>
                              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: .5 }}>Créditos</div>
                              <div style={{ fontSize: 15, fontWeight: 600, color: '#4ade80' }}>+{fmtBRL(d!.valor_credito)}</div>
                            </div>
                          )}
                          {d!.importacoes > 0 && (
                            <div>
                              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: .5 }}>Importações</div>
                              <div style={{ fontSize: 15, fontWeight: 600 }}>{d!.importacoes}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Pagamentos de fatura / Transferências */}
          {transferencias.length > 0 && (
            <div style={{ marginTop: 8, borderTop: '1px solid rgba(255,255,255,.06)' }}>
              <div style={{ padding: '20px 16px 8px', fontSize: 11, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: .7, fontWeight: 600 }}>
                Pagamentos detectados
              </div>
              {transferencias.map(tr => {
                const saida   = contasMap[tr.conta_saida_id   || '']
                const entrada = contasMap[tr.conta_entrada_id || '']
                const key     = `${tr.tx_saida_id}-${tr.tx_entrada_id}`
                const exp     = expandidos.has(key)
                const dtFmt   = `${tr.data.slice(8,10)}/${tr.data.slice(5,7)}/${tr.data.slice(0,4)}`
                return (
                  <div key={key} style={{ borderTop: '1px solid rgba(255,255,255,.05)' }}>
                    <button
                      onClick={() => toggle(key)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 16px', background: 'transparent', border: 'none',
                        cursor: 'pointer', color: '#fff', textAlign: 'left', gap: 14,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                        <div style={{
                          width: 42, height: 42, borderRadius: 12,
                          background: 'rgba(99,102,241,.1)', border: '1.5px solid rgba(99,102,241,.25)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 18, flexShrink: 0,
                        }}>
                          ↔
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {tr.descricao}
                          </div>
                          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', marginTop: 2 }}>{dtFmt}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                        <span style={{ fontSize: 15, fontWeight: 600 }}>{fmtBRL(tr.valor)}</span>
                        <svg
                          width="16" height="16" viewBox="0 0 16 16" fill="none"
                          style={{ opacity: .4, transform: exp ? 'rotate(180deg)' : 'none', transition: 'transform .18s' }}
                        >
                          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    </button>

                    {exp && (
                      <div style={{ padding: '0 16px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        {([
                          { cor: '#ef4444', label: 'Saiu de', conta: saida, val: `−${fmtBRL(tr.valor)}`, valCor: '#f87171' },
                          { cor: '#22c55e', label: 'Entrou em', conta: entrada, val: `+${fmtBRL(tr.valor)}`, valCor: '#4ade80' },
                        ] as const).map(({ cor, label, conta, val, valCor }) => (
                          <div key={label} style={{ background: 'rgba(255,255,255,.04)', borderRadius: 10, padding: '12px 14px' }}>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', marginBottom: 4 }}>{label}</div>
                            <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {conta?.nome || <em style={{ color: 'rgba(255,255,255,.25)', fontStyle: 'italic' }}>não vinculada</em>}
                            </div>
                            {conta?.bancos && (
                              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', marginTop: 2 }}>{conta.bancos.nome_curto}</div>
                            )}
                            <div style={{ fontSize: 14, fontWeight: 700, color: valCor, marginTop: 8 }}>{val}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Fecha dropdown ao clicar fora */}
      {showDropdown && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 40 }}
          onClick={() => setShowDropdown(false)}
        />
      )}
    </div>
  )
}
