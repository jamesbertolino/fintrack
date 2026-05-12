'use client'

import { useState } from 'react'
import { useCores } from '@/components/ThemeProvider'

interface Props {
  userId: string
  nomeUsuario?: string
}

export default function ConvidarAmigos({ userId, nomeUsuario }: Props) {
  const cores = useCores()
  const [copiado, setCopiado] = useState(false)

  const appUrl  = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')
  const link    = `${appUrl}/ref/${userId}`
  const texto   = `🎯 Controle suas finanças com IA no PoupaUp!\n\nUse meu link e comece de graça:\n${link}`

  function copiar() {
    navigator.clipboard.writeText(link).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    })
  }

  function compartilharWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank')
  }

  const cardStyle: React.CSSProperties = {
    background: cores.surface,
    border: `1px solid ${cores.border}`,
    borderRadius: 14,
    padding: '1.25rem',
  }

  const linkBoxStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: cores.pageBg,
    border: `1px solid ${cores.border}`,
    borderRadius: 8,
    padding: '8px 10px',
    marginTop: 12,
    marginBottom: 12,
  }

  const btnStyle = (primary?: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '9px 14px',
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    background: primary ? '#16a34a' : cores.inputBg,
    color: primary ? '#fff' : cores.text,
  })

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 22 }}>🎁</span>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: cores.text }}>Convidar amigos</div>
          <div style={{ fontSize: 12, color: cores.textMuted }}>
            {nomeUsuario ? `${nomeUsuario}, ganhe` : 'Ganhe'} <strong style={{ color: '#4ade80' }}>+500 XP</strong> por cada amigo que se cadastrar pelo seu link!
          </div>
        </div>
      </div>

      <div style={linkBoxStyle}>
        <span style={{ fontSize: 11, color: cores.textMuted, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {link}
        </span>
        <button
          onClick={copiar}
          style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: `1px solid ${cores.border}`, background: copiado ? '#16a34a' : cores.inputBg, color: copiado ? '#fff' : cores.text, cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 600 }}
        >
          {copiado ? '✓ Copiado!' : 'Copiar'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={copiar} style={btnStyle()}>
          📋 Copiar link
        </button>
        <button onClick={compartilharWhatsApp} style={btnStyle(true)}>
          💬 Compartilhar
        </button>
      </div>
    </div>
  )
}
