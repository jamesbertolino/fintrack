'use client'

import Image from 'next/image'

interface PoupaUpLogoProps {
  mode?: 'full' | 'icon' | 'compact'
}

function Velocimetro({ size }: { size: number }) {
  return (
    <Image
      src="/velocimetro.jpg"
      alt="PoupaUp"
      width={size}
      height={size}
      style={{ objectFit: 'cover', borderRadius: 10, flexShrink: 0 }}
    />
  )
}

export default function PoupaUpLogo({ mode = 'full' }: PoupaUpLogoProps) {
  if (mode === 'icon') return <Velocimetro size={36} />

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Velocimetro size={mode === 'full' ? 48 : 38} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>

        {/* PoupaUp */}
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          lineHeight: 1,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontWeight: 800,
          fontSize: mode === 'full' ? 22 : 18,
          letterSpacing: -0.5,
        }}>
          <span style={{ color: '#ffffff' }}>Poupa</span>
          <span style={{ color: '#4ade80' }}>Up</span>
        </div>

        {/* Poupe. Evolua. Conquiste. */}
        {mode === 'full' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            fontFamily: 'system-ui, sans-serif',
            fontSize: 9,
            letterSpacing: '0.06em',
            whiteSpace: 'nowrap',
          }}>
            <div style={{ width: 12, height: 1, background: '#4ade80' }} />
            <span style={{ color: 'rgba(255,255,255,0.75)' }}>Poupe.</span>
            <span style={{ color: '#4ade80', fontWeight: 600 }}>&nbsp;Evolua.</span>
            <span style={{ color: 'rgba(255,255,255,0.75)' }}>&nbsp;Conquiste.</span>
            <div style={{ width: 12, height: 1, background: '#4ade80' }} />
          </div>
        )}

      </div>
    </div>
  )
}
