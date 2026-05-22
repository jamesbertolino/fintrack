'use client'

import { useCallback, useEffect, useState } from 'react'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useRouter } from 'next/navigation'
import { useCores } from '@/components/ThemeProvider'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const CAT_CORES = [
  '#4ade80','#22d3ee','#f97316','#a78bfa','#fbbf24',
  '#60a5fa','#f472b6','#34d399','#818cf8','#fb923c',
  '#6b7280','#94a3b8',
]

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

interface Categoria { nome: string; valor: number; limite: number | null; pct: number | null }
interface Meta { nome: string; valor_total: number; valor_atual: number; contribuicao_mensal: number; prazo: string | null }
interface Transacao { descricao: string; valor: number; tipo: string; categoria: string; data_hora: string }
interface Dados {
  periodo: { ano: number; mes: number }
  usuario: { nome: string; plano: string }
  resumo: { receitas: number; despesas: number; saldo: number }
  categorias: Categoria[]
  transacoes: Transacao[]
  metas: Meta[]
}

// ── Donut chart SVG ────────────────────────────────────────────────────────────
function DonutChart({ categorias, total }: { categorias: Categoria[]; total: number }) {
  const size = 160
  const r = 58
  const cx = size / 2
  const cy = size / 2
  const circ = 2 * Math.PI * r
  const top = categorias.slice(0, 8)

  const slices = top.reduce<{ dash: number; gap: number; offset: number; color: string; nome: string; valor: number; pct: number }[]>((acc, cat, i) => {
    const pct    = total > 0 ? cat.valor / total : 0
    const dash   = pct * circ
    const gap    = circ - dash
    const offset = acc.length ? acc[acc.length - 1].offset + acc[acc.length - 1].dash : 0
    return [...acc, { dash, gap, offset, color: CAT_CORES[i % CAT_CORES.length], nome: cat.nome, valor: cat.valor, pct }]
  }, [])

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* background ring */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth={22} />
      {slices.map((s, i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="none"
          stroke={s.color} strokeWidth={22}
          strokeDasharray={`${s.dash} ${s.gap}`}
          strokeDashoffset={-s.offset + circ * 0.25}
          style={{ transform: 'rotate(-90deg)', transformOrigin: `${cx}px ${cy}px` }}
        />
      ))}
      {/* center */}
      <text x={cx} y={cy - 6} textAnchor="middle" fill="rgba(255,255,255,.5)" fontSize="9" fontFamily="system-ui">Total</text>
      <text x={cx} y={cy + 9} textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700" fontFamily="system-ui">
        {fmt(total)}
      </text>
    </svg>
  )
}

