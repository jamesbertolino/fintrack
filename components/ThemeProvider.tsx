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
    // Fundos principais
    pageBg:       c ? '#F3F4F6'    : m ? '#0e0904'    : '#080b0f',
    surface:      c ? '#F9FAFB'    : m ? '#1c1409'    : '#0d1117',
    surfaceAlt:   c ? '#F3F4F6'    : m ? '#150f05'    : '#0a1205',
    surfaceDark:  c ? '#E5E7EB'    : m ? '#0e0904'    : '#080b0f',
    // Bordas
    border:       c ? '#E5E7EB'    : m ? '#3d2e0a'    : '#1e2d1e',
    borderMid:    c ? '#D1D5DB'    : m ? '#4a3810'    : '#1a3a1a',
    // Texto
    text:         c ? '#111827'    : m ? '#F5E6C8'    : '#ededed',
    textMuted:    c ? 'rgba(17,24,39,0.55)'
                    : m ? 'rgba(245,230,200,0.42)'
                    : 'rgba(255,255,255,0.4)',
    textFaint:    c ? 'rgba(17,24,39,0.35)'
                    : m ? 'rgba(245,230,200,0.22)'
                    : 'rgba(255,255,255,0.25)',
    // Sidebar
    sidebarBg:    c ? 'linear-gradient(180deg,#1e3a5f 0%,#1a3354 100%)'
                    : m ? 'linear-gradient(180deg,#160d04 0%,#0e0904 100%)'
                    : 'linear-gradient(180deg,#0a1205 0%,#080b0f 100%)',
    // Topbar
    topbarBg:     c ? '#FFFFFF'
                    : m ? 'linear-gradient(90deg,#150f05,#0e0904)'
                    : 'linear-gradient(90deg,#0a1205,#080b0f)',
    // Inputs
    inputBg:      c ? '#FFFFFF'    : m ? '#150f05'    : '#0a1a0a',
    inputBorder:  c ? '#D1D5DB'    : m ? '#3d2e0a'    : '#1a3a1a',
    // Cards
    cardBg:       c ? '#FFFFFF'
                    : m ? 'linear-gradient(145deg,#1c1409,#241808)'
                    : 'linear-gradient(145deg,#0d1117,#111820)',
    cardBorder:   c ? '#E5E7EB'    : m ? '#3d2e0a'    : '#1e2d1e',
    // Navegação ativa
    navActive:    c ? 'rgba(37,99,235,0.12)'
                    : m ? 'rgba(212,175,55,0.12)'
                    : 'rgba(74,222,128,0.12)',
    navActiveColor: c ? '#2563EB'  : m ? '#D4AF37'    : 'rgba(74,222,128,1)',
    // Destaque
    accent:       c ? '#2563EB'    : m ? '#D4AF37'    : '#4ade80',
    accentGlow:   c ? 'rgba(37,99,235,0.15)'
                    : m ? 'rgba(212,175,55,0.25)'
                    : 'rgba(74,222,128,0.2)',
    // Cards
    cardShadow:   c ? '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)'
                    : m ? 'inset 0 1px 0 rgba(212,175,55,.08), 0 4px 16px rgba(0,0,0,0.5)'
                    : 'inset 0 1px 0 rgba(212,160,23,.04)',
    divider:      c ? '#E5E7EB'    : m ? '#3d2e0a'    : '#1a3a1a',
  }
}
