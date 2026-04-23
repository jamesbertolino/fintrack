'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

interface Notificacao {
  id: string
  tipo: string
  titulo: string
  mensagem: string
  lida: boolean
  created_at: string
}

const ICONES: Record<string, { emoji: string; cor: string; bg: string }> = {
  sugestao_meta:    { emoji: '💰', cor: '#4ade80', bg: 'rgba(74,222,128,.1)' },
  limite_categoria: { emoji: '⚠️', cor: '#f97316', bg: 'rgba(249,115,22,.1)' },
  marco_meta:       { emoji: '🎯', cor: '#a78bfa', bg: 'rgba(167,139,250,.1)' },
  fim_mes:          { emoji: '📅', cor: '#fbbf24', bg: 'rgba(251,191,36,.1)' },
  default:          { emoji: '🔔', cor: '#4ade80', bg: 'rgba(74,222,128,.1)' },
}

function fmtTempo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const min  = Math.floor(diff / 60000)
  const h    = Math.floor(diff / 3600000)
  const d    = Math.floor(diff / 86400000)
  if (min < 1)  return 'agora'
  if (min < 60) return `há ${min}min`
  if (h < 24)   return `há ${h}h`
  if (d < 7)    return `há ${d}d`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export default function NotificacoesPage() {
  const router = useRouter()
  const supabase = createClient()

  const [notifs, setNotifs]     = useState<Notificacao[]>([])
  const [loading, setLoading]   = useState(true)
  const [filtro, setFiltro]     = useState<'todas' | 'nao_lidas'>('todas')

  const carregar = useCallback(async () => {
    const res = await fetch('/api/notificacoes')
    const data = await res.json()
    setNotifs(data.notificacoes || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar()

    // Realtime — novas notificações chegam ao vivo
    const channel = supabase
      .channel('notificacoes-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => {
        carregar()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [carregar, supabase])

  async function marcarLida(id: string) {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n))
    await fetch('/api/notificacoes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
  }

  async function marcarTodasLidas() {
    setNotifs(prev => prev.map(n => ({ ...n, lida: true })))
    await fetch('/api/notificacoes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ todas: true }),
    })
  }

  async function apagar(id: string) {
    setNotifs(prev => prev.filter(n => n.id !== id))
    await fetch('/api/notificacoes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
  }

  async function simularNotificacao() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('notifications').insert({
      user_id: user.id,
      tipo: 'sugestao_meta',
      titulo: 'Receita detectada!',
      mensagem: 'Uma nova receita foi registrada. Deseja alocar parte para suas metas?',
      lida: false,
    })
    carregar()
  }

  const filtradas = filtro === 'nao_lidas' ? notifs.filter(n => !n.lida) : notifs
  const naoLidas  = notifs.filter(n => !n.lida).length

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)' }}>Carregando notificações...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: 'system-ui, sans-serif', fontSize: 13, color: '#fff' }}>

      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.875rem 1.5rem', borderBottom: '1px solid #1a3a1a', background: '#0a1a0a' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.4)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Dashboard
          </button>
          <span style={{ color: 'rgba(255,255,255,.2)' }}>/</span>
          <span style={{ fontSize: 15, fontWeight: 500 }}>Notificações</span>
          {naoLidas > 0 && (
            <span style={{ background: '#16a34a', color: '#fff', fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 10 }}>
              {naoLidas} nova{naoLidas > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {naoLidas > 0 && (
            <button onClick={marcarTodasLidas} style={{ fontSize: 11, padding: '6px 12px', background: 'transparent', border: '1px solid #1a3a1a', borderRadius: 8, color: 'rgba(255,255,255,.5)', cursor: 'pointer' }}>
              Marcar todas como lidas
            </button>
          )}
          <button onClick={simularNotificacao} style={{ fontSize: 11, padding: '6px 12px', background: 'rgba(74,222,128,.1)', border: '1px solid rgba(74,222,128,.2)', borderRadius: 8, color: '#4ade80', cursor: 'pointer' }}>
            + Simular alerta
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '1.5rem' }}>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,.3)', border: '1px solid #1a3a1a', borderRadius: 8, padding: 3, marginBottom: '1.25rem', width: 'fit-content' }}>
          {(['todas', 'nao_lidas'] as const).map(f => (
            <button key={f} onClick={() => setFiltro(f)} style={{
              padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
              background: filtro === f ? '#16a34a' : 'transparent',
              color: filtro === f ? '#fff' : 'rgba(255,255,255,.4)',
            }}>
              {f === 'todas' ? `Todas (${notifs.length})` : `Não lidas (${naoLidas})`}
            </button>
          ))}
        </div>

        {/* Lista */}
        {filtradas.length === 0 ? (
          <div style={{ background: '#111', border: '1px dashed #1a3a1a', borderRadius: 12, padding: '4rem', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔔</div>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>
              {filtro === 'nao_lidas' ? 'Nenhuma notificação não lida' : 'Nenhuma notificação ainda'}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', marginBottom: 20 }}>
              As notificações aparecem quando metas avançam, categorias estouram ou receitas chegam.
            </div>
            <button onClick={simularNotificacao} style={{ padding: '8px 16px', background: '#16a34a', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
              Simular primeira notificação
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtradas.map(n => {
              const icone = ICONES[n.tipo] || ICONES.default
              return (
                <div key={n.id} onClick={() => !n.lida && marcarLida(n.id)} style={{
                  background: n.lida ? '#111' : '#0f1f0f',
                  border: `1px solid ${n.lida ? '#1a3a1a' : 'rgba(74,222,128,.2)'}`,
                  borderLeft: `3px solid ${n.lida ? '#1a3a1a' : icone.cor}`,
                  borderRadius: 12, padding: '12px 14px',
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  cursor: n.lida ? 'default' : 'pointer',
                  transition: 'all .15s', opacity: n.lida ? 0.7 : 1,
                }}>
                  {/* Ícone */}
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: icone.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                  }}>
                    {icone.emoji}
                  </div>

                  {/* Conteúdo */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 13, fontWeight: n.lida ? 400 : 600, color: n.lida ? 'rgba(255,255,255,.7)' : '#fff' }}>
                        {n.titulo}
                      </span>
                      {!n.lida && (
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', flexShrink: 0 }} />
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', lineHeight: 1.5, marginBottom: 5 }}>
                      {n.mensagem}
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)' }}>{fmtTempo(n.created_at)}</div>
                  </div>

                  {/* Ações */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0 }}>
                    {!n.lida && (
                      <button onClick={e => { e.stopPropagation(); marcarLida(n.id) }} style={{
                        fontSize: 10, padding: '3px 8px', background: 'rgba(74,222,128,.1)', border: '1px solid rgba(74,222,128,.2)',
                        borderRadius: 5, color: '#4ade80', cursor: 'pointer',
                      }}>
                        ✓ lida
                      </button>
                    )}
                    <button onClick={e => { e.stopPropagation(); apagar(n.id) }} style={{
                      fontSize: 10, padding: '3px 8px', background: 'transparent', border: '1px solid #1a3a1a',
                      borderRadius: 5, color: 'rgba(255,255,255,.3)', cursor: 'pointer',
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