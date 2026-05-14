'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import PoupaUpLogo from '@/components/PoupaUpLogo'
import Avatar from '@/components/Avatar'
import { useCores, useTema } from '@/components/ThemeProvider'

interface MembroDash {
  id:         string
  nome:       string
  avatar_url: string | null
  papel:      string
  receitas:   number
  despesas:   number
  saldo:      number
  metas:      { nome: string; valor_total: number; valor_atual: number }[]
  topCats:    [string, number][]
  txCount:    number
}

interface FamiliaDash {
  grupoId:       string
  membros:       MembroDash[]
  historico:     [string, number][]
  totalReceitas: number
  totalDespesas: number
  totalSaldo:    number
  mes:           string
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const CORES_MEMBROS = ['#4ade80', '#60a5fa', '#f472b6', '#fb923c', '#a78bfa', '#34d399']

function GraficoFamilia({ dash }: { dash: FamiliaDash }) {
  const W = 500, H = 120, P = { t: 12, b: 24, l: 44, r: 12 }
  const iW = W - P.l - P.r, iH = H - P.t - P.b

  let acc = dash.totalSaldo - dash.historico.reduce((a, [, v]) => a + v, 0)
  const pontos = dash.historico.map(([dia, val]) => { acc += val; return { dia, val: acc } })
  const mn = Math.min(...pontos.map(p => p.val))
  const mx = Math.max(...pontos.map(p => p.val), mn + 1)

  function px(i: number) { return P.l + (i / (pontos.length - 1)) * iW }
  function py(v: number) { return P.t + iH - ((v - mn) / (mx - mn)) * iH }

  const linha = pontos.map((p, i) => `${px(i)},${py(p.val)}`).join(' ')
  const area  = `M${px(0)},${py(pontos[0].val)} ` +
    pontos.slice(1).map((p, i) => `L${px(i + 1)},${py(p.val)}`).join(' ') +
    ` L${px(pontos.length - 1)},${P.t + iH} L${P.l},${P.t + iH} Z`

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', width: '100%' }}>
      <path d={area} fill="rgba(74,222,128,.1)" />
      <polyline points={linha} fill="none" stroke="#4ade80" strokeWidth="2" strokeLinejoin="round" />
      {[mn, mx].map((v, i) => (
        <text key={i} x={P.l - 4} y={py(v) + 3} textAnchor="end" fontSize="8" fill="rgba(255,255,255,.3)">
          {v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0)}
        </text>
      ))}
      {pontos.filter((_, i) => i % Math.max(1, Math.floor(pontos.length / 5)) === 0).map((p, i) => (
        <text key={i} x={px(dash.historico.findIndex(([d]) => d === p.dia))} y={H - 4}
          textAnchor="middle" fontSize="7" fill="rgba(255,255,255,.3)">
          {p.dia.slice(5)}
        </text>
      ))}
    </svg>
  )
}