// ── Weekly bar chart SVG ───────────────────────────────────────────────────────
function WeeklyChart({ transacoes, ano, mes }: { transacoes: Transacao[]; ano: number; mes: number }) {
  const diasNoMes = new Date(ano, mes, 0).getDate()
  const semanas = [
    { label: 'S1', inicio: 1,  fim: 7 },
    { label: 'S2', inicio: 8,  fim: 14 },
    { label: 'S3', inicio: 15, fim: 21 },
    { label: 'S4', inicio: 22, fim: diasNoMes },
  ]

  const dados = semanas.map(s => {
    const txs = transacoes.filter(t => {
      const d = new Date(t.data_hora).getDate()
      return d >= s.inicio && d <= s.fim
    })
    return {
      label: s.label,
      receitas:  txs.filter(t => t.tipo === 'credito').reduce((a, t) => a + t.valor, 0),
      despesas:  txs.filter(t => t.tipo === 'debito').reduce((a, t) => a + Math.abs(t.valor), 0),
    }
  })

  const maxVal = Math.max(...dados.flatMap(d => [d.receitas, d.despesas]), 1)
  const W = 340, H = 120, padB = 22, barW = 24, gap = 18
  const groupW = barW * 2 + 6
  const totalW = semanas.length * (groupW + gap)
  const startX  = (W - totalW) / 2

  function yPos(v: number) { return padB + (H - padB) * (1 - v / maxVal) }

  return (
    <svg width={W} height={H + 10} viewBox={`0 0 ${W} ${H + 10}`}>
      {/* grid lines */}
      {[0.25, 0.5, 0.75, 1].map(f => (
        <line key={f} x1={0} y1={padB + (H - padB) * (1 - f)} x2={W} y2={padB + (H - padB) * (1 - f)}
          stroke="rgba(255,255,255,.06)" strokeWidth={1} strokeDasharray="3,3" />
      ))}
      {dados.map((d, i) => {
        const gx = startX + i * (groupW + gap)
        const hRec = ((H - padB) * d.receitas / maxVal)
        const hDes = ((H - padB) * d.despesas / maxVal)
        return (
          <g key={i}>
            {/* receitas */}
            <rect x={gx} y={yPos(d.receitas)} width={barW} height={hRec} rx={3} fill="#4ade80" fillOpacity={0.8} />
            {/* despesas */}
            <rect x={gx + barW + 6} y={yPos(d.despesas)} width={barW} height={hDes} rx={3} fill="#f87171" fillOpacity={0.8} />
            {/* label */}
            <text x={gx + groupW / 2} y={H + 8} textAnchor="middle" fill="rgba(255,255,255,.4)" fontSize="9" fontFamily="system-ui">{d.label}</text>
          </g>
        )
      })}
      {/* legend */}
      <rect x={W - 100} y={4} width={8} height={8} rx={2} fill="#4ade80" fillOpacity={0.8} />
      <text x={W - 89} y={12} fill="rgba(255,255,255,.4)" fontSize="8" fontFamily="system-ui">Receitas</text>
      <rect x={W - 50} y={4} width={8} height={8} rx={2} fill="#f87171" fillOpacity={0.8} />
      <text x={W - 39} y={12} fill="rgba(255,255,255,.4)" fontSize="8" fontFamily="system-ui">Despesas</text>
    </svg>
  )
}

