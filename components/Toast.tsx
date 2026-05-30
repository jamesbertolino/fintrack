'use client'

import { useState, useCallback, useRef } from 'react'

type Tipo = 'sucesso' | 'erro' | 'info'

interface ToastMsg {
  id: number
  msg: string
  tipo: Tipo
}

const CORES: Record<Tipo, { bg: string; border: string; text: string; icon: string }> = {
  sucesso: { bg: '#0f1f0f', border: 'rgba(74,222,128,.35)',  text: '#4ade80', icon: '✓' },
  erro:    { bg: '#1f0f0f', border: 'rgba(239,68,68,.35)',   text: '#f87171', icon: '✕' },
  info:    { bg: '#0f0f1f', border: 'rgba(129,140,248,.35)', text: '#818cf8', icon: 'ℹ' },
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastMsg[]>([])
  const counter = useRef(0)

  const show = useCallback((msg: string, tipo: Tipo = 'sucesso') => {
    const id = ++counter.current
    setToasts(prev => [...prev, { id, msg, tipo }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3800)
  }, [])

  const fechar = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return { show, toasts, fechar }
}

export function Toasts({ toasts, fechar }: { toasts: ToastMsg[]; fechar: (id: number) => void }) {
  if (toasts.length === 0) return null
  return (
    <>
      <style>{`@keyframes toastIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div role="status" aria-live="polite" aria-atomic="false" style={{ position: 'fixed', bottom: 'calc(env(safe-area-inset-bottom,0px) + 80px)', right: 20, zIndex: 1100, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 340, width: 'calc(100vw - 40px)' }}>
        {toasts.map(t => {
          const c = CORES[t.tipo]
          return (
            <div key={t.id} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 12, padding: '12px 14px', boxShadow: '0 8px 32px rgba(0,0,0,.6)', animation: 'toastIn .2s ease', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 26, height: 26, borderRadius: 7, background: `${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13, color: c.text, fontWeight: 700 }}>
                {c.icon}
              </div>
              <span style={{ flex: 1, fontSize: 13, color: 'rgba(255,255,255,.85)', lineHeight: 1.4 }}>{t.msg}</span>
              <button onClick={() => fechar(t.id)} aria-label="Fechar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.25)', fontSize: 16, lineHeight: 1, padding: '0 2px', flexShrink: 0 }}>×</button>
            </div>
          )
        })}
      </div>
    </>
  )
}
