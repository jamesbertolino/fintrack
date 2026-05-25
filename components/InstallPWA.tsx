'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

declare global {
  interface Window { __pwaPrompt?: BeforeInstallPromptEvent | null }
}

export default function InstallPWA() {
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null)
  const [visivel, setVisivel] = useState(false)
  const [isIOS] = useState(() =>
    typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent)
  )

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true
    const mobile = window.innerWidth < 768 || /Android|iPhone|iPad/i.test(navigator.userAgent)
    if (standalone || !mobile) return
    if (sessionStorage.getItem('pwa_dismiss')) return

    if (isIOS) {
      const t = setTimeout(() => setVisivel(true), 3000)
      return () => clearTimeout(t)
    }

    // Lê evento já capturado antes do React montar
    const already = window.__pwaPrompt
    if (already) {
      promptRef.current = already
      const t = setTimeout(() => setVisivel(true), 3000)
      return () => clearTimeout(t)
    }

    // Ainda não disparou — escuta normalmente
    const handler = (e: Event) => {
      e.preventDefault()
      const evt = e as BeforeInstallPromptEvent
      window.__pwaPrompt = evt
      promptRef.current = evt
      setTimeout(() => setVisivel(true), 3000)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [isIOS])

  function dispensar() {
    sessionStorage.setItem('pwa_dismiss', '1')
    setVisivel(false)
  }

  async function instalar() {
    if (!promptRef.current) return
    await promptRef.current.prompt()
    const { outcome } = await promptRef.current.userChoice
    if (outcome === 'accepted') setVisivel(false)
  }

  if (!visivel) return null

  return (
    <div style={{
      position: 'fixed', bottom: 'calc(70px + env(safe-area-inset-bottom, 0px))',
      left: 12, right: 12, zIndex: 999,
      background: '#0d2e0d',
      border: '1px solid rgba(74,222,128,.3)',
      borderRadius: 16,
      padding: '14px 16px',
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 8px 32px rgba(0,0,0,.5)',
      fontFamily: 'system-ui, sans-serif',
      animation: 'slideUp .3s ease',
    }}>
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0 }
          to   { transform: translateY(0);    opacity: 1 }
        }
      `}</style>

      <Image src="/logo.png" width={44} height={44} alt="PoupaUp"
        style={{ borderRadius: 10, flexShrink: 0 }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 2 }}>
          Instalar PoupaUp
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', lineHeight: 1.4 }}>
          {isIOS
            ? 'Toque em Compartilhar → "Adicionar à Tela de Início"'
            : 'Adicione à tela inicial para acesso rápido'}
        </div>
      </div>

      {isIOS ? (
        <button onClick={dispensar} style={btnClose}>✕</button>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={dispensar} style={btnClose}>✕</button>
          <button onClick={instalar} style={{
            background: '#16a34a', border: 'none', borderRadius: 10,
            color: '#fff', fontSize: 13, fontWeight: 700,
            padding: '8px 14px', cursor: 'pointer', whiteSpace: 'nowrap',
          }}>
            Instalar
          </button>
        </div>
      )}
    </div>
  )
}

const btnClose: React.CSSProperties = {
  background: 'rgba(255,255,255,.08)', border: 'none', borderRadius: 8,
  color: 'rgba(255,255,255,.5)', fontSize: 14, cursor: 'pointer',
  width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0,
}
