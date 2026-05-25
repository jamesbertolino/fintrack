'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import pkg from '../package.json'

const NAV_ITEMS = [
  { id: 'inicio',     label: 'Início',   icon: '🏠', href: '/dashboard' },
  { id: 'lancamento', label: 'Lançar',   icon: '📝', href: '/dashboard/lancamento' },
  { id: 'gastos',     label: 'Gastos',   icon: '💸', href: '/dashboard/gastos' },
  { id: 'metas',      label: 'Metas',    icon: '🎯', href: '/dashboard/metas' },
  { id: 'mais',       label: 'Mais',     icon: '⊞',  href: '' },
]

const MAIS_ITEMS = [
  { label: 'IA',          icon: '🤖', href: '/dashboard/ia' },
  { label: 'Perfil',      icon: '👤', href: '/dashboard/perfil' },
  { label: 'Score',       icon: '⭐', href: '/dashboard/score' },
  { label: 'Conquistas',  icon: '🏆', href: '/dashboard/conquistas' },
  { label: 'Contas',      icon: '🏦', href: '/dashboard/contas' },
  { label: 'Orçamento',   icon: '📊', href: '/dashboard/orcamento' },
  { label: 'Dívidas',     icon: '💳', href: '/dashboard/dividas' },
  { label: 'Família',     icon: '👨‍👩‍👧', href: '/dashboard/familia' },
  { label: 'Relatório',   icon: '📈', href: '/dashboard/relatorio' },
  { label: 'Desafios',    icon: '🎮', href: '/dashboard/desafios' },
  { label: 'Planejamento',icon: '📅', href: '/dashboard/planejamento' },
  { label: 'Evolução',    icon: '📉', href: '/dashboard/evolucao' },
]

export default function MobileBottomNav() {
  const router  = useRouter()
  const path    = usePathname()
  const [maisAberto, setMaisAberto] = useState(false)

  // A dashboard root page has its own bottom nav — MobileBottomNav only shows on sub-pages
  if (path === '/dashboard') return null

  // "Início" navigates to /dashboard where the built-in nav takes over — no issue

  function isActive(href: string) {
    if (!href) return false
    if (href === '/dashboard') return path === '/dashboard'
    return path.startsWith(href)
  }

  const maisActive = MAIS_ITEMS.some(i => path.startsWith(i.href))

  return (
    <>
      {/* ── Bottom sheet "Mais" ── */}
      {maisAberto && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setMaisAberto(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 300,
              background: 'rgba(0,0,0,.6)',
            }}
          />
          {/* Sheet */}
          <div style={{
            position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 301,
            background: '#0d1f0d',
            borderTop: '1px solid #2a4a2a',
            borderRadius: '20px 20px 0 0',
            paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
            animation: 'sheetUp .22s ease',
          }}>
            <style>{`
              @keyframes sheetUp {
                from { transform: translateY(100%) }
                to   { transform: translateY(0) }
              }
            `}</style>

            {/* Handle */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,.15)' }} />
            </div>

            <div style={{ padding: '8px 20px 16px', fontFamily: 'system-ui, sans-serif' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 14 }}>
                Mais opções
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                {MAIS_ITEMS.map(item => {
                  const active = path.startsWith(item.href)
                  return (
                    <button
                      key={item.href}
                      onClick={() => { setMaisAberto(false); router.push(item.href) }}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        gap: 6, padding: '14px 8px', borderRadius: 14, border: 'none',
                        background: active ? 'rgba(74,222,128,.12)' : 'rgba(255,255,255,.04)',
                        cursor: 'pointer', minHeight: 72,
                        outline: active ? '1px solid rgba(74,222,128,.3)' : 'none',
                      }}
                    >
                      <span style={{ fontSize: 24, lineHeight: 1 }}>{item.icon}</span>
                      <span style={{ fontSize: 11, color: active ? '#4ade80' : 'rgba(255,255,255,.6)', fontFamily: 'system-ui', lineHeight: 1.2, textAlign: 'center' }}>
                        {item.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Barra de navegação inferior ── */}
      <nav className="mobile-bottom-nav" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        zIndex: 200,
        background: '#0a1205',
        borderTop: '1px solid #1a3a1a',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
        {NAV_ITEMS.map(item => {
          const active = item.id === 'mais' ? maisActive || maisAberto : isActive(item.href)
          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === 'mais') {
                  setMaisAberto(o => !o)
                } else {
                  setMaisAberto(false)
                  router.push(item.href)
                }
              }}
              style={{
                flex: 1,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 3, padding: '8px 4px',
                background: 'none', border: 'none', cursor: 'pointer',
                color: active ? '#4ade80' : 'rgba(255,255,255,.45)',
                fontSize: 12, fontFamily: 'system-ui, sans-serif',
                minHeight: 56,
                borderTop: active ? '2px solid #4ade80' : '2px solid transparent',
              }}
            >
              <span style={{ fontSize: 20, lineHeight: 1, pointerEvents: 'none' }}>{item.icon}</span>
              <span style={{ pointerEvents: 'none' }}>{item.label}</span>
            </button>
          )
        })}
      </nav>
    </>
  )
}
