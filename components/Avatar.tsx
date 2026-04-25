import React from 'react'

const CORES = ['#16a34a', '#2563eb', '#9333ea', '#ea580c', '#dc2626', '#0891b2']

function corParaNome(nome: string): string {
  return CORES[(nome.charCodeAt(0) || 0) % CORES.length]
}

interface AvatarProps {
  url?:     string | null
  nome:     string
  size?:    number
  onClick?: () => void
}

export default function Avatar({ url, nome, size = 40, onClick }: AvatarProps) {
  const style: React.CSSProperties = {
    width: size, height: size, borderRadius: '50%',
    overflow: 'hidden', flexShrink: 0, display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    cursor: onClick ? 'pointer' : 'default',
    userSelect: 'none',
  }

  if (url) {
    if (url.startsWith('emoji:')) {
      const emoji = url.replace('emoji:', '')
      return (
        <div style={{ ...style, background: 'rgba(255,255,255,.08)', fontSize: size * 0.5 }} onClick={onClick}>
          {emoji}
        </div>
      )
    }
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={nome}
        style={{ ...style, objectFit: 'cover' }}
        onClick={onClick}
      />
    )
  }

  return (
    <div
      style={{ ...style, background: corParaNome(nome || 'U'), fontSize: size * 0.38, fontWeight: 700, color: '#fff' }}
      onClick={onClick}
    >
      {(nome || 'U')[0].toUpperCase()}
    </div>
  )
}
