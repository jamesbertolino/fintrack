import React from 'react'

const CORES = ['#16a34a', '#2563eb', '#9333ea', '#ea580c', '#dc2626', '#0891b2']

// Cor do frame por nível medieval
const FRAME_POR_NIVEL: Record<number, string> = {
  1: '#6b7280',  // Camponês — cinza
  2: '#4ade80',  // Escudeiro — verde
  3: '#22d3ee',  // Cavaleiro — ciano
  4: '#60a5fa',  // Barão — azul
  5: '#a78bfa',  // Nobre — violeta
  6: '#f97316',  // Conde — laranja
  7: '#d4a017',  // Duque — ouro
  8: '#f43f5e',  // Rei — carmesim
}

function corParaNome(nome: string): string {
  return CORES[(nome.charCodeAt(0) || 0) % CORES.length]
}

interface AvatarProps {
  url?:     string | null
  nome:     string
  size?:    number
  nivel?:   number   // nível medieval para frame colorido
  onClick?: () => void
}

export default function Avatar({ url, nome, size = 40, nivel, onClick }: AvatarProps) {
  const frameCor  = nivel ? (FRAME_POR_NIVEL[nivel] || '#4ade80') : null
  const frameSize = frameCor ? 2 : 0
  const innerSize = size - frameSize * 2

  const inner: React.CSSProperties = {
    width: innerSize, height: innerSize, borderRadius: '50%',
    overflow: 'hidden', flexShrink: 0, display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    userSelect: 'none',
  }

  const wrapper: React.CSSProperties = {
    width: size, height: size, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
    cursor: onClick ? 'pointer' : 'default',
    ...(frameCor ? {
      background: `conic-gradient(${frameCor}, ${frameCor}88, ${frameCor})`,
      boxShadow: `0 0 8px ${frameCor}55`,
      padding: frameSize,
    } : {}),
  }

  let content: React.ReactNode

  if (url) {
    if (url.startsWith('emoji:')) {
      const emoji = url.replace('emoji:', '')
      content = (
        <div style={{ ...inner, background: 'rgba(255,255,255,.08)', fontSize: innerSize * 0.5 }}>
          {emoji}
        </div>
      )
    } else {
      content = (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={nome} style={{ ...inner, objectFit: 'cover' }} />
      )
    }
  } else {
    content = (
      <div style={{ ...inner, background: corParaNome(nome || 'U'), fontSize: innerSize * 0.38, fontWeight: 700, color: '#fff' }}>
        {(nome || 'U')[0].toUpperCase()}
      </div>
    )
  }

  return (
    <div style={wrapper} onClick={onClick}>
      {content}
    </div>
  )
}
