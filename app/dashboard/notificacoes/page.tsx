'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCores, useTema } from '@/components/ThemeProvider'
import { usePerfil } from '@/hooks/usePerfil'

interface Notificacao {
  id: string
  tipo: string
  titulo: string
  mensagem: string
  lida: boolean
  xp_recompensa: number
  created_at: string
}

const ICONE_TIPO: Record<string, { emoji: string; cor: string }> = {
  ia_diaria:        { emoji: '🤖', cor: '#a78bfa' },
  alerta_gasto:     { emoji: '⚠️', cor: '#f97316' },
  dica_economia:    { emoji: '💡', cor: '#22d3ee' },
  progresso_meta:   { emoji: '🎯', cor: '#4ade80' },
  motivacao:        { emoji: '⚡', cor: '#fbbf24' },
  planejamento:     { emoji: '📋', cor: '#60a5fa' },
  sugestao_meta:    { emoji: '💰', cor: '#4ade80' },
  limite_categoria: { emoji: '⚠️', cor: '#f97316' },
  marco_meta:       { emoji: '🏆', cor: '#a78bfa' },
  fim_mes:          { emoji: '📅', cor: '#fbbf24' },
  default:          { emoji: '🔔', cor: '#4ade80' },
}

function iconeFor(tipo: string) {
  return ICONE_TIPO[tipo] || ICONE_TIPO.default
}

function fmtTempo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const min  = Math.floor(diff / 60000)
  const h    = Math.floor(diff / 3600000)
  const d    = Math.floor(diff / 86400000)
  if (min < 1)  return 'agora'
  if (min < 60) return `há ${min}min`
  if (h < 24)   return `há ${h}h`
  if (d === 1)  return 'ontem'
  if (d < 7)    return `há ${d} dias`
  return new Date(iso).toLocaleDateString('pt-BR')
}

