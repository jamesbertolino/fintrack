'use client'

import { useState } from 'react'
import { useCores, useTema } from '@/components/ThemeProvider'
import { calcularNivel, getNomeNivel, NIVEIS } from '@/lib/calcularXP'

interface Transacao {
  id: string
  descricao: string
  valor: number
  tipo: 'debito' | 'credito'
  categoria: string
  data_hora: string
}

interface Meta {
  id: string
  nome: string
  valor_total: number
  valor_atual: number
  ativo?: boolean
}

interface Props {
  xpTotal: number
  xpSaldo: number
  xpBonus: number
  saldo: number
  transacoes: Transacao[]
  metas: Meta[]
  onFechar: () => void
}

interface EventoXP {
  id: string
  icone: string
  titulo: string
  subtitulo: string
  xp: number
  cor: string
  data: string   // ISO
  tipo: 'transacao' | 'meta_ativa' | 'meta_concluida' | 'saldo' | 'bonus'
}

function fmtData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })
}
function fmtBRL(v: number) {
  return 'R$ ' + Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function ExtratoXP({
  xpTotal, xpSaldo, xpBonus,
  saldo, transacoes, metas, onFechar,
}: Props) {
  const cores = useCores()
  const { tema } = useTema()
  const m = tema === 'medieval'
  const accentColor = m ? '#D4AF37' : cores.accent
  const fontDisplay  = m ? 'var(--font-cinzel, Georgia, serif)' : 'inherit'

  const nivel     = calcularNivel(xpTotal)
  const proxNivel = nivel.proximoNivel
  const nomeAtual = getNomeNivel(nivel, m)
  const proxNome  = proxNivel ? getNomeNivel(proxNivel, m) : null
  const faltaXP   = proxNivel ? proxNivel.min - xpTotal : 0

  const [nivelExpandido, setNivelExpandido] = useState<number | null>(nivel.nivel)

  // ── Monta linha do tempo de eventos XP ──────────────────────────────────
  const eventos: EventoXP[] = []

  // 1. Cada transação = +10 XP
  for (const t of [...transacoes].sort((a, b) => a.data_hora.localeCompare(b.data_hora))) {
    eventos.push({
      id: t.id,
      icone: t.tipo === 'credito' ? '📈' : '📉',
      titulo: t.descricao || t.categoria,
      subtitulo: `${t.tipo === 'credito' ? '+' : '-'}${fmtBRL(t.valor)} · ${t.categoria}`,
      xp: 10,
      cor: t.tipo === 'credito' ? '#4ade80' : '#f87171',
      data: t.data_hora,
      tipo: 'transacao',
    })
  }

  // 2. XP de saldo positivo — evento único no final (baseado em todas as transações)
  if (xpSaldo > 0) {
    eventos.push({
      id: 'saldo',
      icone: '💰',
      titulo: 'Saldo positivo acumulado',
      subtitulo: `${fmtBRL(saldo)} ÷ 10`,
      xp: xpSaldo,
      cor: '#22d3ee',
      data: new Date().toISOString(),
      tipo: 'saldo',
    })
  }

  // 3. Metas ativas
  for (const mt of metas) {
    if (mt.ativo && mt.valor_atual < mt.valor_total) {
      eventos.push({
        id: 'meta-ativa-' + mt.id,
        icone: '🎯',
        titulo: mt.nome,
        subtitulo: `Meta ativa · ${Math.round((mt.valor_atual / mt.valor_total) * 100)}%`,
        xp: 50,
        cor: '#a78bfa',
        data: new Date().toISOString(),
        tipo: 'meta_ativa',
      })
    }
    if (mt.valor_atual >= mt.valor_total) {
      eventos.push({
        id: 'meta-concl-' + mt.id,
        icone: '🏆',
        titulo: mt.nome,
        subtitulo: `Meta concluída · ${fmtBRL(mt.valor_total)}`,
        xp: 200,
        cor: '#fbbf24',
        data: new Date().toISOString(),
        tipo: 'meta_concluida',
      })
    }
  }

  // 4. Bônus
  if (xpBonus > 0) {
    eventos.push({
      id: 'bonus',
      icone: '⭐',
      titulo: 'Bônus acumulados',
      subtitulo: 'Tour + notificações lidas',
      xp: xpBonus,
      cor: accentColor,
      data: new Date().toISOString(),
      tipo: 'bonus',
    })
  }

  // ── Mapeia cada evento para o nível em que ele foi "ganho" ───────────────
  // (baseado em XP acumulado até aquele ponto)
  let xpAcc = 0
  const eventosPorNivel: Record<number, EventoXP[]> = {}
  for (const nv of NIVEIS) eventosPorNivel[nv.nivel] = []

  for (const ev of eventos) {
    // Descobre em qual nível esse XP foi ganho
    const antes = xpAcc
    xpAcc += ev.xp
    // O evento pertence ao nível em que começa a ganhar o XP
    const nvAntes = [...NIVEIS].reverse().find(n => antes >= n.min) || NIVEIS[0]
    eventosPorNivel[nvAntes.nivel].push(ev)
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onFechar}
    >
      <div
        style={{ background: cores.cardBg, border: `1px solid ${accentColor}33`, borderRadius: 18, padding: '22px 20px', maxWidth: 460, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: `0 24px 64px rgba(0,0,0,.5)` }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: cores.text, fontFamily: fontDisplay, marginBottom: 2 }}>
              {m ? '⚔ Crônica de Glória' : '⭐ Extrato de XP'}
            </div>
            <div style={{ fontSize: 12, color: cores.textMuted }}>
              {xpTotal.toLocaleString()} XP · Nível {nivel.nivel} · {nomeAtual}
            </div>
          </div>
          <button onClick={onFechar} style={{ background: 'none', border: 'none', color: cores.textFaint, fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: 0, marginLeft: 12 }}>×</button>
        </div>

        {/* Barra de progresso do nível atual */}
        <div style={{ background: `${accentColor}0d`, border: `1px solid ${accentColor}25`, borderRadius: 10, padding: '12px 14px', marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: nivel.cor, fontFamily: fontDisplay }}>{nomeAtual}</span>
            <span style={{ fontSize: 10, color: cores.textFaint }}>{nivel.xpNoNivel.toLocaleString()} / {nivel.xpParaProximo.toLocaleString()} XP</span>
          </div>
          <div style={{ height: 7, background: cores.border, borderRadius: 4, overflow: 'hidden', marginBottom: 5 }}>
            <div style={{ height: '100%', width: `${nivel.pct}%`, background: `linear-gradient(90deg, ${nivel.cor}88, ${nivel.cor})`, borderRadius: 4, transition: 'width .6s' }} />
          </div>
          {proxNome
            ? <div style={{ fontSize: 10, color: cores.textFaint }}>Faltam <strong style={{ color: nivel.cor }}>{faltaXP.toLocaleString()} XP</strong> para <strong style={{ color: cores.text }}>{proxNome}</strong></div>
            : <div style={{ fontSize: 10, color: accentColor, fontWeight: 600 }}>👑 Nível máximo atingido!</div>
          }
        </div>

        {/* Acordeão de níveis */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {NIVEIS.map(nv => {
            const atingido  = xpTotal >= nv.min
            const atual     = nivel.nivel === nv.nivel
            const aberto    = nivelExpandido === nv.nivel
            const nome      = getNomeNivel(nv, m)
            const itens     = eventosPorNivel[nv.nivel] || []
            const xpNaNivel = itens.reduce((a, e) => a + e.xp, 0)

            return (
              <div key={nv.nivel} style={{ borderRadius: 10, border: `1px solid ${atual ? nv.cor + '55' : aberto && atingido ? nv.cor + '33' : cores.border}`, overflow: 'hidden', opacity: atingido ? 1 : 0.38 }}>

                {/* Cabeçalho do nível — clicável */}
                <button
                  onClick={() => atingido && setNivelExpandido(aberto ? null : nv.nivel)}
                  disabled={!atingido}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px',
                    background: atual ? `${nv.cor}10` : aberto ? `${nv.cor}06` : 'transparent',
                    border: 'none', cursor: atingido ? 'pointer' : 'default', textAlign: 'left',
                    transition: 'background .15s',
                  }}
                >
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: atingido ? nv.cor : cores.border, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: atual ? 700 : 500, color: atingido ? cores.text : cores.textFaint, fontFamily: atual ? fontDisplay : 'inherit' }}>
                        {nome}
                      </span>
                      {atual && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: `${nv.cor}22`, color: nv.cor, fontWeight: 700 }}>ATUAL</span>}
                    </div>
                    <div style={{ fontSize: 10, color: cores.textFaint }}>a partir de {nv.min.toLocaleString()} XP</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {xpNaNivel > 0 && <div style={{ fontSize: 11, fontWeight: 600, color: nv.cor }}>+{xpNaNivel.toLocaleString()} XP</div>}
                    <div style={{ fontSize: 10, color: cores.textFaint }}>{itens.length} evento{itens.length !== 1 ? 's' : ''}</div>
                  </div>
                  {atingido && (
                    <span style={{ color: cores.textFaint, fontSize: 11, marginLeft: 4, transition: 'transform .2s', display: 'inline-block', transform: aberto ? 'rotate(180deg)' : 'none' }}>▾</span>
                  )}
                </button>

                {/* Lista de movimentações do nível */}
                {aberto && itens.length > 0 && (
                  <div style={{ borderTop: `1px solid ${cores.border}` }}>
                    {itens.map((ev, idx) => (
                      <div key={ev.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                        borderBottom: idx < itens.length - 1 ? `1px solid ${cores.border}` : 'none',
                        background: cores.surface,
                      }}>
                        <div style={{ width: 28, height: 28, borderRadius: 7, background: `${ev.cor}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                          {ev.icone}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 500, color: cores.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.titulo}</div>
                          <div style={{ fontSize: 10, color: cores.textFaint }}>{ev.subtitulo}</div>
                        </div>
                        <div style={{ flexShrink: 0, textAlign: 'right' }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: ev.cor }}>+{ev.xp}</div>
                          {ev.tipo === 'transacao' && <div style={{ fontSize: 9, color: cores.textFaint }}>{fmtData(ev.data)}</div>}
                        </div>
                      </div>
                    ))}

                    {/* Subtotal do nível */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '7px 12px', background: `${nv.cor}06` }}>
                      <span style={{ fontSize: 11, color: cores.textMuted, marginRight: 8 }}>Total neste nível:</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: nv.cor }}>{xpNaNivel.toLocaleString()} XP</span>
                    </div>
                  </div>
                )}

                {/* Nível atingido mas sem eventos ainda */}
                {aberto && itens.length === 0 && atingido && (
                  <div style={{ padding: '12px', textAlign: 'center', fontSize: 11, color: cores.textFaint, background: cores.surface, borderTop: `1px solid ${cores.border}` }}>
                    Você chegou a este nível com o XP acumulado de outros eventos.
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Rodapé total */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, padding: '10px 14px', background: `${accentColor}0d`, border: `1px solid ${accentColor}25`, borderRadius: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: cores.textMuted }}>XP Total acumulado</div>
            <div style={{ fontSize: 10, color: cores.textFaint }}>{transacoes.length} lançamentos · {metas.length} metas</div>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: accentColor, fontVariantNumeric: 'tabular-nums' }}>
            {xpTotal.toLocaleString()} XP
          </div>
        </div>
      </div>
    </div>
  )
}
