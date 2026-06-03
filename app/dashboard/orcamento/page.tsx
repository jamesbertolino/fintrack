'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCores, useTema } from '@/components/ThemeProvider'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { SkeletonOrcamento } from '@/components/Skeleton'
import { useToast, Toasts } from '@/components/Toast'

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

const CORES_CAT: Record<string, string> = {
  'Alimentação': '#4ade80', 'Transporte': '#22d3ee', 'Lazer': '#f97316',
  'Saúde': '#a78bfa', 'Moradia': '#fbbf24', 'Educação': '#60a5fa', 'Outros': '#6b7280',
}

function corCategoria(cat: string): string {
  return CORES_CAT[cat] || '#8b5cf6'
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
  const router   = useRouter()
  const cores    = useCores()
  const { tema } = useTema()
  const m        = tema === 'medieval'
  const { show, toasts, fechar } = useToast()

  const mesAtual = new Date().toISOString().slice(0, 7)
  const [mes, setMes]                 = useState(mesAtual)
  const [orcamentos, setOrcamentos]         = useState<Orcamento[]>([])
  const [realizado, setRealizado]           = useState<Record<string, number>>({})
  const [categoriasHistorico, setCategoriasHistorico] = useState<string[]>([])
  const [loading, setLoading]         = useState(true)
  const [salvando, setSalvando]       = useState<string | null>(null)
  const [deletando, setDeletando]     = useState<string | null>(null)
  const [duplicando, setDuplicando]   = useState(false)

  const [novaCategoria, setNovaCategoria] = useState('')
  const [novoValor, setNovoValor]         = useState('')
  const [adicionando, setAdicionando]     = useState(false)
  const [formAberto, setFormAberto]       = useState(false)

  const [editandoId, setEditandoId]   = useState<string | null>(null)
  const [editValor, setEditValor]     = useState('')

  const [analiseIA, setAnaliseIA]     = useState('')
  const [sugestoesIA, setSugestoesIA] = useState<SugestaoIA[]>([])
  const [iaErro, setIaErro]           = useState(false)
  const [carregandoIA, setCarregandoIA] = useState(false)
  const [iaAberto, setIaAberto]       = useState(false)

  const [confirmSugestao, setConfirmSugestao] = useState<SugestaoIA | null>(null)
  const trapSugestao = useFocusTrap(!!confirmSugestao)

  const accentColor = m ? '#D4AF37' : cores.accent
  const accentMuted = m ? 'rgba(212,175,55,.6)' : `${cores.accent}99`
  const fontDisplay = m ? 'var(--font-cinzel, Georgia, serif)' : 'inherit'

  const carregar = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/orcamento?mes=${mes}`)
    const data = await res.json()
    setOrcamentos(data.orcamentos || [])
    setRealizado(data.realizado || {})
    setCategoriasHistorico(data.categoriasHistorico || [])
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
    if (!novaCategoria || !novoValor || parseFloat(novoValor) <= 0) return
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
    show(`${novaCategoria} adicionado ao orçamento`)
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
    show('Limite atualizado')
    carregar()
  }

  async function excluir(id: string) {
    setDeletando(id)
    await fetch(`/api/orcamento/${id}`, { method: 'DELETE' })
    setDeletando(null)
    show('Categoria removida do orçamento')
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
    if (!data.ok) show(data.error || 'Erro ao duplicar orçamento', 'erro')
    else { show('Orçamento do mês anterior copiado'); carregar() }
  }

  async function aplicarSugestao(s: SugestaoIA) {
    const jaExiste = orcamentos.find(o => o.categoria === s.categoria)
    if (!jaExiste) { setConfirmSugestao(s); return }
    await _salvarSugestao(s)
  }

  async function _salvarSugestao(s: SugestaoIA) {
    const res = await fetch('/api/orcamento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoria: s.categoria, valor_planejado: s.valor_sugerido, mes }),
    })
    const data = await res.json()
    if (!res.ok || data.error) {
      show(`Erro ao aplicar sugestão: ${data.error || res.statusText}`, 'erro')
      return
    }
    show(`Sugestão de ${s.categoria} aplicada`)
    carregar()
  }

  const { totalPlanejado, totalRealizado, economia, categoriasAcima } = useMemo(() => {
    const planejado = orcamentos.reduce((a, o) => a + o.valor_planejado, 0)
    const realiz    = orcamentos.reduce((a, o) => a + (realizado[o.categoria] || 0), 0)
    return {
      totalPlanejado:  planejado,
      totalRealizado:  realiz,
      economia:        planejado - realiz,
      categoriasAcima: orcamentos.filter(o => (realizado[o.categoria] || 0) > o.valor_planejado).length,
    }
  }, [orcamentos, realizado])

  // Categorias disponíveis = do histórico + não cadastradas ainda neste mês
  const categoriasDisponiveis = useMemo(() => {
    const orcSet = new Set(orcamentos.map(o => o.categoria))
    return [...new Set(categoriasHistorico)].filter(c => !orcSet.has(c))
  }, [orcamentos, categoriasHistorico])

  const inp: React.CSSProperties = {
    padding: '7px 10px', background: cores.inputBg, border: `1px solid ${cores.inputBorder}`,
    borderRadius: 7, color: cores.text, fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box',
  }

  return (
    <div style={{ minHeight: '100vh', background: cores.pageBg, fontFamily: 'system-ui, sans-serif', fontSize: 13, color: cores.text }}>
      <style>{`
        .orc-row-mobile { display: none !important; }
        .orc-row-desktop { display: grid !important; }

        @media (max-width: 640px) {
          .orc-header { padding: .75rem 1rem !important; gap: 6px !important; }
          .orc-header-title { font-size: 13px !important; }
          .orc-body { padding: .875rem .875rem !important; }
          .orc-cards { grid-template-columns: 1fr 1fr !important; gap: 8px !important; }
          .orc-card3 { grid-column: 1 / -1 !important; }
          .orc-table-header { display: none !important; }
          .orc-row-desktop { display: none !important; }
          .orc-row-mobile { display: block !important; }
          .orc-ia-btn span.ia-label { display: none; }
          .orc-actions-row { flex-direction: column !important; }
          .orc-actions-row > button { width: 100% !important; justify-content: center !important; }
          .orc-add-form { flex-direction: column !important; gap: 10px !important; }
          .orc-add-form select, .orc-add-form input { width: 100% !important; }
          .orc-footer { display: flex !important; gap: 6px; padding: 12px 14px !important; }
          .orc-footer > div:nth-child(5),
          .orc-footer > div:nth-child(6),
          .orc-footer > div:nth-child(7) { display: none !important; }
        }
      `}</style>

      {/* ── Header ── */}
      <div className="orc-header" style={{ display: 'flex', alignItems: 'center', padding: '.875rem 1.5rem', borderBottom: `1px solid ${cores.border}`, background: cores.topbarBg, gap: 10, flexWrap: 'wrap' }}>
        <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: cores.textMuted, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, flexShrink: 0 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
          {m ? 'Reino' : 'Início'}
        </button>
        <span style={{ color: cores.textFaint }}>/</span>
        <span className="orc-header-title" style={{ fontSize: 15, fontWeight: 600, fontFamily: fontDisplay, color: m ? '#F5E6C8' : cores.text }}>
          {m ? '⚖️ Tesouro' : '📊 Orçamento'}
        </span>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: cores.surface, border: `1px solid ${cores.border}`, borderRadius: 8, padding: '4px 6px' }}>
            <button onClick={() => setMes(mesPrev(mes))} aria-label="Mês anterior" style={{ background: 'none', border: 'none', cursor: 'pointer', color: cores.textMuted, fontSize: 16, lineHeight: 1, padding: '4px 10px', minWidth: 32 }}>‹</button>
            <span style={{ fontSize: 11, fontWeight: 500, color: cores.text, minWidth: 90, textAlign: 'center', textTransform: 'capitalize' }}>{mesLabel(mes)}</span>
            <button onClick={() => setMes(mesNext(mes))} aria-label="Próximo mês" style={{ background: 'none', border: 'none', cursor: 'pointer', color: cores.textMuted, fontSize: 16, lineHeight: 1, padding: '4px 10px', minWidth: 32 }}>›</button>
          </div>

          <button className="orc-ia-btn" onClick={analisarIA} disabled={carregandoIA}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: `${accentColor}18`, border: `1px solid ${accentColor}44`, borderRadius: 8, color: accentColor, fontSize: 12, fontWeight: 600, cursor: carregandoIA ? 'default' : 'pointer', opacity: carregandoIA ? .7 : 1, whiteSpace: 'nowrap' }}>
            {carregandoIA ? '⏳' : m ? '🔮' : '🤖'} <span className="ia-label">{m ? 'Consultar Oráculo' : 'Analisar com IA'}</span>
          </button>
        </div>
      </div>

      <div className="orc-body" style={{ padding: '1.25rem 1.5rem', maxWidth: 900, margin: '0 auto' }}>

        {/* ── Painel IA ── */}
        {iaAberto && (
          <div style={{ background: `${accentColor}08`, border: `1px solid ${accentColor}28`, borderRadius: 12, padding: '1rem', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: accentColor, fontFamily: fontDisplay }}>{m ? '🔮 Profecias do Oráculo' : '🤖 Análise Inteligente'}</div>
              <button onClick={() => setIaAberto(false)} aria-label="Fechar análise" style={{ background: 'none', border: 'none', color: cores.textMuted, cursor: 'pointer', fontSize: 18 }}>×</button>
            </div>
            {carregandoIA ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: cores.textMuted, fontSize: 12 }}>
                <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span>
                Analisando seus gastos e prioridades…
                <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
              </div>
            ) : iaErro ? (
              <div style={{ display: 'flex', gap: 8, background: 'rgba(248,113,113,.08)', border: '1px solid rgba(248,113,113,.2)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#f87171' }}>
                <span>⚠️</span><span>{analiseIA || 'Erro ao contactar a IA.'}</span>
              </div>
            ) : (
              <>
                {analiseIA && <p style={{ fontSize: 12, color: cores.textMuted, lineHeight: 1.7, marginBottom: sugestoesIA.length ? 12 : 0 }}>{analiseIA}</p>}
                {sugestoesIA.length > 0 && (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 600, color: cores.textMuted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Sugestões de ajuste</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {sugestoesIA.map((s, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px', background: cores.surface, border: `1px solid ${cores.border}`, borderRadius: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: corCategoria(s.categoria), flexShrink: 0, marginTop: 3 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ fontWeight: 600, color: cores.text }}>{s.categoria}</span>
                            <span style={{ color: cores.textMuted }}> → {fmtBRL(s.valor_sugerido)}</span>
                            <div style={{ fontSize: 11, color: cores.textFaint, marginTop: 1 }}>{s.motivo}</div>
                          </div>
                          <button onClick={() => aplicarSugestao(s)} style={{ padding: '4px 10px', background: `${accentColor}18`, border: `1px solid ${accentColor}44`, borderRadius: 6, color: accentColor, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
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
        <div className="orc-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>

          <div style={{ background: cores.cardBg, border: `1px solid ${cores.cardBorder}`, borderRadius: 10, padding: '12px 14px', boxShadow: cores.cardShadow }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <span style={{ fontSize: 9, fontWeight: 600, color: cores.textMuted, textTransform: 'uppercase' as const, letterSpacing: '.06em' }}>{m ? 'Tesouro Planejado' : 'Total Planejado'}</span>
              <span style={{ fontSize: 14 }}>{m ? '📜' : '📋'}</span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: accentColor, fontVariantNumeric: 'tabular-nums', marginBottom: 3 }}>{fmtBRL(totalPlanejado)}</div>
            <div style={{ fontSize: 10, color: cores.textFaint }}>{orcamentos.length} categoria{orcamentos.length !== 1 ? 's' : ''}</div>
          </div>

          <div style={{ background: cores.cardBg, border: `1px solid ${cores.cardBorder}`, borderRadius: 10, padding: '12px 14px', boxShadow: cores.cardShadow }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <span style={{ fontSize: 9, fontWeight: 600, color: cores.textMuted, textTransform: 'uppercase' as const, letterSpacing: '.06em' }}>{m ? 'Gastos Realizados' : 'Realizado'}</span>
              <span style={{ fontSize: 14 }}>{m ? '⚔️' : '💸'}</span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: totalRealizado > totalPlanejado ? '#f87171' : cores.text, fontVariantNumeric: 'tabular-nums', marginBottom: 3 }}>{fmtBRL(totalRealizado)}</div>
            <div style={{ fontSize: 10, color: cores.textFaint }}>
              {totalPlanejado > 0 ? `${Math.round((totalRealizado / totalPlanejado) * 100)}% do planejado` : '—'}
            </div>
            {totalPlanejado > 0 && (
              <div style={{ marginTop: 5, height: 3, background: cores.border, borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, Math.round((totalRealizado / totalPlanejado) * 100))}%`, background: totalRealizado > totalPlanejado ? '#f87171' : '#4ade80', borderRadius: 2 }} />
              </div>
            )}
          </div>

          <div className="orc-card3" style={{ background: cores.cardBg, border: `1px solid ${economia >= 0 ? '#4ade8033' : '#f8717133'}`, borderRadius: 10, padding: '12px 14px', boxShadow: cores.cardShadow }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <span style={{ fontSize: 9, fontWeight: 600, color: cores.textMuted, textTransform: 'uppercase' as const, letterSpacing: '.06em' }}>{m ? 'Saldo do Tesouro' : 'Economia'}</span>
              <span style={{ fontSize: 14 }}>{economia >= 0 ? '✅' : '⚠️'}</span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: economia >= 0 ? '#4ade80' : '#f87171', fontVariantNumeric: 'tabular-nums', marginBottom: 4 }}>
              {economia >= 0 ? '+' : '-'}{fmtBRL(Math.abs(economia))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, color: cores.textFaint }}>
                {economia >= 0 ? (m ? 'Tesouro protegido' : 'Dentro do orçamento') : (m ? 'Tesouro comprometido' : 'Acima do orçamento')}
              </span>
              {categoriasAcima > 0 && (
                <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 600, background: 'rgba(248,113,113,.12)', color: '#f87171' }}>
                  {categoriasAcima} excedida{categoriasAcima !== 1 ? 's' : ''}
                </span>
              )}
              {categoriasAcima === 0 && orcamentos.length > 0 && (
                <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 600, background: 'rgba(74,222,128,.1)', color: '#4ade80' }}>todas OK</span>
              )}
            </div>
          </div>
        </div>

        {/* ── Tabela / Cards de orçamento ── */}
        <div style={{ background: cores.cardBg, border: `1px solid ${cores.cardBorder}`, borderRadius: 12, overflow: 'hidden', boxShadow: cores.cardShadow }}>

          {/* Cabeçalho — oculto no mobile via CSS */}
          <div className="orc-table-header" style={{ display: 'grid', gridTemplateColumns: '1fr 130px 130px 100px 120px 80px 80px', padding: '8px 16px', borderBottom: `1px solid ${cores.border}`, background: cores.surface }}>
            {['Categoria', 'Planejado', 'Realizado', 'Diferença', 'Progresso', 'Status', 'Ações'].map(h => (
              <div key={h} style={{ fontSize: 9, fontWeight: 600, color: accentMuted, textTransform: 'uppercase', letterSpacing: '.07em', fontFamily: fontDisplay }}>{h}</div>
            ))}
          </div>

          {loading ? (
            <SkeletonOrcamento />
          ) : orcamentos.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: cores.textMuted }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📊</div>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4, color: cores.text }}>{m ? 'O livro do tesouro está vazio' : 'Nenhum orçamento definido'}</div>
              <div style={{ fontSize: 12, color: cores.textFaint, marginBottom: 20 }}>Clique numa categoria para adicionar rapidamente:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 400, margin: '0 auto 8px' }}>
                {[
                  { cat: 'Alimentação', val: 800,  emoji: '🍽️' },
                  { cat: 'Transporte',  val: 400,  emoji: '🚗' },
                  { cat: 'Moradia',     val: 1500, emoji: '🏠' },
                  { cat: 'Saúde',       val: 300,  emoji: '🏥' },
                  { cat: 'Lazer',       val: 300,  emoji: '🎬' },
                  { cat: 'Educação',    val: 200,  emoji: '📚' },
                ].map(s => (
                  <button key={s.cat} onClick={async () => {
                    await fetch('/api/orcamento', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ categoria: s.cat, valor_planejado: s.val, mes }),
                    })
                    carregar()
                  }} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                    background: `${cores.accent}10`, border: `1px solid ${cores.accent}30`,
                    borderRadius: 20, cursor: 'pointer', fontSize: 12, color: cores.text,
                    transition: 'all .15s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = `${cores.accent}22`; e.currentTarget.style.borderColor = `${cores.accent}66` }}
                    onMouseLeave={e => { e.currentTarget.style.background = `${cores.accent}10`; e.currentTarget.style.borderColor = `${cores.accent}30` }}>
                    <span>{s.emoji}</span>
                    <span>{s.cat}</span>
                    <span style={{ color: cores.textFaint, fontSize: 11 }}>R$ {s.val}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            orcamentos.map(o => {
              const real    = realizado[o.categoria] || 0
              const diff    = o.valor_planejado - real
              const pct     = o.valor_planejado > 0 ? Math.min(Math.round((real / o.valor_planejado) * 100), 100) : 0
              const pctReal = o.valor_planejado > 0 ? (real / o.valor_planejado) * 100 : 0
              const st      = statusInfo(pctReal)
              const editando = editandoId === o.id

              return (
                <div key={o.id} className="orc-row"
                  style={{ padding: '12px 16px', borderBottom: `1px solid ${cores.border}`, transition: 'background .15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = `${cores.accent}05`)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>

                  {/* Desktop layout (grid) */}
                  <div className="orc-row-desktop" style={{ display: 'grid', gridTemplateColumns: '1fr 130px 130px 100px 120px 80px 80px', alignItems: 'center', gap: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: corCategoria(o.categoria), flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 500, color: cores.text }}>{o.categoria}</span>
                    </div>
                    <div>
                      {editando ? (
                        <input type="number" value={editValor} onChange={e => setEditValor(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') salvarEdicao(o.id); if (e.key === 'Escape') setEditandoId(null) }}
                          autoFocus style={{ ...inp, width: 110 }} />
                      ) : (
                        <span style={{ fontSize: 13, fontWeight: 600, color: accentColor, fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(o.valor_planejado)}</span>
                      )}
                    </div>
                    <div><span style={{ fontSize: 13, color: real > o.valor_planejado ? '#f87171' : cores.text, fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(real)}</span></div>
                    <div><span style={{ fontSize: 13, fontWeight: 500, color: diff >= 0 ? '#4ade80' : '#f87171', fontVariantNumeric: 'tabular-nums' }}>{diff >= 0 ? '+' : ''}{fmtBRL(diff)}</span></div>
                    <div>
                      <div style={{ height: 6, background: cores.border, borderRadius: 3, overflow: 'hidden', marginBottom: 3 }}>
                        <div style={{ height: '100%', borderRadius: 3, width: `${pct}%`, background: pctReal >= 100 ? '#f87171' : pctReal >= 80 ? '#fbbf24' : '#4ade80', transition: 'width .4s' }} />
                      </div>
                      <div style={{ fontSize: 9, color: cores.textFaint }}>{pct}%</div>
                    </div>
                    <div><span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 20, fontWeight: 600, background: st.bg, color: st.cor }}>{st.label}</span></div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {editando ? (
                        <>
                          <button onClick={() => salvarEdicao(o.id)} disabled={salvando === o.id}
                            style={{ padding: '4px 10px', background: '#16a34a', border: 'none', borderRadius: 5, color: '#fff', fontSize: 12, cursor: 'pointer' }}>
                            {salvando === o.id ? '...' : '✓'}
                          </button>
                          <button onClick={() => setEditandoId(null)}
                            style={{ padding: '4px 10px', background: 'transparent', border: `1px solid ${cores.border}`, borderRadius: 5, color: cores.textMuted, fontSize: 12, cursor: 'pointer' }}>
                            ✕
                          </button>
                        </>
                      ) : (
                        <>
                          <button title="Editar" onClick={() => { setEditandoId(o.id); setEditValor(String(o.valor_planejado)) }}
                            style={{ padding: '5px 10px', background: `${accentColor}14`, border: `1px solid ${accentColor}30`, borderRadius: 5, color: accentColor, fontSize: 12, cursor: 'pointer' }}>✏</button>
                          <button title="Excluir" onClick={() => excluir(o.id)} disabled={deletando === o.id}
                            style={{ padding: '5px 10px', background: 'rgba(248,113,113,.1)', border: '1px solid rgba(248,113,113,.25)', borderRadius: 5, color: '#f87171', fontSize: 12, cursor: 'pointer' }}>
                            {deletando === o.id ? '...' : '🗑'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Mobile layout (card) */}
                  <div className="orc-row-mobile" style={{ display: 'none' }}>
                    {/* Linha 1: categoria + badge status */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: corCategoria(o.categoria), flexShrink: 0 }} />
                        <span style={{ fontSize: 14, fontWeight: 600, color: cores.text }}>{o.categoria}</span>
                      </div>
                      <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, fontWeight: 600, background: st.bg, color: st.cor }}>{st.label}</span>
                    </div>

                    {/* Linha 2: barra de progresso */}
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 10, color: cores.textFaint }}>
                        <span>Progresso</span><span>{pct}%</span>
                      </div>
                      <div style={{ height: 7, background: cores.border, borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 4, width: `${pct}%`, background: pctReal >= 100 ? '#f87171' : pctReal >= 80 ? '#fbbf24' : '#4ade80', transition: 'width .4s' }} />
                      </div>
                    </div>

                    {/* Linha 3: 3 valores em colunas */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
                      <div style={{ background: cores.surface, borderRadius: 8, padding: '8px 10px' }}>
                        <div style={{ fontSize: 9, color: cores.textFaint, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 3 }}>Planejado</div>
                        {editando ? (
                          <input type="number" value={editValor} onChange={e => setEditValor(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') salvarEdicao(o.id); if (e.key === 'Escape') setEditandoId(null) }}
                            autoFocus style={{ ...inp, fontSize: 12, padding: '4px 6px' }} />
                        ) : (
                          <div style={{ fontSize: 13, fontWeight: 700, color: accentColor, fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(o.valor_planejado)}</div>
                        )}
                      </div>
                      <div style={{ background: cores.surface, borderRadius: 8, padding: '8px 10px' }}>
                        <div style={{ fontSize: 9, color: cores.textFaint, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 3 }}>Realizado</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: real > o.valor_planejado ? '#f87171' : cores.text, fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(real)}</div>
                      </div>
                      <div style={{ background: cores.surface, borderRadius: 8, padding: '8px 10px' }}>
                        <div style={{ fontSize: 9, color: cores.textFaint, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 3 }}>Saldo</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: diff >= 0 ? '#4ade80' : '#f87171', fontVariantNumeric: 'tabular-nums' }}>{diff >= 0 ? '+' : ''}{fmtBRL(diff)}</div>
                      </div>
                    </div>

                    {/* Linha 4: ações */}
                    <div style={{ display: 'flex', gap: 8 }}>
                      {editando ? (
                        <>
                          <button onClick={() => salvarEdicao(o.id)} disabled={salvando === o.id}
                            style={{ flex: 1, padding: '9px', background: '#16a34a', border: 'none', borderRadius: 7, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                            {salvando === o.id ? '...' : '✓ Salvar'}
                          </button>
                          <button onClick={() => setEditandoId(null)}
                            style={{ padding: '9px 14px', background: 'transparent', border: `1px solid ${cores.border}`, borderRadius: 7, color: cores.textMuted, fontSize: 13, cursor: 'pointer' }}>
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => { setEditandoId(o.id); setEditValor(String(o.valor_planejado)) }}
                            style={{ flex: 1, padding: '9px', background: `${accentColor}14`, border: `1px solid ${accentColor}30`, borderRadius: 7, color: accentColor, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                            ✏ Editar
                          </button>
                          <button onClick={() => excluir(o.id)} disabled={deletando === o.id}
                            style={{ flex: 1, padding: '9px', background: 'rgba(248,113,113,.08)', border: '1px solid rgba(248,113,113,.25)', borderRadius: 7, color: '#f87171', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                            {deletando === o.id ? '...' : '🗑 Remover'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}

          {/* Rodapé totais */}
          {orcamentos.length > 0 && (
            <div className="orc-footer" style={{ display: 'grid', gridTemplateColumns: '1fr 130px 130px 100px 120px 80px 80px', padding: '10px 16px', borderTop: `2px solid ${cores.border}`, background: cores.surface }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: cores.textMuted }}>TOTAL</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: accentColor }}>{fmtBRL(totalPlanejado)}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: cores.text }}>{fmtBRL(totalRealizado)}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: economia >= 0 ? '#4ade80' : '#f87171' }}>{economia >= 0 ? '+' : ''}{fmtBRL(economia)}</div>
              <div /><div /><div />
            </div>
          )}
        </div>

        {/* ── Ações globais ── */}
        <div className="orc-actions-row" style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>

          {!formAberto ? (
            <button onClick={() => setFormAberto(true)} disabled={categoriasDisponiveis.length === 0}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px', background: `${accentColor}18`, border: `1px solid ${accentColor}44`, borderRadius: 9, color: accentColor, fontSize: 13, fontWeight: 600, cursor: categoriasDisponiveis.length === 0 ? 'default' : 'pointer', opacity: categoriasDisponiveis.length === 0 ? .5 : 1 }}>
              + {m ? 'Nova entrada no Livro' : 'Adicionar categoria'}
            </button>
          ) : (
            <div className="orc-add-form" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '12px 14px', background: cores.surface, border: `1px solid ${cores.border}`, borderRadius: 10, width: '100%' }}>
              <select aria-label="Categoria do orçamento" value={novaCategoria} onChange={e => setNovaCategoria(e.target.value)} style={{ ...inp, width: 160 }}>
                <option value="">Categoria…</option>
                {categoriasDisponiveis.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 120 }}>
                <span style={{ color: cores.textMuted, fontSize: 12 }}>R$</span>
                <input type="number" min="0" step="0.01" placeholder="0,00" aria-label="Valor do orçamento" value={novoValor} onChange={e => setNovoValor(e.target.value)}
                  style={{ ...inp }} />
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={adicionarCategoria} disabled={adicionando || !novaCategoria || !novoValor}
                  style={{ padding: '8px 16px', background: '#16a34a', border: 'none', borderRadius: 7, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {adicionando ? '...' : 'Salvar'}
                </button>
                <button onClick={() => setFormAberto(false)}
                  style={{ padding: '8px 12px', background: 'transparent', border: `1px solid ${cores.border}`, borderRadius: 7, color: cores.textMuted, fontSize: 13, cursor: 'pointer' }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <button onClick={duplicarMesAnterior} disabled={duplicando}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px', background: cores.surface, border: `1px solid ${cores.border}`, borderRadius: 9, color: cores.textMuted, fontSize: 13, cursor: duplicando ? 'default' : 'pointer', opacity: duplicando ? .7 : 1 }}>
            {duplicando ? '⏳' : '📋'} {m ? 'Copiar mês anterior' : 'Duplicar mês anterior'}
          </button>
        </div>

      </div>

      {/* ── Modal: sugestão sem orçamento definido ── */}
      {confirmSugestao && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setConfirmSugestao(null)}>
          <div ref={trapSugestao} role="dialog" aria-modal="true" aria-label="Confirmar sugestão de orçamento"
            style={{ background: cores.cardBg, border: `1px solid ${cores.cardBorder}`, borderRadius: 16, padding: '24px 20px 20px', maxWidth: 420, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,.4)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 24 }}>💡</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: cores.text }}>Sem orçamento definido</div>
                <div style={{ fontSize: 11, color: cores.textMuted, marginTop: 2 }}>Categoria: <strong>{confirmSugestao.categoria}</strong></div>
              </div>
            </div>
            <p style={{ fontSize: 13, color: cores.textMuted, lineHeight: 1.65, marginBottom: 14 }}>
              Não há valor planejado para <strong style={{ color: cores.text }}>{confirmSugestao.categoria}</strong> neste mês.
              {' '}A IA sugere <strong style={{ color: accentColor }}>{fmtBRL(confirmSugestao.valor_sugerido)}</strong>.
            </p>
            <p style={{ fontSize: 12, color: cores.textFaint, lineHeight: 1.6, marginBottom: 18, padding: '10px 12px', background: `${accentColor}0d`, border: `1px solid ${accentColor}22`, borderRadius: 8 }}>
              💬 {confirmSugestao.motivo}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={async () => { setConfirmSugestao(null); await _salvarSugestao(confirmSugestao) }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: `${accentColor}18`, border: `1px solid ${accentColor}55`, borderRadius: 10, color: accentColor, fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ fontSize: 18 }}>✅</span>
                <div>
                  <div>Usar {fmtBRL(confirmSugestao.valor_sugerido)} como valor inicial</div>
                  <div style={{ fontSize: 11, fontWeight: 400, opacity: .8, marginTop: 1 }}>Aplica a sugestão direto no orçamento</div>
                </div>
              </button>
              <button onClick={() => { setConfirmSugestao(null); setNovaCategoria(confirmSugestao.categoria); setNovoValor(String(confirmSugestao.valor_sugerido)); setFormAberto(true) }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: cores.surface, border: `1px solid ${cores.border}`, borderRadius: 10, color: cores.text, fontSize: 13, cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ fontSize: 18 }}>✏️</span>
                <div>
                  <div>Definir valor manualmente</div>
                  <div style={{ fontSize: 11, color: cores.textMuted, marginTop: 1 }}>Abre o formulário com a categoria pré-selecionada</div>
                </div>
              </button>
              <button onClick={() => setConfirmSugestao(null)}
                style={{ padding: '9px', background: 'transparent', border: 'none', color: cores.textFaint, fontSize: 12, cursor: 'pointer', borderRadius: 8 }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSS para layout mobile das linhas da tabela */}
      <style>{`
        @media (max-width: 640px) {
          .orc-row {
            display: flex !important;
            flex-direction: column !important;
            gap: 0 !important;
            padding: 12px 14px !important;
          }
          .orc-row-top {
            display: flex !important;
            align-items: center !important;
            margin-bottom: 8px;
          }
          .orc-status-mobile { display: inline-block !important; }
          .orc-col-planejado, .orc-col-realizado, .orc-col-diff {
            display: inline-block;
          }
          .orc-row > div:nth-child(2),
          .orc-row > div:nth-child(3),
          .orc-row > div:nth-child(4) {
            display: inline-block;
            margin-right: 16px;
            margin-bottom: 6px;
          }
          .orc-row > div:nth-child(6) { display: none !important; }
          .orc-row-actions {
            display: flex !important;
            gap: 6px !important;
            margin-top: 4px;
          }
          .orc-row-actions button {
            flex: 1;
            justify-content: center;
            padding: 7px 0 !important;
          }
          .orc-footer {
            display: flex !important;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 6px;
          }
          .orc-footer > div:nth-child(5),
          .orc-footer > div:nth-child(6),
          .orc-footer > div:nth-child(7) { display: none !important; }
        }
      `}</style>
      <Toasts toasts={toasts} fechar={fechar} />
    </div>
  )
}
