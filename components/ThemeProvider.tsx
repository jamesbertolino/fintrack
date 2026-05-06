'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Tema = 'escuro' | 'claro' | 'medieval'

interface ThemeCtx {
  tema: Tema
  alterarTema: (t: Tema) => void
}

const Ctx = createContext<ThemeCtx>({ tema: 'escuro', alterarTema: () => {} })

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [tema, setTema] = useState<Tema>('escuro')

  useEffect(() => {
    const salvo = localStorage.getItem('poupaup_tema') as Tema | null
    if (salvo) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTema(salvo)
      document.documentElement.setAttribute('data-tema', salvo)
    }
  }, [])

  function alterarTema(novoTema: Tema) {
    setTema(novoTema)
    localStorage.setItem('poupaup_tema', novoTema)
    document.documentElement.setAttribute('data-tema', novoTema)
  }

  return <Ctx.Provider value={{ tema, alterarTema }}>{children}</Ctx.Provider>
}

export function useTema() {
  return useContext(Ctx)
}

export function useCores() {
  const { tema } = useContext(Ctx)
  const c = tema === 'claro'
  const m = tema === 'medieval'

  return {
    // ── Fundos principais ──────────────────────────────────────────────
    pageBg:       c ? '#F3F4F6'    : m ? '#0e0904'    : '#080b0f',
    surface:      c ? '#FFFFFF'    : m ? '#1c1409'    : '#0d1117',
    surfaceAlt:   c ? '#F9FAFB'    : m ? '#150f05'    : '#0a1205',
    surfaceDark:  c ? '#F3F4F6'    : m ? '#0e0904'    : '#080b0f',
    // ── Bordas ────────────────────────────────────────────────────────
    border:       c ? '#E5E7EB'    : m ? '#3d2e0a'    : '#1e2d1e',
    borderMid:    c ? '#D1D5DB'    : m ? '#4a3810'    : '#1a3a1a',
    // ── Texto ─────────────────────────────────────────────────────────
    text:         c ? '#0f172a'    : m ? '#F5E6C8'    : '#ededed',
    textMuted:    c ? 'rgba(15,23,42,0.60)'
                    : m ? 'rgba(245,230,200,0.42)'
                    : 'rgba(255,255,255,0.4)',
    textFaint:    c ? 'rgba(15,23,42,0.40)'
                    : m ? 'rgba(245,230,200,0.22)'
                    : 'rgba(255,255,255,0.25)',
    // ── Sidebar (fundo sempre escuro — texto SEMPRE claro) ────────────
    sidebarBg:    c ? 'linear-gradient(180deg,#1e3a5f 0%,#1a3354 100%)'
                    : m ? 'linear-gradient(180deg,#160d04 0%,#0e0904 100%)'
                    : 'linear-gradient(180deg,#0a1205 0%,#080b0f 100%)',
    sidebarText:      'rgba(255,255,255,0.80)',
    sidebarTextMuted: 'rgba(255,255,255,0.50)',
    sidebarTextFaint: 'rgba(255,255,255,0.30)',
    sidebarBorder:  c ? 'rgba(255,255,255,0.10)'
                      : m ? '#3d2e0a'
                      : '#1e2d1e',
    sidebarActive:  c ? 'rgba(255,255,255,0.12)'
                      : m ? 'rgba(212,175,55,0.12)'
                      : 'rgba(74,222,128,0.12)',
    sidebarActiveColor: c ? '#93c5fd'  /* azul claro legível no navy */
                          : m ? '#D4AF37'
                          : 'rgba(74,222,128,1)',
    // ── Topbar ────────────────────────────────────────────────────────
    topbarBg:     c ? '#FFFFFF'
                    : m ? 'linear-gradient(90deg,#150f05,#0e0904)'
                    : 'linear-gradient(90deg,#0a1205,#080b0f)',
    // ── Inputs ────────────────────────────────────────────────────────
    inputBg:      c ? '#FFFFFF'    : m ? '#150f05'    : '#0a1a0a',
    inputBorder:  c ? '#D1D5DB'    : m ? '#3d2e0a'    : '#1a3a1a',
    inputFocus:   c ? '#2563EB'    : m ? '#D4AF37'    : '#4ade80',
    // ── Cards ─────────────────────────────────────────────────────────
    cardBg:       c ? '#FFFFFF'
                    : m ? 'linear-gradient(145deg,#1c1409,#241808)'
                    : 'linear-gradient(145deg,#0d1117,#111820)',
    cardBorder:   c ? '#E5E7EB'    : m ? '#3d2e0a'    : '#1e2d1e',
    cardShadow:   c ? '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)'
                    : m ? 'inset 0 1px 0 rgba(212,175,55,.08), 0 4px 16px rgba(0,0,0,0.5)'
                    : 'inset 0 1px 0 rgba(212,160,23,.04)',
    // ── Navegação ativa ───────────────────────────────────────────────
    navActive:    c ? 'rgba(37,99,235,0.10)'
                    : m ? 'rgba(212,175,55,0.12)'
                    : 'rgba(74,222,128,0.12)',
    navActiveColor: c ? '#2563EB'  : m ? '#D4AF37'    : 'rgba(74,222,128,1)',
    // ── Destaque (cor primária de ação) ───────────────────────────────
    accent:       c ? '#2563EB'    : m ? '#D4AF37'    : '#4ade80',
    accentHover:  c ? '#1d4ed8'    : m ? '#b8921f'    : '#22c55e',
    accentGlow:   c ? 'rgba(37,99,235,0.10)'
                    : m ? 'rgba(212,175,55,0.25)'
                    : 'rgba(74,222,128,0.2)',
    // ── Cores semânticas (dados financeiros) ──────────────────────────
    positive:     c ? '#15803d'    : m ? '#5A8A4A'    : '#4ade80',
    positiveGlow: c ? 'rgba(21,128,61,0.10)'
                    : m ? 'rgba(90,138,74,0.15)'
                    : 'rgba(74,222,128,0.12)',
    negative:     c ? '#dc2626'    : m ? '#8B1010'    : '#f87171',
    negativeGlow: c ? 'rgba(220,38,38,0.08)'
                    : m ? 'rgba(139,0,0,0.15)'
                    : 'rgba(248,113,113,0.12)',
    // ── Divisor ───────────────────────────────────────────────────────
    divider:      c ? '#E5E7EB'    : m ? '#3d2e0a'    : '#1a3a1a',
  }
}
