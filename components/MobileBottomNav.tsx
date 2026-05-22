'use client'

import { usePathname, useRouter } from 'next/navigation'

const NAV_ITEMS = [
  { id: 'inicio',     label: 'Início',   icon: '🏠', href: '/dashboard' },
  { id: 'lancamento', label: 'Lançar',   icon: '📝', href: '/dashboard/lancamento' },
  { id: 'gastos',     label: 'Gastos',   icon: '💸', href: '/dashboard/gastos' },
  { id: 'metas',      label: 'Metas',    icon: '🎯', href: '/dashboard/metas' },
  { id: 'mais',       label: 'Mais',     icon: '☰',  href: '/dashboard/mais' },
]

export default function MobileBottomNav() {
  const router  = useRouter()
  const path    = usePathname()

  // Dashboard root has its own bottom nav with sidebar toggle — don't duplicate
  if (path === '/dashboard') return null

  function isActive(href: string) {
    if (href === '/dashboard') return path === '/dashboard'
    return path.startsWith(href)
  }

  return (
    <nav className="mobile-bottom-nav" style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200,
      background: '#0a1205',
      borderTop: '1px solid #1a3a1a',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    }}>
      {NAV_ITEMS.map(item => {
        const active = isActive(item.href)
        return (
          <button
            key={item.id}
            onClick={() => {
              if (item.id === 'mais') {
                // On sub-pages "Mais" navigates back to dashboard (sidebar accessible there)
                router.push('/dashboard')
              } else {
                router.push(item.href)
              }
            }}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              padding: '8px 4px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: active ? '#4ade80' : 'rgba(255,255,255,.45)',
              fontSize: 10,
              fontFamily: 'system-ui, sans-serif',
              minHeight: 56,
              borderTop: active ? '2px solid #4ade80' : '2px solid transparent',
            }}
          >
            <span style={{ fontSize: 20, lineHeight: 1 }}>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
