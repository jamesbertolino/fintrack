'use client'

import { useEffect, useMemo, useState } from 'react'
import { useCores } from './ThemeProvider'

export interface PrioridadeComMetrica {
  tipo: string
  titulo: string
  icon: string
  ordem: number
  valor_alvo?: number
  valor_atual?: number
  contribuicao_mensal?: number
  prazo_meses?: number
}

interface Props {
  prioridades: PrioridadeComMetrica[]
  mediaMensalPoupada: number  // avg monthly savings from transactions
}

const POPUP_KEY = 'poupaup_prioridade_popup_date'

function mesesParaChegar(falta: number, mensalidade: number): number | null {
  if (!mensalidade || mensalidade <= 0) return null
  return Math.ceil(falta / mensalidade)
}

function statusLabel(mesesNecessarios: number | null, prazoMeses: number | undefined): { cor: string; texto: string; emoji: string } {
  if (mesesNecessarios === null) return { cor: '#6b7280', texto: 'Configure uma contribuição', emoji: '⚙️' }
  if (!prazoMeses) return { cor: '#4ade80', texto: `Em ~${mesesNecessarios} meses`, emoji: '📅' }
  if (mesesNecessarios <= prazoMeses * 0.85) return { cor: '#4ade80', texto: 'Adiantado! 🔥', emoji: '🟢' }
  if (mesesNecessarios <= prazoMeses * 1.1)  return { cor: '#fbbf24', texto: 'No prazo', emoji: '🟡' }
  return { cor: '#f87171', texto: `${mesesNecessarios - prazoMeses}m de atraso`, emoji: '🔴' }
}