export default function NotificacoesPage() {
  const router       = useRouter()
  const cores        = useCores()
  const { tema }     = useTema()
  const { fmtData }  = usePerfil()
  const m            = tema === 'medieval'

  const accentColor  = m ? '#D4AF37' : cores.accent
  const fontDisplay  = m ? 'var(--font-cinzel, Georgia, serif)' : 'inherit'

  const [notifs, setNotifs]           = useState<Notificacao[]>([])
  const [loading, setLoading]         = useState(true)
  const [filtro, setFiltro]           = useState<'todas' | 'nao_lidas'>('todas')
  const [iaAnalisando, setIaAnalisando] = useState(false)
  const [xpFlash, setXpFlash]         = useState<number | null>(null)

  const carregar = useCallback(async () => {
    const res  = await fetch('/api/notificacoes')
    const data = await res.json()
    setNotifs(data.notificacoes || [])
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar]) // eslint-disable-line react-hooks/set-state-in-effect

  async function marcarLida(id: string) {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n))
    const res  = await fetch('/api/notificacoes', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    const data = await res.json()
    if (data.xpGanho > 0) mostrarXpFlash(data.xpGanho)
  }

  async function marcarTodasLidas() {
    setNotifs(prev => prev.map(n => ({ ...n, lida: true })))
    const res  = await fetch('/api/notificacoes', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ todas: true }) })
    const data = await res.json()
    if (data.xpGanho > 0) mostrarXpFlash(data.xpGanho)
  }

  async function apagar(id: string) {
    setNotifs(prev => prev.filter(n => n.id !== id))
    await fetch('/api/notificacoes', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
  }

  function mostrarXpFlash(xp: number) {
    setXpFlash(xp)
    setTimeout(() => setXpFlash(null), 2500)
  }

  async function gerarComIA() {
    setIaAnalisando(true)
    const res  = await fetch('/api/notificacoes/ia', { method: 'POST' })
    const data = await res.json()
    setIaAnalisando(false)
    if (data.ok) {
      await carregar()
    } else if (data.limite) {
      alert('Limite de 2 análises diárias atingido. Volte amanhã!')
    } else {
      alert(data.error || 'Erro ao gerar notificações.')
    }
  }

  const filtradas = filtro === 'nao_lidas' ? notifs.filter(n => !n.lida) : notifs
  const naoLidas  = notifs.filter(n => !n.lida).length
  void fmtData // usado por fmtTempo indiretamente

  return (
    <div style={{ minHeight: '100vh', background: cores.pageBg, fontFamily: 'system-ui, sans-serif', fontSize: 13, color: cores.text }}>

      {/* Overlay IA */}
      {iaAnalisando && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backdropFilter: 'blur(6px) brightness(0.45)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
          <div style={{ position: 'relative', width: 64, height: 64 }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `3px solid ${accentColor}33` }} />
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `3px solid transparent`, borderTopColor: accentColor, animation: 'ia-spin 0.9s linear infinite' }} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>{m ? '🔮' : '🤖'}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', fontFamily: fontDisplay, marginBottom: 6 }}>
              {m ? 'O Oráculo consulta os astros…' : 'IA analisando sua situação…'}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.45)' }}>
              {m ? 'Aguarde as profecias do reino' : 'Criando notificações personalizadas'}
            </div>
          </div>
          <style>{`@keyframes ia-spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )}

      {/* Flash de XP ganho */}
      {xpFlash !== null && (
        <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 9998, background: `${accentColor}18`, border: `1px solid ${accentColor}55`, borderRadius: 12, padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 8, boxShadow: `0 4px 20px ${accentColor}33`, animation: 'xp-in .3s ease' }}>
          <span style={{ fontSize: 20 }}>⭐</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: accentColor }}>+{xpFlash} XP</div>
            <div style={{ fontSize: 10, color: cores.textMuted }}>Notificação lida</div>
          </div>
          <style>{`@keyframes xp-in { from { opacity:0; transform:translateY(-8px) } to { opacity:1; transform:none } }`}</style>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.875rem 1.5rem', borderBottom: `1px solid ${cores.border}`, background: cores.topbarBg, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: cores.textMuted, display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
            {m ? 'Reino' : 'Início'}
          </button>
          <span style={{ color: cores.textFaint }}>/</span>
          <span style={{ fontSize: 15, fontWeight: 600, fontFamily: fontDisplay, color: m ? '#F5E6C8' : cores.text }}>
            {m ? '📯 Pergaminhos do Reino' : '🔔 Notificações'}
          </span>
          {naoLidas > 0 && (
            <span style={{ background: accentColor, color: '#000', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>
              {naoLidas}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {naoLidas > 0 && (
            <button onClick={marcarTodasLidas} style={{ fontSize: 11, padding: '7px 12px', background: 'transparent', border: `1px solid ${cores.border}`, borderRadius: 8, color: cores.textMuted, cursor: 'pointer' }}>
              ✓ Marcar todas como lidas
            </button>
          )}
          <button onClick={gerarComIA} disabled={iaAnalisando}
            style={{ fontSize: 11, padding: '7px 14px', background: `${accentColor}18`, border: `1px solid ${accentColor}44`, borderRadius: 8, color: accentColor, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, minHeight: 44 }}>
            {m ? '🔮' : '🤖'} {m ? 'Consultar Oráculo' : 'Analisar com IA'}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '1.25rem 1.5rem' }}>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: 4, background: cores.surface, border: `1px solid ${cores.border}`, borderRadius: 8, padding: 3, marginBottom: '1.25rem', width: 'fit-content' }}>
          {(['todas', 'nao_lidas'] as const).map(f => (
            <button key={f} onClick={() => setFiltro(f)} style={{
              padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
              background: filtro === f ? accentColor : 'transparent',
              color: filtro === f ? (m ? '#000' : '#fff') : cores.textMuted,
              transition: 'all .15s',
            }}>
              {f === 'todas' ? `Todas (${notifs.length})` : `Não lidas (${naoLidas})`}
            </button>
          ))}
        </div>

        {/* Lista */}
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: cores.textMuted }}>Carregando...</div>
        ) : filtradas.length === 0 ? (
          <div style={{ background: cores.cardBg, border: `1px dashed ${cores.cardBorder}`, borderRadius: 12, padding: '3.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>{m ? '📯' : '🔔'}</div>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6, color: cores.text }}>
              {filtro === 'nao_lidas' ? 'Nenhuma notificação não lida' : (m ? 'Nenhum pergaminho ainda' : 'Nenhuma notificação ainda')}
            </div>
            <div style={{ fontSize: 12, color: cores.textFaint, marginBottom: 20 }}>
              {m ? 'Consulte o Oráculo para receber profecias sobre sua jornada.' : 'Use a IA para gerar análises da sua situação financeira.'}
            </div>
            <button onClick={gerarComIA} style={{ padding: '9px 18px', background: `${accentColor}18`, border: `1px solid ${accentColor}44`, borderRadius: 8, color: accentColor, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {m ? '🔮 Consultar Oráculo' : '🤖 Analisar com IA'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtradas.map(n => {
              const ic = iconeFor(n.tipo)
              return (
                <div key={n.id}
                  onClick={() => !n.lida && marcarLida(n.id)}
                  style={{
                    background: n.lida ? cores.cardBg : `${ic.cor}08`,
                    border: `1px solid ${n.lida ? cores.cardBorder : `${ic.cor}30`}`,
                    borderLeft: `3px solid ${n.lida ? cores.border : ic.cor}`,
                    borderRadius: 12, padding: '12px 14px',
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    cursor: n.lida ? 'default' : 'pointer',
                    transition: 'all .15s', opacity: n.lida ? 0.65 : 1,
                  }}>

                  {/* Ícone */}
                  <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: `${ic.cor}15`, border: `1px solid ${ic.cor}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                    {ic.emoji}
                  </div>

                  {/* Conteúdo */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: n.lida ? 400 : 600, color: n.lida ? cores.textMuted : cores.text }}>
                        {n.titulo}
                      </span>
                      {!n.lida && <div style={{ width: 7, height: 7, borderRadius: '50%', background: ic.cor, flexShrink: 0 }} />}
                      {n.xp_recompensa > 0 && !n.lida && (
                        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 700, background: `${accentColor}18`, color: accentColor, border: `1px solid ${accentColor}33` }}>
                          +{n.xp_recompensa} XP
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: cores.textMuted, lineHeight: 1.55, marginBottom: 5 }}>
                      {n.mensagem}
                    </div>
                    <div style={{ fontSize: 10, color: cores.textFaint }}>{fmtTempo(n.created_at)}</div>
                  </div>

                  {/* Ações */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0 }}>
                    {!n.lida && (
                      <button onClick={e => { e.stopPropagation(); marcarLida(n.id) }} style={{
                        fontSize: 10, padding: '4px 9px', background: `${accentColor}15`, border: `1px solid ${accentColor}33`,
                        borderRadius: 5, color: accentColor, cursor: 'pointer', fontWeight: 600,
                      }}>
                        ✓ lida
                      </button>
                    )}
                    <button onClick={e => { e.stopPropagation(); apagar(n.id) }} style={{
                      fontSize: 10, padding: '4px 9px', background: 'transparent', border: `1px solid ${cores.border}`,
                      borderRadius: 5, color: cores.textFaint, cursor: 'pointer',
                    }}>
                      apagar
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