export default function FamiliaPage() {
  const router = useRouter()
  const cores  = useCores()
  const { tema } = useTema()
  const m = tema === 'medieval'

  const [dash,    setDash]    = useState<FamiliaDash | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro,    setErro]    = useState('')

  useEffect(() => {
    fetch('/api/familia/dashboard')
      .then(r => r.json())
      .then(d => {
        if (d.error) setErro(d.error)
        else setDash(d)
        setLoading(false)
      })
      .catch(() => { setErro('Erro ao carregar dados da família.'); setLoading(false) })
  }, [])

  const nomeMes = dash ? new Date(dash.mes + '-15').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : ''

  return (
    <div style={{ minHeight: '100vh', background: cores.pageBg, color: cores.text, fontFamily: 'system-ui, sans-serif' }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '1rem 1.5rem', borderBottom: `1px solid ${cores.border}`, background: cores.surface }}>
        <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: cores.textMuted, fontSize: 18, lineHeight: 1, padding: 4 }}>←</button>
        <PoupaUpLogo mode="compact" />
        <span style={{ fontSize: 13, color: cores.textMuted }}>{m ? '👑 Reino Familiar' : '👨‍👩‍👧 Família'}</span>
        {dash && (
          <button onClick={() => router.push('/dashboard/perfil?aba=grupo')} style={{ marginLeft: 'auto', fontSize: 12, padding: '6px 12px', borderRadius: 8, border: `1px solid ${cores.border}`, background: 'transparent', color: cores.textMuted, cursor: 'pointer' }}>
            Gerenciar membros →
          </button>
        )}
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '1.5rem' }}>

        {loading && <div style={{ textAlign: 'center', padding: '4rem', color: cores.textMuted }}>Carregando dados da família...</div>}

        {erro && !loading && (
          <div style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 12, padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>👨‍👩‍👧</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Nenhuma família configurada</div>
            <div style={{ fontSize: 13, color: cores.textMuted, marginBottom: 16 }}>
              Crie um grupo familiar e convide membros para ver o dashboard consolidado.
            </div>
            <button
              onClick={() => router.push('/dashboard/perfil?aba=grupo')}
              style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: '#16a34a', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Configurar família →
            </button>
          </div>
        )}

        {dash && !loading && (
          <>
            {/* ── Cards consolidados ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
              {[
                { label: `Saldo consolidado`, valor: dash.totalSaldo, cor: dash.totalSaldo >= 0 ? '#4ade80' : '#f87171' },
                { label: `Receitas — ${nomeMes}`, valor: dash.totalReceitas, cor: '#34d399' },
                { label: `Gastos — ${nomeMes}`,   valor: dash.totalDespesas, cor: '#f87171', neg: true },
              ].map((card, i) => (
                <div key={i} style={{ background: cores.surface, border: `1px solid ${cores.border}`, borderRadius: 14, padding: '1.25rem' }}>
                  <div style={{ fontSize: 11, color: cores.textMuted, textTransform: 'uppercase' as const, letterSpacing: '.08em', marginBottom: 8 }}>{card.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: card.cor, fontVariantNumeric: 'tabular-nums' }}>
                    {card.neg ? '' : ''}{fmt(card.neg ? card.valor : card.valor)}
                  </div>
                  <div style={{ fontSize: 11, color: cores.textMuted, marginTop: 4 }}>
                    {dash.membros.length} membro{dash.membros.length > 1 ? 's' : ''}
                  </div>
                </div>
              ))}
            </div>

            {/* ── Gráfico histórico ── */}
            {dash.historico.length >= 2 && (
              <div style={{ background: cores.surface, border: `1px solid ${cores.border}`, borderRadius: 14, padding: '1.25rem', marginBottom: '1.25rem' }}>
                <div style={{ fontSize: 11, color: cores.textMuted, textTransform: 'uppercase' as const, letterSpacing: '.08em', marginBottom: 10 }}>
                  Saldo consolidado — últimos 30 dias
                </div>
                <GraficoFamilia dash={dash} />
              </div>
            )}

            {/* ── Membros em grid ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
              {dash.membros.map((mb, idx) => {
                const corMb   = CORES_MEMBROS[idx % CORES_MEMBROS.length]
                const resultado = mb.receitas - mb.despesas
                return (
                  <div key={mb.id} style={{ background: cores.surface, border: `1px solid ${cores.border}`, borderRadius: 14, overflow: 'hidden' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '1rem', borderBottom: `1px solid ${cores.border}`, background: `${corMb}0d` }}>
                      <Avatar url={mb.avatar_url} nome={mb.nome} size={36} nivel={1} onClick={() => {}} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{mb.nome}</div>
                        <div style={{ fontSize: 11, color: cores.textMuted, textTransform: 'capitalize' }}>{mb.papel === 'dono' ? '👑 dono' : mb.papel === 'edicao' ? '✏️ edição' : '👁️ leitura'}</div>
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: mb.saldo >= 0 ? corMb : '#f87171', fontVariantNumeric: 'tabular-nums' }}>
                        {fmt(mb.saldo)}
                      </div>
                    </div>

                    {/* Métricas do mês */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0 }}>
                      {[
                        { l: 'Receitas',  v: mb.receitas,  c: '#34d399' },
                        { l: 'Gastos',    v: mb.despesas,  c: '#f87171' },
                        { l: 'Resultado', v: resultado,    c: resultado >= 0 ? '#4ade80' : '#fb923c' },
                      ].map((cell, i) => (
                        <div key={i} style={{ padding: '10px 14px', borderRight: i < 2 ? `1px solid ${cores.border}` : 'none', borderBottom: `1px solid ${cores.border}` }}>
                          <div style={{ fontSize: 9, color: cores.textMuted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>{cell.l}</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: cell.c, fontVariantNumeric: 'tabular-nums' }}>{fmt(cell.v)}</div>
                        </div>
                      ))}
                    </div>

                    {/* Top categorias */}
                    {mb.topCats.length > 0 && (
                      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${cores.border}` }}>
                        <div style={{ fontSize: 9, color: cores.textMuted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Top gastos</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {mb.topCats.map(([cat, val]) => (
                            <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: 12, color: cores.textMuted }}>{cat}</span>
                              <span style={{ fontSize: 12, fontWeight: 500, color: '#f87171', fontVariantNumeric: 'tabular-nums' }}>{fmt(val)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Metas */}
                    {mb.metas.length > 0 && (
                      <div style={{ padding: '10px 14px' }}>
                        <div style={{ fontSize: 9, color: cores.textMuted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Metas</div>
                        {mb.metas.slice(0, 2).map((mt, i) => {
                          const pct = Math.min(100, Math.round((mt.valor_atual / mt.valor_total) * 100))
                          return (
                            <div key={i} style={{ marginBottom: i < mb.metas.slice(0, 2).length - 1 ? 6 : 0 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                <span style={{ fontSize: 11, color: cores.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{mt.nome}</span>
                                <span style={{ fontSize: 11, color: corMb }}>{pct}%</span>
                              </div>
                              <div style={{ height: 4, background: 'rgba(255,255,255,.07)', borderRadius: 2 }}>
                                <div style={{ height: '100%', width: `${pct}%`, background: corMb, borderRadius: 2 }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* ── Comparativo de gastos por membro ── */}
            {dash.membros.length > 1 && (
              <div style={{ background: cores.surface, border: `1px solid ${cores.border}`, borderRadius: 14, padding: '1.25rem' }}>
                <div style={{ fontSize: 11, color: cores.textMuted, textTransform: 'uppercase' as const, letterSpacing: '.08em', marginBottom: 14 }}>
                  Participação nos gastos — {nomeMes}
                </div>
                {(() => {
                  const maxDesp = Math.max(...dash.membros.map(m => m.despesas), 1)
                  return dash.membros.map((mb, idx) => {
                    const pct   = dash.totalDespesas > 0 ? Math.round((mb.despesas / dash.totalDespesas) * 100) : 0
                    const corMb = CORES_MEMBROS[idx % CORES_MEMBROS.length]
                    return (
                      <div key={mb.id} style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 13 }}>{mb.nome}</span>
                          <span style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(mb.despesas)} <span style={{ fontSize: 11, color: cores.textMuted, fontWeight: 400 }}>({pct}%)</span></span>
                        </div>
                        <div style={{ height: 7, background: 'rgba(255,255,255,.06)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${(mb.despesas / maxDesp) * 100}%`, background: corMb, borderRadius: 4, transition: 'width .6s ease' }} />
                        </div>
                      </div>
                    )
                  })
                })()}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
