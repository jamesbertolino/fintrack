'use client'

import { useEffect, useState } from 'react'
import { useCores } from '@/components/ThemeProvider'

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''

function urlBase64ToUint8Array(base64: string) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

type Estado = 'loading' | 'unsupported' | 'denied' | 'granted' | 'default'

interface Props {
  /** Quando true, mostra o botão inline (ex: card no perfil) */
  inline?: boolean
}

export default function PushManager({ inline = false }: Props) {
  const cores = useCores()
  const [estado, setEstado] = useState<Estado>('loading')
  const [inscrevendo, setInscrevendo] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) { setEstado('unsupported'); return }
    setEstado(Notification.permission as Estado)

    // Registra o SW e recarrega automaticamente quando nova versão ativar
    navigator.serviceWorker.register('/sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const newSw = reg.installing
        if (!newSw) return
        newSw.addEventListener('statechange', () => {
          if (newSw.state === 'activated') window.location.reload()
        })
      })
    }).catch(() => null)
  }, [])

  async function ativar() {
    if (inscrevendo) return
    setInscrevendo(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') { setEstado('denied'); return }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      })

      const json = sub.toJSON()
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      })

      setEstado('granted')
    } catch {
      setEstado('denied')
    } finally {
      setInscrevendo(false)
    }
  }

  async function desativar() {
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setEstado('default')
    } catch { /* silencioso */ }
  }

  if (estado === 'loading' || estado === 'unsupported') return null

  if (inline) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: cores.surfaceAlt, borderRadius: 10, border: `1px solid ${cores.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>🔔</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: cores.text }}>Notificações push</div>
            <div style={{ fontSize: 11, color: cores.textMuted }}>
              {estado === 'granted' ? 'Ativas neste dispositivo' : estado === 'denied' ? 'Bloqueadas pelo navegador' : 'Receba alertas mesmo sem abrir o app'}
            </div>
          </div>
        </div>

        {estado === 'granted' ? (
          <button onClick={desativar} style={{ fontSize: 11, padding: '5px 12px', borderRadius: 7, border: `1px solid ${cores.border}`, background: 'transparent', color: cores.textMuted, cursor: 'pointer' }}>
            Desativar
          </button>
        ) : estado === 'denied' ? (
          <span style={{ fontSize: 11, color: '#f87171' }}>Bloqueado</span>
        ) : (
          <button onClick={ativar} disabled={inscrevendo} style={{ fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 7, border: 'none', background: cores.accent, color: '#fff', cursor: 'pointer', opacity: inscrevendo ? 0.7 : 1 }}>
            {inscrevendo ? '...' : 'Ativar'}
          </button>
        )}
      </div>
    )
  }

  // Banner flutuante para quem ainda não ativou (aparece após 3s)
  if (estado !== 'default') return null
  return <PushBanner onAtivar={ativar} inscrevendo={inscrevendo} cores={cores} />
}

function PushBanner({ onAtivar, inscrevendo, cores }: { onAtivar: () => void; inscrevendo: boolean; cores: ReturnType<typeof useCores> }) {
  const [visivel, setVisivel] = useState(false)

  useEffect(() => {
    const dismissed = sessionStorage.getItem('push_banner_dismissed')
    if (dismissed) return
    const t = setTimeout(() => setVisivel(true), 5000)
    return () => clearTimeout(t)
  }, [])

  function dispensar() {
    sessionStorage.setItem('push_banner_dismissed', '1')
    setVisivel(false)
  }

  if (!visivel) return null

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 7000,
      background: cores.cardBg, border: `1px solid ${cores.cardBorder}`,
      borderRadius: 14, padding: '14px 16px', boxShadow: cores.cardShadow,
      maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 10,
      animation: 'slideUp .3s ease',
    }}>
      <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}`}</style>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ fontSize: 22, flexShrink: 0 }}>🔔</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: cores.text, marginBottom: 3 }}>Ativar notificações</div>
          <div style={{ fontSize: 12, color: cores.textMuted, lineHeight: 1.5 }}>
            Receba alertas de gastos, metas e missões diretamente no seu dispositivo.
          </div>
        </div>
        <button onClick={dispensar} style={{ background: 'none', border: 'none', color: cores.textFaint, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0, flexShrink: 0 }}>×</button>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={dispensar} style={{ flex: 1, padding: '7px', borderRadius: 8, border: `1px solid ${cores.border}`, background: 'transparent', color: cores.textMuted, fontSize: 12, cursor: 'pointer' }}>
          Agora não
        </button>
        <button onClick={onAtivar} disabled={inscrevendo} style={{ flex: 1, padding: '7px', borderRadius: 8, border: 'none', background: cores.accent, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          {inscrevendo ? '...' : 'Ativar'}
        </button>
      </div>
    </div>
  )
}
