'use client'

interface GranaUpLogoProps {
  mode?: 'full' | 'icon' | 'compact'
}

export default function GranaUpLogo({ mode = 'full' }: GranaUpLogoProps) {

  const Velocimetro = () => (
    <img
      src="/velocimetro.jpg"
      alt="GranaUp"
      style={{
        width: mode === 'icon' ? 36 : 48,
        height: mode === 'icon' ? 36 : 48,
        objectFit: 'cover',
        borderRadius: 10,
        flexShrink: 0,
      }}
    />
  )

  if (mode === 'icon') return <Velocimetro />

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Velocimetro />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>

        {/* GranaUp */}
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          lineHeight: 1,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontWeight: 800,
          fontSize: mode === 'full' ? 22 : 18,
          letterSpacing: -0.5,
        }}>
          <span style={{ color: '#ffffff' }}>Grana</span>
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
            <span style={{ color: '#4ade80', fontWeight: 600 }}> Evolua.</span>
            <span style={{ color: 'rgba(255,255,255,0.75)' }}> Conquiste.</span>
            <div style={{ width: 12, height: 1, background: '#4ade80' }} />
          </div>
        )}

      </div>
    </div>
  )
}
