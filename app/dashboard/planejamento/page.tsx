'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import PoupaUpLogo from '@/components/PoupaUpLogo'
import { useCores, useTema } from '@/components/ThemeProvider'

interface Transacao { valor: number; tipo: 'debito' | 'credito'; data_hora: string }
interface Meta      { nome: string; valor_total: number; valor_atual: number; contribuicao_mensal: number; prazo: string }

type Cenario = 'pessimista' | 'realista' | 'otimista'

const CENARIO_LABEL: Record<Cenario, string> = {
  pessimista: '🌧️ Pessimista',
  realista:   '📊 Realista',
  otimista:   '☀️ Otimista',
}
const CENARIO_MULT: Record<Cenario, { rec: number; desp: number }> = {
  pessimista: { rec: 0.85, desp: 1.15 },
  realista:   { rec: 1.00, desp: 1.00 },
  otimista:   { rec: 1.12, desp: 0.88 },
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function nomeMes(data: Date) {
  return data.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
}

export default function PlanejamentoPage() {
  const router   = useRouter()
  const supabase = createClient()
  const cores    = useCores()
  const { tema } = useTema()
  const m = tema === 'medieval'

  const [transacoes, setTransacoes] = useState<Transacao[]>([])
  const [metas,      setMetas]      = useState<Meta[]>([])
  const [saldoAtual, setSaldoAtual] = useState(0)
  const [cenario,    setCenario]    = useState<Cenario>('realista')
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const [{ data: tx }, { data: mt }, contasRes] = await Promise.all([
        supabase.from('transactions').select('valor,tipo,data_hora').eq('user_id', user.id).order('data_hora', { ascending: false }),
        supabase.from('goals').select('nome,valor_total,valor_atual,contribuicao_mensal,prazo').eq('user_id', user.id).eq('ativo', true),
        fetch('/api/contas'),
      ])

      if (tx)  setTransacoes(tx)
      if (mt)  setMetas(mt)

      const contasDados = await contasRes.json()
      const saldo = (contasDados.contas || [])
        .filter((c: { mostrar_saldo: boolean }) => c.mostrar_saldo)
        .reduce((a: number, c: { saldo: number }) => a + c.saldo, 0)
      setSaldoAtual(saldo)
      setLoading(false)
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Calcula médias dos últimos 3 meses completos ─────────────────────────
  const hoje      = new Date()
  const mesesBase = 3
  const mediasBase = (() => {
    let totalRec = 0, totalDesp = 0, mesesComDados = 0
    for (let i = 1; i <= mesesBase; i++) {
      const ref  = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
      const chave = ref.toISOString().slice(0, 7)
      const txMes = transacoes.filter(t => t.data_hora.startsWith(chave))
      if (!txMes.length) continue
      totalRec  += txMes.filter(t => t.tipo === 'credito').reduce((a, t) => a + t.valor, 0)
      totalDesp += txMes.filter(t => t.tipo === 'debito').reduce((a, t) => a + Math.abs(t.valor), 0)
      mesesComDados++
    }
    if (!mesesComDados) return { rec: 0, desp: 0 }
    return { rec: totalRec / mesesComDados, desp: totalDesp / mesesComDados }
  })()

  // ── Projeta 12 meses ─────────────────────────────────────────────────────
  const mult = CENARIO_MULT[cenario]
  const recBase  = mediasBase.rec  * mult.rec
  const despBase = mediasBase.desp * mult.desp

  const projecao = Array.from({ length: 12 }, (_, i) => {
    const data      = new Date(hoje.getFullYear(), hoje.getMonth() + i + 1, 1)
    const chaveProj = data.toISOString().slice(0, 7)

    // Contribuições de metas que ainda estarão ativas
    const contrib = metas
      .filter(mt => mt.prazo >= chaveProj)
      .reduce((a, mt) => a + (mt.contribuicao_mensal || 0), 0)

    const rec   = recBase
    const desp  = despBase + contrib
    return { data, rec, desp, contrib, resultado: rec - desp }
  })

  // Saldo acumulado mês a mês
  let saldoAcc = saldoAtual
  const projecaoAcc = projecao.map(p => {
    saldoAcc += p.resultado
    return { ...p, saldoAcc }
  })

  // ── Gráfico SVG de linha ─────────────────────────────────────────────────
  const W = 680, H = 180, PAD = { t: 20, b: 30, l: 60, r: 20 }
  const innerW = W - PAD.l - PAD.r
  const innerH = H - PAD.t - PAD.b

  const saldos    = projecaoAcc.map(p => p.saldoAcc)
  const minSaldo  = Math.min(...saldos, saldoAtual)
  const maxSaldo  = Math.max(...saldos, saldoAtual)
  const range     = maxSaldo - minSaldo || 1

  function px(i: number) { return PAD.l + (i / (projecaoAcc.length - 1)) * innerW }
  function py(v: number) { return PAD.t + innerH - ((v - minSaldo) / range) * innerH }

  const pontos = projecaoAcc.map((p, i) => `${px(i)},${py(p.saldoAcc)}`).join(' ')
  const area   = `M${px(0)},${py(projecaoAcc[0].saldoAcc)} ` +
    projecaoAcc.slice(1).map((p, i) => `L${px(i + 1)},${py(p.saldoAcc)}`).join(' ') +
    ` L${px(projecaoAcc.length - 1)},${PAD.t + innerH} L${PAD.l},${PAD.t + innerH} Z`

  const accentColor = '#4ade80'

  return (
    <div style={{ minHeight: '100vh', background: cores.pageBg, color: cores.text, fontFamily: 'system-ui, sans-serif' }}>

      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.5rem', borderBottom: `1px solid ${cores.border}`, background: cores.surface }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: cores.textMuted, fontSize: 18, lineHeight: 1, padding: 4 }}>←</button>
          <PoupaUpLogo mode="compact" />
          <span style={{ fontSize: 13, color: cores.textMuted, marginLeft: 4 }}>
            {m ? '🔭 Visão do Oráculo' : '📅 Planejamento anual'}
          </span>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '1.5rem' }}>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: cores.textMuted }}>Calculando projeção...</div>
        ) : (
          <>
            {/* Alerta dados insuficientes */}
            {mediasBase.rec === 0 && mediasBase.desp === 0 && (
              <div style={{ background: 'rgba(251,191,36,.07)', border: '1px solid rgba(251,191,36,.2)', borderRadius: 10, padding: '12px 16px', marginBottom: '1.25rem', fontSize: 13, color: '#fbbf24' }}>
                ⚠️ Sem transações nos últimos 3 meses. Lance algumas transações para gerar uma projeção precisa.
              </div>
            )}

            {/* Seletor de cenário */}
            <div style={{ display: 'flex', gap: 8, marginBottom: '1.5rem', flexWrap: 'wrap' as const }}>
              {(['pessimista', 'realista', 'otimista'] as Cenario[]).map(c => (
                <button
                  key={c}
                  onClick={() => setCenario(c)}
                  style={{
                    padding: '8px 18px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all .2s',
                    background: cenario === c ? accentColor : 'rgba(255,255,255,.05)',
                    border: `1px solid ${cenario === c ? accentColor : 'rgba(255,255,255,.1)'}`,
                    color: cenario === c ? '#000' : cores.textMuted,
                  }}
                >
                  {CENARIO_LABEL[c]}
                </button>
              ))}
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: cores.textMuted }}>
                Base: média de {mesesBase} meses · Rec. {fmt(mediasBase.rec)} · Desp. {fmt(mediasBase.desp)}
              </div>
            </div>

            {/* Gráfico */}
            <div style={{ background: cores.surface, border: `1px solid ${cores.border}`, borderRadius: 14, padding: '1.25rem', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: 11, color: cores.textMuted, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12 }}>
                Projeção de saldo — próximos 12 meses
              </div>
              <div style={{ overflowX: 'auto' }}>
                <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
                  {/* Zero line */}
                  {minSaldo < 0 && maxSaldo > 0 && (
                    <line x1={PAD.l} y1={py(0)} x2={W - PAD.r} y2={py(0)} stroke="rgba(255,255,255,.15)" strokeWidth="1" strokeDasharray="4,3" />
                  )}
                  {/* Y axis labels */}
                  {[minSaldo, (minSaldo + maxSaldo) / 2, maxSaldo].map((v, i) => (
                    <text key={i} x={PAD.l - 6} y={py(v) + 4} textAnchor="end" fontSize="9" fill="rgba(255,255,255,.3)">
                      {v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0)}
                    </text>
                  ))}
                  {/* Area fill */}
                  <path d={area} fill={`${accentColor}18`} />
                  {/* Line */}
                  <polyline points={pontos} fill="none" stroke={accentColor} strokeWidth="2" strokeLinejoin="round" />
                  {/* Pontos e labels meses */}
                  {projecaoAcc.map((p, i) => (
                    <g key={i}>
                      <circle cx={px(i)} cy={py(p.saldoAcc)} r="3" fill={p.saldoAcc >= 0 ? accentColor : '#f87171'} />
                      <text x={px(i)} y={H - 6} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,.3)">
                        {nomeMes(p.data)}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            </div>

            {/* Cards de resumo */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
              {[
                { label: 'Saldo hoje',            valor: saldoAtual,                          cor: '#fff' },
                { label: 'Saldo em 6 meses',      valor: projecaoAcc[5]?.saldoAcc ?? 0,       cor: (projecaoAcc[5]?.saldoAcc ?? 0) >= 0 ? accentColor : '#f87171' },
                { label: 'Saldo em 12 meses',     valor: projecaoAcc[11]?.saldoAcc ?? 0,      cor: (projecaoAcc[11]?.saldoAcc ?? 0) >= 0 ? accentColor : '#f87171' },
              ].map((card, i) => (
                <div key={i} style={{ background: cores.surface, border: `1px solid ${cores.border}`, borderRadius: 12, padding: '1rem' }}>
                  <div style={{ fontSize: 11, color: cores.textMuted, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>{card.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: card.cor, fontVariantNumeric: 'tabular-nums' }}>{fmt(card.valor)}</div>
                </div>
              ))}
            </div>

            {/* Tabela mensal */}
            <div style={{ background: cores.surface, border: `1px solid ${cores.border}`, borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${cores.border}`, fontSize: 11, color: cores.textMuted, textTransform: 'uppercase', letterSpacing: '.08em' }}>
                Detalhe mês a mês
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,.02)' }}>
                      {['Mês', 'Receitas', 'Metas (-)', 'Gastos', 'Resultado', 'Saldo acum.'].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'right', color: cores.textMuted, fontWeight: 500, fontSize: 11, whiteSpace: 'nowrap', borderBottom: `1px solid ${cores.border}` }}>
                          {h === 'Mês' ? <span style={{ textAlign: 'left', display: 'block' }}>{h}</span> : h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {projecaoAcc.map((p, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${cores.border}`, background: i % 2 ? 'rgba(255,255,255,.01)' : 'transparent' }}>
                        <td style={{ padding: '10px 16px', fontWeight: 500, whiteSpace: 'nowrap' }}>
                          {p.data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'right', color: '#4ade80', fontVariantNumeric: 'tabular-nums' }}>{fmt(p.rec)}</td>
                        <td style={{ padding: '10px 16px', textAlign: 'right', color: p.contrib > 0 ? '#a78bfa' : cores.textMuted, fontVariantNumeric: 'tabular-nums' }}>
                          {p.contrib > 0 ? fmt(p.contrib) : '—'}
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'right', color: '#f87171', fontVariantNumeric: 'tabular-nums' }}>{fmt(p.desp)}</td>
                        <td style={{ padding: '10px 16px', textAlign: 'right', color: p.resultado >= 0 ? accentColor : '#f87171', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                          {p.resultado >= 0 ? '+' : ''}{fmt(p.resultado)}
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'right', color: p.saldoAcc >= 0 ? cores.text : '#f87171', fontVariantNumeric: 'tabular-nums' }}>{fmt(p.saldoAcc)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Metas no período */}
            {metas.length > 0 && (
              <div style={{ background: cores.surface, border: `1px solid ${cores.border}`, borderRadius: 14, padding: '1.25rem', marginTop: '1.25rem' }}>
                <div style={{ fontSize: 11, color: cores.textMuted, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12 }}>Metas no período</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {metas.map((mt, i) => {
                    const pct     = Math.min(100, Math.round((mt.valor_atual / mt.valor_total) * 100))
                    const mesesAt = Array.from({ length: 12 }, (_, j) => {
                      const d = new Date(hoje.getFullYear(), hoje.getMonth() + j + 1, 1)
                      return d.toISOString().slice(0, 7)
                    }).filter(ch => ch <= mt.prazo).length
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 13, fontWeight: 500 }}>{mt.nome}</span>
                            <span style={{ fontSize: 12, color: cores.textMuted }}>{pct}% · vence {new Date(mt.prazo).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}</span>
                          </div>
                          <div style={{ height: 5, background: 'rgba(255,255,255,.07)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: '#a78bfa', borderRadius: 3 }} />
                          </div>
                        </div>
                        <div style={{ fontSize: 11, color: '#a78bfa', textAlign: 'right', flexShrink: 0 }}>
                          {mt.contribuicao_mensal > 0 ? `${fmt(mt.contribuicao_mensal)}/mês` : '—'}<br />
                          <span style={{ color: cores.textMuted }}>{mesesAt} meses</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div style={{ marginTop: '1.5rem', fontSize: 11, color: cores.textMuted, textAlign: 'center' }}>
              Projeção baseada na média dos últimos {mesesBase} meses · Não considera eventos extraordinários
            </div>
          </>
        )}
      </div>
    </div>
  )
}
