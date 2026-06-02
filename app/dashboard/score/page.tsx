'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import PoupaUpLogo from '@/components/PoupaUpLogo'
import { useCores, useTema } from '@/components/ThemeProvider'
import { calcularScore, type ScoreResult } from '@/lib/calcularScore'

// ── Gauge SVG — componente top-level para evitar re-criação a cada render ──
function Gauge({ total, cor }: { total: number; cor: string }) {
  const R = 80, cx = 100, cy = 100
  const startAngle = 210, arcSpan = 300
  const pct = total / 1000

  function polarToXY(deg: number, r: number) {
    const rad = (deg * Math.PI) / 180
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
  }
  function arc(from: number, to: number, r: number) {
    const s = polarToXY(from, r), e = polarToXY(to, r)
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${e.x} ${e.y}`
  }

  const trackEnd = startAngle + arcSpan
  const fillEnd  = startAngle + arcSpan * pct
  const np       = polarToXY(startAngle + arcSpan * pct, R - 10)

  return (
    <svg width="200" height="130" viewBox="0 0 200 130" style={{ display: 'block', margin: '0 auto' }}>
      {[
        { from: 0, to: 0.30, c: '#ef4444' }, { from: 0.30, to: 0.45, c: '#f97316' },
        { from: 0.45, to: 0.60, c: '#fbbf24' }, { from: 0.60, to: 0.75, c: '#84cc16' },
        { from: 0.75, to: 1.00, c: '#22c55e' },
      ].map((seg, i) => (
        <path key={i} d={arc(startAngle + arcSpan * seg.from, startAngle + arcSpan * seg.to, R)}
          fill="none" stroke={seg.c} strokeWidth="12" strokeLinecap="butt" opacity="0.22" />
      ))}
      <path d={arc(startAngle, trackEnd, R)} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="12" strokeLinecap="butt" />
      {pct > 0 && <path d={arc(startAngle, fillEnd, R)} fill="none" stroke={cor} strokeWidth="12" strokeLinecap="butt" />}
      <line x1={cx} y1={cy} x2={np.x} y2={np.y} stroke={cor} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="5" fill={cor} />
      <text x={cx} y={cy + 28} textAnchor="middle" fontSize="32" fontWeight="700" fill={cor} fontFamily="system-ui">{total}</text>
      <text x={cx} y={cy + 44} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,.4)" fontFamily="system-ui">de 1000</text>
    </svg>
  )
}

export default function ScorePage() {
  const router   = useRouter()
  const supabase = createClient()
  const cores    = useCores()
  const { tema } = useTema()
  const m = tema === 'medieval'

  const [score,     setScore]     = useState<ScoreResult | null>(null)
  const [novoUser,  setNovoUser]  = useState(false)
  const [loading,   setLoading]   = useState(true)
  const [erro,      setErro]      = useState('')

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const [{ data: tx }, { data: mt }, { data: div }, { data: orc }, contasRes] = await Promise.all([
        supabase.from('transactions').select('valor,tipo,data_hora,categoria').eq('user_id', user.id).order('data_hora', { ascending: false }),
        supabase.from('goals').select('valor_total,valor_atual,ativo').eq('user_id', user.id),
        supabase.from('dividas').select('saldo,taxa_juros').eq('user_id', user.id).eq('ativo', true),
        supabase.from('orcamentos').select('categoria,limite').eq('user_id', user.id),
        fetch('/api/contas'),
      ])

      const contasDados = contasRes.ok ? await contasRes.json() : { contas: [] }
      const saldoTotal  = (contasDados.contas || [])
        .filter((c: { mostrar_saldo: boolean }) => c.mostrar_saldo)
        .reduce((a: number, c: { saldo: number }) => a + c.saldo, 0)

      const semDados = !tx?.length && !mt?.length && !orc?.length
      setNovoUser(semDados)
      setScore(calcularScore({
        transacoes: (tx || []) as Parameters<typeof calcularScore>[0]['transacoes'],
        metas:      mt || [],
        orcamentos: orc || [],
        dividas:    div || [],
        saldoTotal,
      }))
    }
    init().catch(() => setErro('Erro ao carregar o score. Tente recarregar a página.')).finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: cores.pageBg, color: cores.text, fontFamily: 'system-ui, sans-serif' }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '1rem 1.5rem', borderBottom: `1px solid ${cores.border}`, background: cores.surface }}>
        <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: cores.textMuted, fontSize: 18, lineHeight: 1, padding: 4 }}>←</button>
        <PoupaUpLogo mode="compact" />
        <span style={{ fontSize: 13, color: cores.textMuted }}>{m ? '⭐ Honra do Cavaleiro' : '⭐ Score Financeiro'}</span>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '1.5rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: cores.textMuted }}>Calculando seu score...</div>
        ) : erro ? (
          <div style={{ textAlign: 'center', padding: '4rem' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontSize: 14, color: '#f87171', marginBottom: 8 }}>{erro}</div>
            <button onClick={() => window.location.reload()} style={{ padding: '8px 20px', background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, color: '#f87171', fontSize: 13, cursor: 'pointer' }}>Recarregar</button>
          </div>
        ) : score && (
          <>
            <div style={{ background: cores.surface, border: `1px solid ${cores.border}`, borderRadius: 16, padding: '2rem', marginBottom: '1.25rem', textAlign: 'center' }}>
              <Gauge total={score.total} cor={score.corNivel} />
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: score.corNivel, marginBottom: 4 }}>{score.nivel}</div>
                <div style={{ fontSize: 13, color: cores.textMuted }}>
                  Seu score está{' '}
                  <strong style={{ color: score.corNivel }}>
                    {score.total >= 750 ? 'acima da média' : score.total >= 500 ? 'na média' : 'abaixo da média'}
                  </strong>
                </div>
              </div>
              <div style={{ maxWidth: 400, margin: '1.25rem auto 0' }}>
                <div style={{ height: 10, background: 'rgba(255,255,255,.07)', borderRadius: 5, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(score.total / 1000) * 100}%`, background: score.corNivel, borderRadius: 5, transition: 'width 1s ease' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: 'rgba(255,255,255,.25)' }}>
                  <span>0</span><span>250</span><span>500</span><span>750</span><span>1000</span>
                </div>
              </div>
            </div>

            {/* Painel de boas-vindas para novo usuário */}
            {novoUser && (
              <div style={{ background: `${cores.accent}0f`, border: `1px solid ${cores.accent}33`, borderRadius: 12, padding: '1rem 1.25rem', marginBottom: '1.25rem', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 28, flexShrink: 0 }}>🚀</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: cores.text, marginBottom: 4 }}>
                    Seu score começa aqui!
                  </div>
                  <div style={{ fontSize: 12, color: cores.textFaint, lineHeight: 1.6 }}>
                    Para ter um score real, complete 3 passos:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                    {[
                      { label: 'Registre sua primeira transação',      href: '/dashboard/lancamento', emoji: '📝' },
                      { label: 'Crie um orçamento mensal',             href: '/dashboard/orcamento',  emoji: '📊' },
                      { label: 'Defina uma meta financeira',           href: '/dashboard/metas',      emoji: '🎯' },
                    ].map(p => (
                      <button key={p.href} onClick={() => router.push(p.href)} style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                        background: 'rgba(255,255,255,.04)', border: `1px solid ${cores.border}`,
                        borderRadius: 8, cursor: 'pointer', color: cores.text, fontSize: 12, textAlign: 'left',
                        transition: 'all .15s',
                      }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = cores.accent; e.currentTarget.style.background = `${cores.accent}10` }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = cores.border; e.currentTarget.style.background = 'rgba(255,255,255,.04)' }}>
                        <span>{p.emoji}</span>
                        <span>{p.label}</span>
                        <span style={{ marginLeft: 'auto', color: cores.textFaint }}>→</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
              {score.dimensoes.map(d => {
                const pctD = d.pontos / d.maximo
                const cor  = pctD >= 0.80 ? '#4ade80' : pctD >= 0.55 ? '#fbbf24' : '#f87171'
                return (
                  <div key={d.id} style={{ background: cores.surface, border: `1px solid ${cores.border}`, borderRadius: 12, padding: '1rem 1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <span style={{ fontSize: 20 }}>{d.emoji}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <span style={{ fontSize: 14, fontWeight: 500 }}>{d.nome}</span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: cor, fontVariantNumeric: 'tabular-nums' }}>
                            {d.pontos}<span style={{ fontSize: 11, color: cores.textMuted, fontWeight: 400 }}>/{d.maximo}</span>
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: cores.textMuted, marginTop: 1 }}>{d.descricao}</div>
                      </div>
                    </div>
                    <div style={{ height: 6, background: 'rgba(255,255,255,.07)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
                      <div style={{ height: '100%', width: `${pctD * 100}%`, background: cor, borderRadius: 3, transition: 'width 1s ease' }} />
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,.45)', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 8, padding: '7px 10px' }}>
                      💡 {d.dica}
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ background: cores.surface, border: `1px solid ${cores.border}`, borderRadius: 14, padding: '1.25rem' }}>
              <div style={{ fontSize: 11, color: cores.textMuted, textTransform: 'uppercase' as const, letterSpacing: '.08em', marginBottom: 12 }}>
                Onde você pode ganhar mais pontos
              </div>
              {[...score.dimensoes]
                .sort((a, b) => (b.maximo - b.pontos) - (a.maximo - a.pontos))
                .slice(0, 3)
                .map((d, i) => (
                  <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: i < 2 ? `1px solid ${cores.border}` : 'none' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{d.emoji}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{d.nome}</div>
                      <div style={{ fontSize: 11, color: cores.textMuted }}>{d.dica}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fbbf24', flexShrink: 0 }}>+{d.maximo - d.pontos} pts</div>
                  </div>
                ))}
            </div>

            <div style={{ marginTop: '1.5rem', fontSize: 11, color: cores.textMuted, textAlign: 'center' }}>
              Score calculado com base nas suas transações, metas, orçamentos e dívidas · Atualizado em tempo real
            </div>
          </>
        )}
      </div>
    </div>
  )
}
