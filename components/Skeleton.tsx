'use client'

/** Bloco base com shimmer animado */
export function Skel({ w = '100%', h = 14, radius = 6, style }: {
  w?: string | number
  h?: number
  radius?: number
  style?: React.CSSProperties
}) {
  return (
    <div style={{
      width: w, height: h, borderRadius: radius,
      background: 'linear-gradient(90deg, rgba(255,255,255,.06) 25%, rgba(255,255,255,.1) 50%, rgba(255,255,255,.06) 75%)',
      backgroundSize: '200% 100%',
      animation: 'skelShimmer 1.4s ease infinite',
      flexShrink: 0,
      ...style,
    }} />
  )
}

export const skelStyle = `@keyframes skelShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`

// ── Dashboard ────────────────────────────────────────────────────────────────
export function SkeletonDashboard() {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: 'system-ui, sans-serif' }}>
      <style>{skelStyle}</style>

      {/* Topbar */}
      <div style={{ height: 56, background: '#0a1a0a', borderBottom: '1px solid #1a3a1a', display: 'flex', alignItems: 'center', padding: '0 1rem', gap: 10 }}>
        <Skel w={80} h={10} />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Skel w={32} h={32} radius={8} />
          <Skel w={32} h={32} radius={8} />
        </div>
      </div>

      <div style={{ display: 'flex' }}>
        {/* Sidebar */}
        <div style={{ width: 200, minHeight: 'calc(100vh - 56px)', background: '#0a1205', borderRight: '1px solid #1a3a1a', padding: '1rem', display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
          {[80, 70, 75, 60, 70].map((w, i) => <Skel key={i} w={`${w}%`} h={10} />)}
          <div style={{ height: 1, background: '#1a3a1a', margin: '4px 0' }} />
          {[65, 75, 60].map((w, i) => <Skel key={i} w={`${w}%`} h={10} />)}
        </div>

        {/* Conteúdo */}
        <div style={{ flex: 1, padding: '1.25rem', maxWidth: 900 }}>
          {/* Cards métricas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
            {[0,1,2,3].map(i => (
              <div key={i} style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Skel w="50%" h={8} />
                <Skel w="70%" h={20} />
              </div>
            ))}
          </div>
          {/* Widget principal */}
          <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 12, padding: '1rem', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <Skel w={100} h={10} />
              <Skel w={60} h={10} />
            </div>
            <Skel h={120} radius={8} />
          </div>
          {/* Lista transações */}
          <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 12, padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <Skel w={120} h={10} />
              <Skel w={50} h={10} />
            </div>
            {[0,1,2,3,4].map(i => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                <Skel w={8} h={8} radius={4} />
                <Skel w="45%" h={10} />
                <Skel w="20%" h={8} style={{ marginLeft: 'auto' }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Gastos ───────────────────────────────────────────────────────────────────
export function SkeletonGastos() {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: 'system-ui, sans-serif' }}>
      <style>{skelStyle}</style>

      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '.875rem 1rem', borderBottom: '1px solid #1a3a1a', background: '#0a1a0a' }}>
        <Skel w={80} h={10} />
        <Skel w={1} h={14} style={{ background: 'rgba(255,255,255,.1)' }} />
        <Skel w={50} h={12} />
      </div>

      <div style={{ padding: '1.5rem' }}>
        {/* Cards métricas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Skel w="50%" h={8} />
              <Skel w="65%" h={18} />
            </div>
          ))}
        </div>
        {/* Filtros */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <Skel w={200} h={34} radius={8} />
          <Skel w={120} h={34} radius={8} />
          <Skel w={100} h={34} radius={8} />
        </div>
        {/* Linhas */}
        <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 12, padding: '0.75rem' }}>
          {[0,1,2,3,4,5,6].map(i => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 4px', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
              <Skel w={8} h={8} radius={4} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                <Skel w={`${45 + (i % 3) * 15}%`} h={11} />
                <Skel w="25%" h={9} />
              </div>
              <Skel w={70} h={11} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Metas ────────────────────────────────────────────────────────────────────
export function SkeletonMetas() {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: 'system-ui, sans-serif' }}>
      <style>{skelStyle}</style>

      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.875rem 1.5rem', borderBottom: '1px solid #1a3a1a', background: '#0a1a0a' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Skel w={80} h={10} />
          <Skel w={50} h={12} />
        </div>
        <Skel w={110} h={32} radius={8} />
      </div>

      <div style={{ padding: '1.25rem 1.5rem', maxWidth: 900, margin: '0 auto' }}>
        {/* Abas */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          {[80, 70, 90].map((w, i) => <Skel key={i} w={w} h={32} radius={20} />)}
        </div>
        {/* Cards de metas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 12, padding: '1.1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Skel w={120} h={13} />
                  <Skel w={80} h={9} />
                </div>
                <div style={{ display: 'flex', gap: 5 }}>
                  {[0,1,2,3].map(j => <Skel key={j} w={50} h={28} radius={6} />)}
                </div>
              </div>
              <Skel w="60%" h={22} style={{ marginBottom: 8 }} />
              <Skel h={6} radius={3} style={{ marginBottom: 10 }} />
              <div style={{ display: 'flex', gap: 5 }}>
                {[0,1,2,3].map(j => <Skel key={j} style={{ flex: 1 }} h={24} radius={6} />)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Perfil ───────────────────────────────────────────────────────────────────
export function SkeletonPerfil() {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: 'system-ui, sans-serif' }}>
      <style>{skelStyle}</style>

      {/* Topbar */}
      <div style={{ height: 52, background: '#0a1a0a', borderBottom: '1px solid #1a3a1a', display: 'flex', alignItems: 'center', padding: '0 1.5rem', gap: 10 }}>
        <Skel w={80} h={10} />
        <Skel w={1} h={14} style={{ background: 'rgba(255,255,255,.1)' }} />
        <Skel w={50} h={12} />
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '1.5rem' }}>
        {/* Avatar card */}
        <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 14, padding: '1.25rem', display: 'flex', alignItems: 'center', gap: 16, marginBottom: '1.5rem' }}>
          <Skel w={56} h={56} radius={28} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Skel w="40%" h={16} />
            <Skel w="55%" h={10} />
            <Skel w="30%" h={18} radius={10} />
          </div>
        </div>
        {/* Abas */}
        <div style={{ display: 'flex', gap: 4, marginBottom: '1.25rem', overflowX: 'hidden' }}>
          {[90, 100, 110, 80, 70, 60, 80].map((w, i) => <Skel key={i} w={w} h={32} radius={6} />)}
        </div>
        {/* Form card */}
        <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 12, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[0,1].map(i => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Skel w="40%" h={8} />
                <Skel h={38} radius={8} />
              </div>
            ))}
          </div>
          {[0,1].map(i => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Skel w="35%" h={8} />
              <Skel h={38} radius={8} />
            </div>
          ))}
          <Skel w={140} h={38} radius={8} />
        </div>
      </div>
    </div>
  )
}