export default function PrioridadeWidget({ prioridades, mediaMensalPoupada }: Props) {
  const cores = useCores()
  const [aberto, setAberto] = useState(false)
  const [indiceSel, setIndiceSel] = useState(0)

  const hoje = useMemo(() => new Date(), [])
  const todas = prioridades

  useEffect(() => {
    if (prioridades.length === 0) return
    const hoje = new Date().toDateString()
    const ultima = localStorage.getItem(POPUP_KEY)
    if (ultima !== hoje) {
      const timer = setTimeout(() => {
        setAberto(true)
        localStorage.setItem(POPUP_KEY, hoje)
      }, 1800)
      return () => clearTimeout(timer)
    }
  }, [prioridades.length])

  if (prioridades.length === 0) return null

  const prio = todas[indiceSel] ?? todas[0]
  const falta = Math.max(0, (prio.valor_alvo ?? 0) - (prio.valor_atual ?? 0))
  const pct = prio.valor_alvo ? Math.min(100, Math.round(((prio.valor_atual ?? 0) / prio.valor_alvo) * 100)) : 0
  const mensal = prio.contribuicao_mensal ?? mediaMensalPoupada
  const mesesNecessarios = prio.valor_alvo ? mesesParaChegar(falta, mensal) : null
  const status = statusLabel(mesesNecessarios, prio.prazo_meses)

  const dataEstimada = mesesNecessarios !== null
    ? new Date(hoje.getTime() + mesesNecessarios * 30 * 24 * 60 * 60 * 1000)
        .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    : null

  return (
    <>
      {/* Floating badge */}
      {!aberto && (
        <button
          onClick={() => setAberto(true)}
          title="Ver progresso dos seus objetivos"
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 200,
            background: cores.surface,
            border: `1px solid ${cores.accent}44`,
            borderRadius: 40, padding: '8px 16px 8px 10px',
            display: 'flex', alignItems: 'center', gap: 8,
            cursor: 'pointer', boxShadow: `0 4px 20px rgba(0,0,0,.5)`,
            color: cores.text, fontSize: 12, fontWeight: 600,
            transition: 'all .2s',
          }}>
          <span style={{ fontSize: 20 }}>{prioridades[0]?.icon ?? '🎯'}</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 10, color: cores.accent, fontWeight: 700, lineHeight: 1.2 }}>Seus objetivos</div>
            <div style={{ fontSize: 11, color: cores.textMuted }}>{prioridades.length} prioridade{prioridades.length !== 1 ? 's' : ''}</div>
          </div>
        </button>
      )}

      {/* Popup */}
      {aberto && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 300,
          width: 320, background: cores.surface,
          border: `1px solid ${cores.borderMid}`,
          borderRadius: 16, boxShadow: '0 8px 40px rgba(0,0,0,.7)',
          overflow: 'hidden',
          animation: 'prioFadeIn .25s ease',
        }}>
          <style>{`
            @keyframes prioFadeIn { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
          `}</style>

          {/* Header */}
          <div style={{ padding: '12px 14px 10px', borderBottom: `1px solid ${cores.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: cores.text }}>🎯 Seus Objetivos</div>
            <button onClick={() => setAberto(false)}
              style={{ background: 'none', border: 'none', color: cores.textMuted, cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
          </div>

          {/* Tabs de prioridade */}
          {todas.length > 1 && (
            <div style={{ display: 'flex', gap: 4, padding: '8px 10px 0', overflowX: 'auto' }}>
              {todas.map((p, i) => (
                <button key={p.tipo} onClick={() => setIndiceSel(i)}
                  style={{
                    flexShrink: 0, padding: '4px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11,
                    background: indiceSel === i ? `${cores.accent}22` : 'transparent',
                    color: indiceSel === i ? cores.accent : cores.textMuted,
                    fontWeight: indiceSel === i ? 600 : 400,
                  }}>
                  {p.icon} #{p.ordem}
                </button>
              ))}
            </div>
          )}

          {/* Conteúdo da prioridade selecionada */}
          <div style={{ padding: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 28 }}>{prio.icon}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: cores.text }}>{prio.titulo}</div>
                <div style={{ fontSize: 11, color: status.cor, fontWeight: 500, marginTop: 1 }}>{status.emoji} {status.texto}</div>
              </div>
            </div>

            {prio.valor_alvo ? (
              <>
                {/* Barra de progresso */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: cores.textMuted, marginBottom: 4 }}>
                    <span>Progresso</span>
                    <span style={{ color: pct >= 100 ? '#4ade80' : cores.text, fontWeight: 600 }}>{pct}%</span>
                  </div>
                  <div style={{ height: 8, background: cores.border, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 4,
                      width: `${pct}%`,
                      background: pct >= 100 ? '#4ade80' : pct >= 60 ? '#fbbf24' : cores.accent,
                      transition: 'width .6s ease',
                    }} />
                  </div>
                </div>

                {/* Números */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  <div style={{ background: cores.surfaceAlt, borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ fontSize: 9, color: cores.textMuted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>Guardado</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#4ade80' }}>
                      {(prio.valor_atual ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </div>
                  </div>
                  <div style={{ background: cores.surfaceAlt, borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ fontSize: 9, color: cores.textMuted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>Meta</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: cores.text }}>
                      {prio.valor_alvo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </div>
                  </div>
                </div>

                {/* Projeção */}
                {falta > 0 && (
                  <div style={{ background: `${status.cor}10`, border: `1px solid ${status.cor}28`, borderRadius: 8, padding: '9px 11px', fontSize: 11, color: cores.textMuted, lineHeight: 1.6 }}>
                    {mensal > 0 ? (
                      <>
                        Faltam <strong style={{ color: cores.text }}>{falta.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>.
                        {dataEstimada && <> Poupando <strong style={{ color: cores.accent }}>{mensal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês</strong> você chega em <strong style={{ color: status.cor }}>{dataEstimada}</strong>.</>}
                      </>
                    ) : (
                      <>Faltam <strong style={{ color: cores.text }}>{falta.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>. Configure uma contribuição mensal para ver a projeção.</>
                    )}
                  </div>
                )}

                {pct >= 100 && (
                  <div style={{ background: 'rgba(74,222,128,.1)', border: '1px solid rgba(74,222,128,.3)', borderRadius: 8, padding: '9px 11px', fontSize: 12, color: '#4ade80', fontWeight: 600, textAlign: 'center' }}>
                    🏆 Meta atingida! Parabéns!
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: 11, color: cores.textMuted, background: cores.surfaceAlt, borderRadius: 8, padding: '10px 12px', lineHeight: 1.6 }}>
                💡 Defina uma <strong style={{ color: cores.text }}>meta de valor</strong> para este objetivo em <strong style={{ color: cores.accent }}>Perfil → Prioridades</strong> e acompanhe seu progresso aqui.
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: '8px 14px 12px', borderTop: `1px solid ${cores.border}`, display: 'flex', justifyContent: 'center' }}>
            <a href="/dashboard/perfil" style={{ fontSize: 11, color: cores.accent, textDecoration: 'none', fontWeight: 500 }}>
              Gerenciar prioridades →
            </a>
          </div>
        </div>
      )}
    </>
  )
}
