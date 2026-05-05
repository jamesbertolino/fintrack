'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCores, useTema } from '@/components/ThemeProvider'

interface Orcamento {
  id: string
  categoria: string
  valor_planejado: number
  mes: string
}

interface SugestaoIA {
  categoria: string
  valor_sugerido: number
  motivo: string
}

const CATEGORIAS_DESPESA = [
  'Alimentação', 'Transporte', 'Lazer', 'Saúde',
  'Moradia', 'Educação', 'Outros',
]

const CORES_CAT: Record<string, string> = {
  'Alimentação': '#4ade80', 'Transporte': '#22d3ee', 'Lazer': '#f97316',
  'Saúde': '#a78bfa', 'Moradia': '#fbbf24', 'Educação': '#60a5fa', 'Outros': '#6b7280',
}

function mesLabel(mes: string) {
  const [ano, mm] = mes.split('-').map(Number)
  return new Date(ano, mm - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

function mesPrev(mes: string) {
  const [ano, mm] = mes.split('-').map(Number)
  return mm === 1 ? `${ano - 1}-12` : `${ano}-${String(mm - 1).padStart(2, '0')}`
}

function mesNext(mes: string) {
  const [ano, mm] = mes.split('-').map(Number)
  return mm === 12 ? `${ano + 1}-01` : `${ano}-${String(mm + 1).padStart(2, '0')}`
}

function fmtBRL(v: number) {
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function statusInfo(pct: number): { label: string; cor: string; bg: string } {
  if (pct >= 100) return { label: 'Acima',   cor: '#f87171', bg: 'rgba(248,113,113,.12)' }
  if (pct >= 80)  return { label: 'Próximo', cor: '#fbbf24', bg: 'rgba(251,191,36,.12)'  }
  return              { label: 'OK',      cor: '#4ade80', bg: 'rgba(74,222,128,.12)'   }
}

export default function OrcamentoPage() {
  const router  = useRouter()
  const cores   = useCores()
  const { tema } = useTema()
  const m       = tema === 'medieval'

  const mesAtual = new Date().toISOString().slice(0, 7)
  const [mes, setMes]                 = useState(mesAtual)
  const [orcamentos, setOrcamentos]   = useState<Orcamento[]>([])
  const [realizado, setRealizado]     = useState<Record<string, number>>({})
  const [loading, setLoading]         = useState(true)
  const [salvando, setSalvando]       = useState<string | null>(null)
  const [deletando, setDeletando]     = useState<string | null>(null)
  const [duplicando, setDuplicando]   = useState(false)

  // Nova categoria inline
  const [novaCategoria, setNovaCategoria] = useState('')
  const [novoValor, setNovoValor]         = useState('')
  const [adicionando, setAdicionando]     = useState(false)
  const [formAberto, setFormAberto]       = useState(false)

  // Edição inline
  const [editandoId, setEditandoId]   = useState<string | null>(null)
  const [editValor, setEditValor]     = useState('')

  // IA
  const [analiseIA, setAnaliseIA]     = useState('')
  const [sugestoesIA, setSugestoesIA] = useState<SugestaoIA[]>([])
  const [iaErro, setIaErro]           = useState(false)
  const [carregandoIA, setCarregandoIA] = useState(false)
  const [iaAberto, setIaAberto]       = useState(false)

  const accentColor = m ? '#D4AF37' : cores.accent
  const accentMuted = m ? 'rgba(212,175,55,.6)' : `${cores.accent}99`
  const fontDisplay = m ? 'var(--font-cinzel, Georgia, serif)' : 'inherit'

  const carregar = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/orcamento?mes=${mes}`)
    const data = await res.json()
    setOrcamentos(data.orcamentos || [])
    setRealizado(data.realizado || {})
    setLoading(false)
  }, [mes])

  useEffect(() => { carregar() }, [carregar]) // eslint-disable-line react-hooks/set-state-in-effect

  async function analisarIA() {
    setCarregandoIA(true)
    setIaAberto(true)
    setIaErro(false)
    const res = await fetch(`/api/orcamento/ia?mes=${mes}`)
    const data = await res.json()
    setAnaliseIA(data.analise || '')
    setSugestoesIA(data.sugestoes || [])
    setIaErro(data.ok === false)
    setCarregandoIA(false)
  }

  async function adicionarCategoria() {
    if (!novaCategoria || !novoValor) return
    setAdicionando(true)
    await fetch('/api/orcamento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoria: novaCategoria, valor_planejado: parseFloat(novoValor), mes }),
    })
    setNovaCategoria('')
    setNovoValor('')
    setFormAberto(false)
    setAdicionando(false)
    carregar()
  }

  async function salvarEdicao(id: string) {
    setSalvando(id)
    await fetch(`/api/orcamento/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valor_planejado: parseFloat(editValor) }),
    })
    setEditandoId(null)
    setSalvando(null)
    carregar()
  }

  async function excluir(id: string) {
    setDeletando(id)
    await fetch(`/api/orcamento/${id}`, { method: 'DELETE' })
    setDeletando(null)
    carregar()
  }

  async function duplicarMesAnterior() {
    setDuplicando(true)
    const res = await fetch('/api/orcamento/duplicar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mes }),
    })
    const data = await res.json()
    setDuplicando(false)
    if (!data.ok) alert(data.error)
    else carregar()
  }

  async function aplicarSugestao(s: SugestaoIA) {
    await fetch('/api/orcamento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoria: s.categoria, valor_planejado: s.valor_sugerido, mes }),
    })
    carregar()
  }

  // ── Cálculos de sumário ──────────────────────────────────────────────────
  const totalPlanejado    = orcamentos.reduce((a, o) => a + o.valor_planejado, 0)
  const totalRealizado    = orcamentos.reduce((a, o) => a + (realizado[o.categoria] || 0), 0)
  const economia          = totalPlanejado - totalRealizado
  const categoriasAcima   = orcamentos.filter(o => (realizado[o.categoria] || 0) > o.valor_planejado).length

  // Categorias disponíveis para adicionar (não cadastradas ainda neste mês)
  const categoriasDisponiveis = CATEGORIAS_DESPESA.filter(c => !orcamentos.find(o => o.categoria === c))

  const inp: React.CSSProperties = {
    padding: '7px 10px', background: cores.inputBg, border: `1px solid ${cores.inputBorder}`,
    borderRadius: 7, color: cores.text, fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box',
  }

  return (
    <div style={{ minHeight: '100vh', background: cores.pageBg, fontFamily: 'system-ui, sans-serif', fontSize: 13, color: cores.text }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '.875rem 1.5rem', borderBottom: `1px solid ${cores.border}`, background: cores.topbarBg, gap: 12, flexWrap: 'wrap' }}>
        <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: cores.textMuted, display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
          {m ? 'Salão do Reino' : 'Início'}
        </button>
        <span style={{ color: cores.textFaint }}>/</span>
        <span style={{ fontSize: 15, fontWeight: 600, fontFamily: fontDisplay, color: m ? '#F5E6C8' : cores.text }}>
          {m ? '⚖️ Controle de Tesouro' : '📊 Controle de Orçamento'}
        </span>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Navegação de mês */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: cores.surface, border: `1px solid ${cores.border}`, borderRadius: 8, padding: '4px 8px' }}>
            <button onClick={() => setMes(mesPrev(mes))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: cores.textMuted, fontSize: 16, lineHeight: 1, padding: '0 4px' }}>‹</button>
            <span style={{ fontSize: 12, fontWeight: 500, color: cores.text, minWidth: 110, textAlign: 'center', textTransform: 'capitalize' }}>{mesLabel(mes)}</span>
            <button onClick={() => setMes(mesNext(mes))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: cores.textMuted, fontSize: 16, lineHeight: 1, padding: '0 4px' }}>›</button>
          </div>

          <button onClick={analisarIA} disabled={carregandoIA}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: `${accentColor}18`, border: `1px solid ${accentColor}44`, borderRadius: 8, color: accentColor, fontSize: 12, fontWeight: 600, cursor: carregandoIA ? 'default' : 'pointer', opacity: carregandoIA ? .7 : 1 }}>
            {carregandoIA ? '⏳' : m ? '🔮' : '🤖'} {m ? 'Consultar Oráculo' : 'Analisar com IA'}
          </button>
        </div>
      </div>

      <div style={{ padding: '1.25rem 1.5rem', maxWidth: 900, margin: '0 auto' }}>

        {/* ── Painel IA ── */}
        {iaAberto && (
          <div style={{ background: `${accentColor}08`, border: `1px solid ${accentColor}28`, borderRadius: 12, padding: '1rem', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: accentColor, fontFamily: fontDisplay }}>{m ? '🔮 Profecias do Oráculo' : '🤖 Análise Inteligente'}</div>
              <button onClick={() => setIaAberto(false)} style={{ background: 'none', border: 'none', color: cores.textMuted, cursor: 'pointer', fontSize: 18 }}>×</button>
            </div>

            {carregandoIA ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: cores.textMuted, fontSize: 12 }}>
                <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span>
                Analisando seus gastos e prioridades…
                <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
              </div>
            ) : iaErro ? (
              <div style={{ display: 'flex', gap: 8, background: 'rgba(248,113,113,.08)', border: '1px solid rgba(248,113,113,.2)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#f87171' }}>
                <span>⚠️</span>
                <span>{analiseIA || 'Ocorreu um erro ao contactar a IA.'}</span>
              </div>
            ) : (
              <>
                {analiseIA && (
                  <p style={{ fontSize: 12, color: cores.textMuted, lineHeight: 1.7, marginBottom: sugestoesIA.length ? 12 : 0 }}>{analiseIA}</p>
                )}
                {sugestoesIA.length > 0 && (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 600, color: cores.textMuted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Sugestões de ajuste</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {sugestoesIA.map((s, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: cores.surface, border: `1px solid ${cores.border}`, borderRadius: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: CORES_CAT[s.categoria] || '#6b7280', flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <span style={{ fontWeight: 600, color: cores.text }}>{s.categoria}</span>
                            <span style={{ color: cores.textMuted }}> → {fmtBRL(s.valor_sugerido)}</span>
                            <div style={{ fontSize: 11, color: cores.textFaint, marginTop: 1 }}>{s.motivo}</div>
                          </div>
                          <button onClick={() => aplicarSugestao(s)}
                            style={{ padding: '4px 10px', background: `${accentColor}18`, border: `1px solid ${accentColor}44`, borderRadius: 6, color: accentColor, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            Aplicar
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Cards de sumário ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>

          {/* Card 1 — Total Planejado */}
          <div style={{ background: cores.cardBg, border: `1px solid ${cores.cardBorder}`, borderRadius: 10, padding: '14px 16px', boxShadow: cores.cardShadow }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <span style={{ fontSize: 9, fontWeight: 600, color: cores.textMuted, textTransform: 'uppercase' as const, letterSpacing: '.06em' }}>{m ? 'Tesouro Planejado' : 'Total Planejado'}</span>
              <span style={{ fontSize: 16 }}>{m ? '📜' : '📋'}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: accentColor, fontVariantNumeric: 'tabular-nums', marginBottom: 4 }}>{fmtBRL(totalPlanejado)}</div>
            <div style={{ fontSize: 10, color: cores.textFaint }}>{orcamentos.length} categoria{orcamentos.length !== 1 ? 's' : ''} configurada{orcamentos.length !== 1 ? 's' : ''}</div>
          </div>

          {/* Card 2 — Total Realizado */}
          <div style={{ background: cores.cardBg, border: `1px solid ${cores.cardBorder}`, borderRadius: 10, padding: '14px 16px', boxShadow: cores.cardShadow }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <span style={{ fontSize: 9, fontWeight: 600, color: cores.textMuted, textTransform: 'uppercase' as const, letterSpacing: '.06em' }}>{m ? 'Gastos Realizados' : 'Total Realizado'}</span>
              <span style={{ fontSize: 16 }}>{m ? '⚔️' : '💸'}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: totalRealizado > totalPlanejado ? '#f87171' : cores.text, fontVariantNumeric: 'tabular-nums', marginBottom: 4 }}>
              {fmtBRL(totalRealizado)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 10, color: cores.textFaint }}>
                {totalPlanejado > 0 ? `${Math.round((totalRealizado / totalPlanejado) * 100)}% do planejado` : '—'}
              </div>
              {totalPlanejado > 0 && (
                <div style={{ marginTop: 6, height: 3, background: cores.border, borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, Math.round((totalRealizado / totalPlanejado) * 100))}%`, background: totalRealizado > totalPlanejado ? '#f87171' : '#4ade80', borderRadius: 2 }} />
                </div>
              )}
            </div>
          </div>

          {/* Card 3 — Economia (saldo líquido + categorias excedidas) */}
          <div style={{
            background: cores.cardBg,
            border: `1px solid ${economia >= 0 ? '#4ade8033' : '#f8717133'}`,
            borderRadius: 10, padding: '14px 16px', boxShadow: cores.cardShadow,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <span style={{ fontSize: 9, fontWeight: 600, color: cores.textMuted, textTransform: 'uppercase' as const, letterSpacing: '.06em' }}>{m ? 'Saldo do Tesouro' : 'Economia'}</span>
              <span style={{ fontSize: 16 }}>{economia >= 0 ? '✅' : '⚠️'}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: economia >= 0 ? '#4ade80' : '#f87171', fontVariantNumeric: 'tabular-nums', marginBottom: 6 }}>
              {economia >= 0 ? '+' : '-'}{fmtBRL(Math.abs(economia))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, color: cores.textFaint }}>
                {economia >= 0 ? (m ? 'Tesouro protegido' : 'Dentro do orçamento') : (m ? 'Tesouro comprometido' : 'Acima do orçamento')}
              </span>
              {categoriasAcima > 0 && (
                <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 600, background: 'rgba(248,113,113,.12)', color: '#f87171' }}>
                  {categoriasAcima} excedida{categoriasAcima !== 1 ? 's' : ''}
                </span>
              )}
              {categoriasAcima === 0 && orcamentos.length > 0 && (
                <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 600, background: 'rgba(74,222,128,.1)', color: '#4ade80' }}>
                  todas OK
                </span>
              )}
            </div>
          </div>

        </div>

        {/* ── Tabela de orçamento ── */}
        <div style={{ background: cores.cardBg, border: `1px solid ${cores.cardBorder}`, borderRadius: 12, overflow: 'hidden', boxShadow: cores.cardShadow }}>
          {/* Cabeçalho da tabela */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 130px 100px 120px 80px 80px', gap: 0, padding: '8px 16px', borderBottom: `1px solid ${cores.border}`, background: cores.surface }}>
            {['Categoria', 'Planejado', 'Realizado', 'Diferença', 'Progresso', 'Status', 'Ações'].map(h => (
              <div key={h} style={{ fontSize: 9, fontWeight: 600, color: accentMuted, textTransform: 'uppercase', letterSpacing: '.07em', fontFamily: fontDisplay }}>{h}</div>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: cores.textMuted }}>Carregando...</div>
          ) : orcamentos.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: cores.textMuted }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📊</div>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>{m ? 'O livro do tesouro está vazio' : 'Nenhum orçamento definido'}</div>
              <div style={{ fontSize: 12, color: cores.textFaint }}>Adicione categorias abaixo ou duplique o mês anterior.</div>
            </div>
          ) : (
            orcamentos.map(o => {
              const real  = realizado[o.categoria] || 0
              const diff  = o.valor_planejado - real
              const pct   = o.valor_planejado > 0 ? Math.min(Math.round((real / o.valor_planejado) * 100), 100) : 0
              const pctReal = o.valor_planejado > 0 ? (real / o.valor_planejado) * 100 : 0
              const st    = statusInfo(pctReal)
              const editando = editandoId === o.id

              return (
                <div key={o.id} style={{ display: 'grid', gridTemplateColumns: '1fr 130px 130px 100px 120px 80px 80px', gap: 0, padding: '10px 16px', borderBottom: `1px solid ${cores.border}`, alignItems: 'center', transition: 'background .15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = `${cores.accent}05`)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>

                  {/* Categoria */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: CORES_CAT[o.categoria] || '#6b7280', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 500, color: cores.text }}>{o.categoria}</span>
                  </div>

                  {/* Planejado */}
                  <div>
                    {editando ? (
                      <input type="number" value={editValor} onChange={e => setEditValor(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') salvarEdicao(o.id); if (e.key === 'Escape') setEditandoId(null) }}
                        autoFocus style={{ ...inp, width: 110 }} />
                    ) : (
                      <span style={{ fontSize: 13, fontWeight: 600, color: accentColor, fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(o.valor_planejado)}</span>
                    )}
                  </div>

                  {/* Realizado */}
                  <div>
                    <span style={{ fontSize: 13, color: real > o.valor_planejado ? '#f87171' : cores.text, fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(real)}</span>
                  </div>

                  {/* Diferença */}
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 500, color: diff >= 0 ? '#4ade80' : '#f87171', fontVariantNumeric: 'tabular-nums' }}>
                      {diff >= 0 ? '+' : ''}{fmtBRL(diff)}
                    </span>
                  </div>

                  {/* Barra de progresso */}
                  <div>
                    <div style={{ height: 6, background: cores.border, borderRadius: 3, overflow: 'hidden', marginBottom: 3 }}>
                      <div style={{ height: '100%', borderRadius: 3, width: `${pct}%`, background: pctReal >= 100 ? '#f87171' : pctReal >= 80 ? '#fbbf24' : '#4ade80', transition: 'width .4s' }} />
                    </div>
                    <div style={{ fontSize: 9, color: cores.textFaint }}>{pct}%</div>
                  </div>

                  {/* Status */}
                  <div>
                    <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 20, fontWeight: 600, background: st.bg, color: st.cor }}>
                      {st.label}
                    </span>
                  </div>

                  {/* Ações */}
                  <div style={{ display: 'flex', gap: 4 }}>
                    {editando ? (
                      <>
                        <button onClick={() => salvarEdicao(o.id)} disabled={salvando === o.id}
                          style={{ padding: '3px 8px', background: '#16a34a', border: 'none', borderRadius: 5, color: '#fff', fontSize: 11, cursor: 'pointer' }}>
                          {salvando === o.id ? '...' : '✓'}
                        </button>
                        <button onClick={() => setEditandoId(null)}
                          style={{ padding: '3px 8px', background: 'transparent', border: `1px solid ${cores.border}`, borderRadius: 5, color: cores.textMuted, fontSize: 11, cursor: 'pointer' }}>
                          ✕
                        </button>
                      </>
                    ) : (
                      <>
                        <button title="Editar" onClick={() => { setEditandoId(o.id); setEditValor(String(o.valor_planejado)) }}
                          style={{ padding: '4px 8px', background: `${accentColor}14`, border: `1px solid ${accentColor}30`, borderRadius: 5, color: accentColor, fontSize: 11, cursor: 'pointer' }}>
                          ✏
                        </button>
                        <button title="Excluir" onClick={() => excluir(o.id)} disabled={deletando === o.id}
                          style={{ padding: '4px 8px', background: 'rgba(248,113,113,.1)', border: '1px solid rgba(248,113,113,.25)', borderRadius: 5, color: '#f87171', fontSize: 11, cursor: 'pointer' }}>
                          {deletando === o.id ? '...' : '🗑'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })
          )}

          {/* Rodapé da tabela com totais */}
          {orcamentos.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 130px 100px 120px 80px 80px', gap: 0, padding: '10px 16px', borderTop: `2px solid ${cores.border}`, background: cores.surface }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: cores.textMuted }}>TOTAL</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: accentColor }}>{fmtBRL(totalPlanejado)}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: cores.text }}>{fmtBRL(totalRealizado)}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: economia >= 0 ? '#4ade80' : '#f87171' }}>{economia >= 0 ? '+' : ''}{fmtBRL(economia)}</div>
              <div />
              <div />
              <div />
            </div>
          )}
        </div>

        {/* ── Ações globais ── */}
        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>

          {/* Adicionar categoria */}
          {!formAberto ? (
            <button onClick={() => setFormAberto(true)} disabled={categoriasDisponiveis.length === 0}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', background: `${accentColor}18`, border: `1px solid ${accentColor}44`, borderRadius: 9, color: accentColor, fontSize: 13, fontWeight: 600, cursor: categoriasDisponiveis.length === 0 ? 'default' : 'pointer', opacity: categoriasDisponiveis.length === 0 ? .5 : 1 }}>
              + {m ? 'Nova entrada no Livro' : 'Adicionar categoria'}
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '10px 14px', background: cores.surface, border: `1px solid ${cores.border}`, borderRadius: 10 }}>
              <select value={novaCategoria} onChange={e => setNovaCategoria(e.target.value)}
                style={{ ...inp, width: 160 }}>
                <option value="">Categoria…</option>
                {categoriasDisponiveis.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color: cores.textMuted, fontSize: 12 }}>R$</span>
                <input type="number" min="0" step="0.01" placeholder="0,00" value={novoValor} onChange={e => setNovoValor(e.target.value)}
                  style={{ ...inp, width: 100 }} />
              </div>
              <button onClick={adicionarCategoria} disabled={adicionando || !novaCategoria || !novoValor}
                style={{ padding: '7px 14px', background: '#16a34a', border: 'none', borderRadius: 7, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {adicionando ? '...' : 'Salvar'}
              </button>
              <button onClick={() => setFormAberto(false)}
                style={{ padding: '7px 12px', background: 'transparent', border: `1px solid ${cores.border}`, borderRadius: 7, color: cores.textMuted, fontSize: 12, cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          )}

          {/* Duplicar mês anterior */}
          <button onClick={duplicarMesAnterior} disabled={duplicando}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', background: cores.surface, border: `1px solid ${cores.border}`, borderRadius: 9, color: cores.textMuted, fontSize: 13, cursor: duplicando ? 'default' : 'pointer', opacity: duplicando ? .7 : 1 }}>
            {duplicando ? '⏳' : '📋'} {m ? 'Copiar do mês anterior' : 'Duplicar mês anterior'}
          </button>
        </div>

      </div>
    </div>
  )
}
