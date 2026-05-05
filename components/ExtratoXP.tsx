'use client'

import { useCores, useTema } from '@/components/ThemeProvider'
import { calcularNivel, getNomeNivel, NIVEIS } from '@/lib/calcularXP'

interface Props {
  xpTotal: number
  xpTransacoes: number
  xpSaldo: number
  xpBonus: number
  saldo: number
  transacoesCount: number
  metasAtivas: number
  metasConcluidas: number
  onFechar: () => void
}

interface LinhaXP {
  label: string
  descricao: string
  xp: number
  icone: string
  cor: string
}

export default function ExtratoXP({
  xpTotal, xpTransacoes, xpSaldo, xpBonus,
  saldo, transacoesCount, metasAtivas, metasConcluidas,
  onFechar,
}: Props) {
  const cores = useCores()
  const { tema } = useTema()
  const m = tema === 'medieval'
  const accentColor = m ? '#D4AF37' : cores.accent
  const fontDisplay = m ? 'var(--font-cinzel, Georgia, serif)' : 'inherit'

  const nivel     = calcularNivel(xpTotal)
  const proxNivel = nivel.proximoNivel
  const nomeAtual = getNomeNivel(nivel, m)
  const proxNome  = proxNivel ? getNomeNivel(proxNivel, m) : null
  const faltaXP   = proxNivel ? proxNivel.min - xpTotal : 0

  const linhas: LinhaXP[] = [
    {
      label: 'Lançamentos registrados',
      descricao: `${transacoesCount} lançamento${transacoesCount !== 1 ? 's' : ''} × 10 XP`,
      xp: xpTransacoes,
      icone: '📝',
      cor: '#22d3ee',
    },
    {
      label: 'Saldo positivo',
      descricao: saldo >= 0 ? `R$ ${saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ÷ 10` : 'Saldo negativo (0 XP)',
      xp: xpSaldo,
      icone: '💰',
      cor: saldo >= 0 ? '#4ade80' : '#6b7280',
    },
    {
      label: 'Metas ativas',
      descricao: `${metasAtivas} meta${metasAtivas !== 1 ? 's' : ''} × 50 XP`,
      xp: metasAtivas * 50,
      icone: '🎯',
      cor: '#a78bfa',
    },
    {
      label: 'Metas concluídas',
      descricao: `${metasConcluidas} meta${metasConcluidas !== 1 ? 's' : ''} × 200 XP`,
      xp: metasConcluidas * 200,
      icone: '🏆',
      cor: '#fbbf24',
    },
    {
      label: 'Bônus (notificações & tour)',
      descricao: 'XP ganho por ler notificações e completar o tour',
      xp: xpBonus,
      icone: '⭐',
      cor: accentColor,
    },
  ].filter(l => l.xp > 0 || l.label === 'Saldo positivo')

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onFechar}
    >
      <div
        style={{ background: cores.cardBg, border: `1px solid ${accentColor}33`, borderRadius: 18, padding: '24px 22px', maxWidth: 440, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: `0 24px 64px rgba(0,0,0,.5), 0 0 0 1px ${accentColor}18` }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: cores.text, fontFamily: fontDisplay, marginBottom: 3 }}>
              {m ? '⚔ Crônica de Glória' : '⭐ Extrato de XP'}
            </div>
            <div style={{ fontSize: 12, color: cores.textMuted }}>
              {m ? 'Seus feitos e conquistas acumulados' : 'Detalhamento de como você acumulou XP'}
            </div>
          </div>
          <button onClick={onFechar} style={{ background: 'none', border: 'none', color: cores.textFaint, fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: 0, marginLeft: 12 }}>×</button>
        </div>

        {/* Card de nível atual */}
        <div style={{ background: `${accentColor}0d`, border: `1px solid ${accentColor}30`, borderRadius: 12, padding: '16px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: `${nivel.cor}18`, border: `1px solid ${nivel.cor}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
              {m ? '⚔' : '🏅'}
            </div>
            <div>
              <div style={{ fontSize: 11, color: cores.textFaint, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 2 }}>
                {m ? 'Título' : 'Nível atual'}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: nivel.cor, fontFamily: fontDisplay }}>{nomeAtual}</div>
              <div style={{ fontSize: 11, color: cores.textMuted }}>Nível {nivel.nivel} · {xpTotal.toLocaleString()} XP total</div>
            </div>
          </div>

          {/* Barra de progresso para próximo nível */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 10, color: cores.textFaint }}>{nivel.xpNoNivel.toLocaleString()} / {nivel.xpParaProximo.toLocaleString()} XP</span>
              <span style={{ fontSize: 10, color: cores.textFaint }}>{nivel.pct}%</span>
            </div>
            <div style={{ height: 7, background: cores.border, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${nivel.pct}%`, background: `linear-gradient(90deg, ${nivel.cor}88, ${nivel.cor})`, borderRadius: 4, transition: 'width .6s' }} />
            </div>
            {proxNome && faltaXP > 0 && (
              <div style={{ fontSize: 10, color: cores.textFaint, marginTop: 5 }}>
                Faltam <strong style={{ color: nivel.cor }}>{faltaXP.toLocaleString()} XP</strong> para {m ? 'o título de ' : 'o nível '}<strong style={{ color: cores.text }}>{proxNome}</strong>
              </div>
            )}
            {!proxNome && (
              <div style={{ fontSize: 10, color: accentColor, marginTop: 5, fontWeight: 600 }}>
                {m ? '👑 Nível máximo atingido!' : '👑 Nível máximo!'}
              </div>
            )}
          </div>
        </div>

        {/* Linha do tempo de níveis */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: cores.textMuted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>
            {m ? 'Jornada de Títulos' : 'Progressão de Níveis'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {NIVEIS.map(n => {
              const atingido = xpTotal >= n.min
              const atual    = nivel.nivel === n.nivel
              return (
                <div key={n.nivel} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8,
                  background: atual ? `${n.cor}12` : 'transparent',
                  border: `1px solid ${atual ? n.cor + '40' : cores.border}`,
                  opacity: atingido ? 1 : 0.4,
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: atingido ? n.cor : cores.border, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 12, fontWeight: atual ? 700 : 400, color: atingido ? cores.text : cores.textFaint, fontFamily: atual ? fontDisplay : 'inherit' }}>
                      {getNomeNivel(n, m)}
                    </span>
                    {atual && <span style={{ marginLeft: 6, fontSize: 9, padding: '1px 6px', borderRadius: 10, background: `${n.cor}20`, color: n.cor, fontWeight: 600 }}>ATUAL</span>}
                  </div>
                  <span style={{ fontSize: 10, color: cores.textFaint, fontVariantNumeric: 'tabular-nums' }}>
                    {n.min.toLocaleString()} XP
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Detalhamento por fonte */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: cores.textMuted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>
            {m ? 'Fontes de Glória' : 'Como você ganhou XP'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {linhas.map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: cores.surface, border: `1px solid ${cores.border}`, borderRadius: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: `${l.cor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>
                  {l.icone}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: cores.text }}>{l.label}</div>
                  <div style={{ fontSize: 10, color: cores.textFaint }}>{l.descricao}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: l.cor, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                  +{l.xp.toLocaleString()}
                </div>
              </div>
            ))}

            {/* Total */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: `${accentColor}0d`, border: `1px solid ${accentColor}30`, borderRadius: 10, marginTop: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: cores.text }}>Total</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: accentColor, fontVariantNumeric: 'tabular-nums' }}>
                {xpTotal.toLocaleString()} XP
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