// ── Orçamento — inline (dentro do card) ──────────────────────────────────────
export function SkeletonOrcamento() {
  return (
    <div style={{ padding: '1rem' }}>
      <style>{skelStyle}</style>
      {[0, 1, 2, 3].map(i => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 4px', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
          <Skel w="25%" h={12} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Skel h={8} radius={4} />
            <Skel w="60%" h={6} radius={3} />
          </div>
          <Skel w={60} h={10} />
        </div>
      ))}
    </div>
  )
}

// ── Dívidas — full-page ───────────────────────────────────────────────────────
export function SkeletonPlanejamento() {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: 'system-ui, sans-serif' }}>
      <style>{skelStyle}</style>
      <div style={{ height: 52, background: '#0a1a0a', borderBottom: '1px solid #1a3a1a', display: 'flex', alignItems: 'center', padding: '0 1.5rem', gap: 12 }}>
        <Skel w={24} h={24} radius={4} />
        <Skel w={140} h={14} />
      </div>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Seletor cenário */}
        <div style={{ display: 'flex', gap: 8 }}>
          {[80, 90, 80].map((w, i) => <Skel key={i} w={w} h={34} radius={20} />)}
        </div>
        {/* Gráfico */}
        <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 14, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Skel w="35%" h={11} />
          <Skel h={180} radius={8} />
        </div>
        {/* Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 12, padding: '1rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Skel w="50%" h={10} />
              <Skel w="70%" h={24} />
            </div>
          ))}
        </div>
        {/* Tabela */}
        <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #1a3a1a' }}><Skel w="25%" h={11} /></div>
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 16px', borderBottom: '1px solid #111' }}>
              <Skel w="15%" h={13} />
              <Skel w="12%" h={13} />
              <Skel w="12%" h={13} />
              <Skel w="12%" h={13} />
              <Skel w="14%" h={13} />
              <Skel w="14%" h={13} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function SkeletonScore() {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: 'system-ui, sans-serif' }}>
      <style>{skelStyle}</style>
      <div style={{ height: 52, background: '#0a1a0a', borderBottom: '1px solid #1a3a1a', display: 'flex', alignItems: 'center', padding: '0 1.5rem', gap: 12 }}>
        <Skel w={24} h={24} radius={4} />
        <Skel w={100} h={14} />
      </div>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Score principal */}
        <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 14, padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <Skel w={120} h={120} radius={60} />
          <Skel w="30%" h={18} />
          <Skel w="50%" h={11} />
        </div>
        {/* Dimensões */}
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 12, padding: '1rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Skel w="40%" h={13} />
              <Skel w={40} h={13} />
            </div>
            <Skel h={8} radius={4} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function SkeletonDividas() {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: 'system-ui, sans-serif' }}>
      <style>{skelStyle}</style>
      <div style={{ height: 52, background: '#0a1a0a', borderBottom: '1px solid #1a3a1a', display: 'flex', alignItems: 'center', padding: '0 1.5rem', gap: 12 }}>
        <Skel w={24} h={24} radius={4} />
        <Skel w={120} h={14} />
      </div>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 12, padding: '1rem', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Skel w="40%" h={14} />
              <Skel w="60%" h={10} />
            </div>
            <Skel w={80} h={20} />
          </div>
        ))}
        <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 12, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Skel w="35%" h={14} />
          <Skel h={120} radius={8} />
        </div>
      </div>
    </div>
  )
}
