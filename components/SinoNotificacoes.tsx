'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { useCores } from '@/components/ThemeProvider'

interface Notificacao {
  id: string
  tipo: string
  titulo: string
  mensagem: string
  lida: boolean
  created_at: string
}

const ICONES: Record<string, string> = {
  sugestao_meta: '💰', limite_categoria: '⚠️',
  marco_meta: '🎯', fim_mes: '📅', default: '🔔',
}

function fmtTempo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  const h   = Math.floor(diff / 3600000)
  if (min < 1)  return 'agora'
  if (min < 60) return `${min}min`
  if (h < 24)   return `${h}h`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export default function SinoNotificacoes() {
  const router = useRouter()
  const supabase = createClient()
  const ref = useRef<HTMLDivElement>(null)
  const cores = useCores()

  const [notifs, setNotifs]   = useState<Notificacao[]>([])
  const [aberto, setAberto]   = useState(false)
  const [animando, setAnim]   = useState(false)

  const naoLidas = notifs.filter(n => !n.lida).length

  const carregar = useCallback(async () => {
    try {
      const res = await fetch('/api/notificacoes')
      if (!res.ok) return
      const data = await res.json()
      const novas = data.notificacoes || []

      // Animar sino se chegou nova notificação
      if (novas.filter((n: Notificacao) => !n.lida).length > naoLidas) {
        setAnim(true)
        setTimeout(() => setAnim(false), 600)
      }
      setNotifs(novas)
    } catch { /* silencioso — polling best-effort */ }
  }, [naoLidas])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar()

    const channel = supabase
      .channel('sino-notificacoes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => {
        carregar()
        setAnim(true)
        setTimeout(() => setAnim(false), 600)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [carregar, supabase])

  // Fechar ao clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function marcarLida(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n))
    const res = await fetch('/api/notificacoes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (!res.ok) setNotifs(prev => prev.map(n => n.id === id ? { ...n, lida: false } : n))
  }

  async function marcarTodas(e: React.MouseEvent) {
    e.stopPropagation()
    const snapshot = notifs
    setNotifs(prev => prev.map(n => ({ ...n, lida: true })))
    const res = await fetch('/api/notificacoes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ todas: true }),
    })
    if (!res.ok) setNotifs(snapshot)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Botão sino */}
      <button
        onClick={() => { setAberto(!aberto); if (!aberto) carregar() }}
        style={{
          width: 34, height: 34, borderRadius: 8,
          background: aberto ? cores.accentGlow : 'transparent',
          border: `1px solid ${aberto ? cores.accent : cores.borderMid}`,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: aberto ? cores.accent : cores.textMuted, position: 'relative',
          animation: animando ? 'shake .3s ease' : 'none',
          transition: 'all .15s',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 2a5 5 0 00-5 5v3l-1 1v1h12v-1l-1-1V7a5 5 0 00-5-5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
          <path d="M6.5 13a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
        {naoLidas > 0 && (
          <div style={{
            position: 'absolute', top: -4, right: -4,
            width: 16, height: 16, borderRadius: '50%',
            background: '#16a34a', border: `2px solid ${cores.pageBg}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 700, color: '#fff',
          }}>
            {naoLidas > 9 ? '9+' : naoLidas}
          </div>
        )}
      </button>

      {/* Dropdown */}
      {aberto && (
        <div style={{
          position: 'absolute', top: 42, right: 0,
          width: 340, maxWidth: 'calc(100vw - 16px)', maxHeight: 420, overflowY: 'auto',
          background: cores.surface, border: `1px solid ${cores.border}`,
          borderRadius: 12, zIndex: 100,
          boxShadow: cores.cardShadow,
        }}>
          {/* Header dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: `1px solid ${cores.border}`, color: cores.text }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              Notificações {naoLidas > 0 && <span style={{ color: cores.accent }}>({naoLidas})</span>}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              {naoLidas > 0 && (
                <button onClick={marcarTodas} style={{ fontSize: 10, color: cores.textMuted, background: 'none', border: 'none', cursor: 'pointer' }}>
                  marcar todas
                </button>
              )}
              <button onClick={() => { setAberto(false); router.push('/dashboard/notificacoes') }} style={{ fontSize: 10, color: cores.accent, background: 'none', border: 'none', cursor: 'pointer' }}>
                ver todas →
              </button>
            </div>
          </div>

          {/* Lista */}
          {notifs.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: cores.textFaint, fontSize: 12 }}>
              Nenhuma notificação ainda
            </div>
          ) : notifs.slice(0, 8).map(n => (
            <div key={n.id} style={{
              display: 'flex', gap: 10, padding: '10px 14px',
              borderBottom: `1px solid ${cores.border}`,
              background: n.lida ? 'transparent' : cores.accentGlow,
              cursor: n.lida ? 'default' : 'pointer',
              transition: 'background .12s',
            }}
              onClick={e => !n.lida && marcarLida(n.id, e)}
              onMouseEnter={e => (e.currentTarget.style.background = cores.navActive)}
              onMouseLeave={e => (e.currentTarget.style.background = n.lida ? 'transparent' : cores.accentGlow)}
            >
              <div style={{ fontSize: 18, flexShrink: 0, marginTop: 2 }}>
                {ICONES[n.tipo] || ICONES.default}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: n.lida ? 400 : 600, color: n.lida ? cores.textMuted : cores.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {n.titulo}
                  </span>
                  {!n.lida && <div style={{ width: 6, height: 6, borderRadius: '50%', background: cores.accent, flexShrink: 0 }} />}
                </div>
                <div style={{ fontSize: 11, color: cores.textMuted, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {n.mensagem}
                </div>
                <div style={{ fontSize: 10, color: cores.textFaint, marginTop: 3 }}>{fmtTempo(n.created_at)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes shake {
          0%,100% { transform: rotate(0deg); }
          25% { transform: rotate(-15deg); }
          75% { transform: rotate(15deg); }
        }
      `}</style>
    </div>
  )
}