export default function RelatorioPage() {
  const router = useRouter()
  const cores  = useCores()

  const now = new Date()
  const [ano, setAno] = useState(now.getFullYear())
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [dados, setDados]     = useState<Dados | null>(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro]       = useState('')
  const isMobile = useIsMobile(640)

  const buscar = useCallback(async () => {
    setLoading(true); setErro('')
    try {
      const res = await fetch(`/api/relatorio?ano=${ano}&mes=${mes}`)
      if (!res.ok) { setErro('Erro ao carregar relatório'); return }
      setDados(await res.json())
    } catch { setErro('Erro de conexão') }
    finally { setLoading(false) }
  }, [ano, mes])

  useEffect(() => { buscar() }, [buscar]) // eslint-disable-line react-hooks/set-state-in-effect

  const maxCat   = dados?.categorias[0]?.valor || 1
  const totalDes = dados?.resumo.despesas || 0

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body, html { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #fff !important; }
          @page { margin: 1.2cm; size: A4; }
          .print-page { background: #fff !important; color: #111 !important; padding: 0 !important; }
          .print-page * { color: #111 !important; }
          .print-valor-pos { color: #15803d !important; }
          .print-valor-neg { color: #b91c1c !important; }
          .print-card { border: 1px solid #ccc !important; background: #fff !important; box-shadow: none !important; break-inside: avoid; }
          .print-header { background: #16a34a !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print-header * { color: #fff !important; }
          .print-bar-bg { background: #e5e7eb !important; }
          .print-bar-green  { background: #16a34a !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print-bar-red    { background: #b91c1c !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print-divider    { border-color: #ddd !important; }
          .print-2col { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 12px !important; }
        }
      `}</style>

      <div className="print-page" style={{ minHeight: '100vh', background: cores.pageBg, fontFamily: 'system-ui, sans-serif', fontSize: 13, color: cores.text }}>

        {/* Topbar */}
        <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '.875rem 1.5rem', borderBottom: `1px solid ${cores.border}`, background: cores.topbarBg }}>
          <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: cores.textMuted, display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Dashboard
          </button>
          <span style={{ color: cores.textFaint }}>/</span>
          <span style={{ fontSize: 13, fontWeight: 600 }}>📄 Relatório mensal</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value={mes} onChange={e => setMes(+e.target.value)} style={{ padding: '5px 8px', borderRadius: 7, border: `1px solid ${cores.border}`, background: cores.surface, color: cores.text, fontSize: 12 }}>
              {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <select value={ano} onChange={e => setAno(+e.target.value)} style={{ padding: '5px 8px', borderRadius: 7, border: `1px solid ${cores.border}`, background: cores.surface, color: cores.text, fontSize: 12 }}>
              {[now.getFullYear() - 1, now.getFullYear()].map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <button onClick={() => window.print()} style={{ padding: '6px 16px', borderRadius: 8, border: 'none', background: cores.accent, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Baixar PDF
            </button>
          </div>
        </div>

        {loading && <div style={{ textAlign: 'center', padding: '4rem', color: cores.textMuted }}>Carregando...</div>}
        {erro    && <div style={{ textAlign: 'center', padding: '4rem', color: '#f87171' }}>{erro}</div>}

        {dados && !loading && (
          <div style={{ maxWidth: 860, margin: '0 auto', padding: '2rem 1.5rem' }}>

            {/* ── Cabeçalho ── */}
            <div className="print-header" style={{ background: 'linear-gradient(135deg, #16a34a, #4ade80)', borderRadius: 14, padding: '1.75rem 2rem', marginBottom: '1.5rem', color: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, opacity: .75, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 4 }}>Relatório Financeiro Mensal</div>
                  <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>{MESES[dados.periodo.mes - 1]} {dados.periodo.ano}</div>
                  <div style={{ fontSize: 13, opacity: .8, marginTop: 4 }}>{dados.usuario.nome}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, opacity: .65 }}>Saldo do período</div>
                  <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.1 }}>{fmt(dados.resumo.saldo)}</div>
                  <div style={{ fontSize: 11, opacity: .75, marginTop: 4 }}>
                    {dados.resumo.saldo >= 0 ? '✅ Resultado positivo' : '⚠️ Resultado negativo'}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Cards resumo ── */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 12, marginBottom: '1.5rem' }}>
              {[
                { label: 'Total de Receitas', valor: dados.resumo.receitas, cor: '#4ade80', icon: '↑', sub: `${dados.transacoes.filter(t => t.tipo === 'credito').length} entradas` },
                { label: 'Total de Despesas', valor: dados.resumo.despesas, cor: '#f87171', icon: '↓', sub: `${dados.transacoes.filter(t => t.tipo === 'debito').length} saídas` },
                { label: 'Saldo Líquido',     valor: dados.resumo.saldo,    cor: dados.resumo.saldo >= 0 ? '#4ade80' : '#f87171', icon: '=', sub: dados.resumo.receitas > 0 ? `${Math.round((dados.resumo.saldo / dados.resumo.receitas) * 100)}% das receitas` : '—' },
              ].map(c => (
                <div key={c.label} className="print-card" style={{ background: cores.surface, border: `1px solid ${cores.border}`, borderRadius: 12, padding: '1rem 1.25rem' }}>
                  <div style={{ fontSize: 10, color: cores.textMuted, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ color: c.cor, fontWeight: 700, fontSize: 14 }}>{c.icon}</span> {c.label}
                  </div>
                  <div className={c.cor === '#4ade80' ? 'print-valor-pos' : 'print-valor-neg'} style={{ fontSize: 22, fontWeight: 700, color: c.cor }}>{fmt(c.valor)}</div>
                  <div style={{ fontSize: 10, color: cores.textFaint, marginTop: 3 }}>{c.sub}</div>
                </div>
              ))}
            </div>

            {/* ── Gráficos lado a lado ── */}
            {dados.categorias.length > 0 && (
              <div className="print-2col print-card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, background: cores.surface, border: `1px solid ${cores.border}`, borderRadius: 12, marginBottom: '1.5rem', overflow: 'hidden' }}>

                {/* Donut */}
                <div style={{ padding: '1.25rem', borderRight: `1px solid ${cores.border}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: '1rem' }}>🍩 Distribuição por categoria</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <DonutChart categorias={dados.categorias} total={totalDes} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {dados.categorias.slice(0, 6).map((cat, i) => (
                        <div key={cat.nome} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: CAT_CORES[i % CAT_CORES.length], flexShrink: 0 }} />
                          <span style={{ fontSize: 10, color: cores.textMuted, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.nome}</span>
                          <span style={{ fontSize: 10, fontWeight: 600, color: cores.text }}>{totalDes > 0 ? Math.round(cat.valor / totalDes * 100) : 0}%</span>
                        </div>
                      ))}
                      {dados.categorias.length > 6 && <div style={{ fontSize: 9, color: cores.textFaint }}>+{dados.categorias.length - 6} outras</div>}
                    </div>
                  </div>
                </div>

                {/* Weekly bars */}
                <div style={{ padding: '1.25rem' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: '1rem' }}>📊 Receitas vs Despesas por semana</div>
                  <WeeklyChart transacoes={dados.transacoes} ano={dados.periodo.ano} mes={dados.periodo.mes} />
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 6, marginTop: 10 }}>
                    {['S1','S2','S3','S4'].map((s, i) => {
                      const w = [1,8,15,22]
                      const we = [7,14,21, new Date(dados.periodo.ano, dados.periodo.mes, 0).getDate()]
                      const txW = dados.transacoes.filter(t => { const d = new Date(t.data_hora).getDate(); return d >= w[i] && d <= we[i] })
                      const saldo = txW.reduce((a, t) => a + (t.tipo === 'credito' ? t.valor : -Math.abs(t.valor)), 0)
                      return (
                        <div key={s} style={{ textAlign: 'center', padding: '4px', background: `${saldo >= 0 ? 'rgba(74,222,128' : 'rgba(248,113,113'},.08)`, border: `1px solid ${saldo >= 0 ? 'rgba(74,222,128,.2)' : 'rgba(248,113,113,.2)'}`, borderRadius: 6 }}>
                          <div style={{ fontSize: 9, color: cores.textFaint }}>{s}</div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: saldo >= 0 ? '#4ade80' : '#f87171' }}>{saldo >= 0 ? '+' : ''}{fmt(saldo)}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ── Gastos por categoria ── */}
            {dados.categorias.length > 0 && (
              <div className="print-card" style={{ background: cores.surface, border: `1px solid ${cores.border}`, borderRadius: 12, padding: '1.25rem', marginBottom: '1.5rem' }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: '1rem' }}>💸 Gastos por categoria</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {dados.categorias.map((cat, i) => (
                    <div key={cat.nome}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: CAT_CORES[i % CAT_CORES.length] }} />
                          <span style={{ fontSize: 12, color: cores.text }}>{cat.nome}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          {cat.limite && (
                            <span style={{ fontSize: 10, color: cat.pct! > 100 ? '#f87171' : cores.textMuted }}>
                              {cat.pct}% do limite {fmt(cat.limite)}
                            </span>
                          )}
                          <span style={{ fontSize: 12, fontWeight: 600, color: cat.pct && cat.pct > 100 ? '#f87171' : cores.text }}>{fmt(cat.valor)}</span>
                        </div>
                      </div>
                      <div className="print-bar-bg" style={{ height: 4, background: cores.border, borderRadius: 2, overflow: 'hidden' }}>
                        <div className={cat.pct && cat.pct > 100 ? 'print-bar-red' : 'print-bar-green'} style={{
                          height: '100%', borderRadius: 2,
                          width: `${Math.min(100, (cat.valor / maxCat) * 100)}%`,
                          background: cat.pct && cat.pct > 100 ? '#f87171' : CAT_CORES[i % CAT_CORES.length],
                          transition: 'width .4s',
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Metas ── */}
            {dados.metas.length > 0 && (
              <div className="print-card" style={{ background: cores.surface, border: `1px solid ${cores.border}`, borderRadius: 12, padding: '1.25rem', marginBottom: '1.5rem' }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: '1rem' }}>🎯 Metas em andamento ({dados.metas.length})</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px,1fr))', gap: 12 }}>
                  {dados.metas.map(meta => {
                    const pct = Math.min(100, Math.round((meta.valor_atual / meta.valor_total) * 100))
                    const cor = pct >= 100 ? '#4ade80' : pct >= 50 ? '#22d3ee' : '#818cf8'
                    return (
                      <div key={meta.nome} style={{ padding: '10px 12px', background: `${cor}08`, border: `1px solid ${cor}25`, borderRadius: 8 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: cores.text }}>{meta.nome}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                          <span style={{ fontSize: 11, color: cor, fontWeight: 700 }}>{fmt(meta.valor_atual)}</span>
                          <span style={{ fontSize: 10, color: cores.textMuted }}>de {fmt(meta.valor_total)} · {pct}%</span>
                        </div>
                        <div className="print-bar-bg" style={{ height: 4, background: cores.border, borderRadius: 2, overflow: 'hidden', marginBottom: 5 }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: cor, borderRadius: 2 }} />
                        </div>
                        {meta.contribuicao_mensal > 0 && (
                          <div style={{ fontSize: 10, color: cores.textFaint }}>
                            {fmt(meta.contribuicao_mensal)}/mês{meta.prazo ? ` · prazo ${new Date(meta.prazo).toLocaleDateString('pt-BR')}` : ''}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Extrato ── */}
            {dados.transacoes.length > 0 && (
              <div className="print-card" style={{ background: cores.surface, border: `1px solid ${cores.border}`, borderRadius: 12, padding: '1.25rem', marginBottom: '1.5rem' }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: '1rem' }}>📋 Extrato do período ({dados.transacoes.length} lançamentos)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '5px 12px', alignItems: 'center' }}>
                  {['Descrição','Categoria','Data','Valor'].map(h => (
                    <div key={h} style={{ fontSize: 9, fontWeight: 700, color: cores.textFaint, textTransform: 'uppercase', letterSpacing: '.06em', borderBottom: `1px solid ${cores.border}`, paddingBottom: 5, marginBottom: 2 }}>{h}</div>
                  ))}
                  {dados.transacoes.map((t, i) => (
                    <>
                      <div key={`d${i}`} style={{ fontSize: 11, color: cores.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderBottom: i < dados.transacoes.length - 1 ? `1px solid ${cores.border}33` : 'none', paddingBottom: 4 }}>{t.descricao || '—'}</div>
                      <div key={`c${i}`} style={{ fontSize: 10, color: cores.textMuted, borderBottom: i < dados.transacoes.length - 1 ? `1px solid ${cores.border}33` : 'none', paddingBottom: 4 }}>{t.categoria || '—'}</div>
                      <div key={`dt${i}`} style={{ fontSize: 10, color: cores.textMuted, whiteSpace: 'nowrap', borderBottom: i < dados.transacoes.length - 1 ? `1px solid ${cores.border}33` : 'none', paddingBottom: 4 }}>{new Date(t.data_hora).toLocaleDateString('pt-BR')}</div>
                      <div key={`v${i}`} className={t.tipo === 'credito' ? 'print-valor-pos' : 'print-valor-neg'} style={{ fontSize: 11, fontWeight: 600, color: t.tipo === 'credito' ? '#4ade80' : '#f87171', textAlign: 'right', whiteSpace: 'nowrap', borderBottom: i < dados.transacoes.length - 1 ? `1px solid ${cores.border}33` : 'none', paddingBottom: 4 }}>
                        {t.tipo === 'credito' ? '+' : '-'}{fmt(Math.abs(t.valor))}
                      </div>
                    </>
                  ))}
                </div>
              </div>
            )}

            {/* ── Rodapé ── */}
            <div className="print-divider" style={{ textAlign: 'center', fontSize: 11, color: cores.textFaint, marginTop: '1rem', paddingTop: '1rem', borderTop: `1px solid ${cores.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>PoupaUp · poupaup.com.br</span>
              <span>Gerado em {new Date().toLocaleDateString('pt-BR', { dateStyle: 'long' })}</span>
              <span>📊 Relatório de {MESES[dados.periodo.mes - 1]} {dados.periodo.ano}</span>
            </div>

          </div>
        )}

        {dados && dados.transacoes.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: '3rem', color: cores.textMuted }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
            <div>Nenhum lançamento em {MESES[mes - 1]} {ano}</div>
          </div>
        )}
      </div>
    </>
  )
}
