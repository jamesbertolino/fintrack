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
    pageBg:       c ? '#F5E6C8'    : m ? '#0e0904'    : '#080b0f',
    surface:      c ? '#EDD9A3'    : m ? '#1c1409'    : '#0d1117',
    surfaceAlt:   c ? '#E8CFA0'    : m ? '#150f05'    : '#0a1205',
    surfaceDark:  c ? '#DFC08A'    : m ? '#0e0904'    : '#080b0f',
    // Bordas
    border:       c ? '#C8A96E'    : m ? '#3d2e0a'    : '#1e2d1e',
    borderMid:    c ? '#B89050'    : m ? '#4a3810'    : '#1a3a1a',
    // Texto
    text:         c ? '#2C1A06'    : m ? '#F5E6C8'    : '#ededed',
    textMuted:    c ? 'rgba(44,26,6,0.50)'
                    : m ? 'rgba(245,230,200,0.42)'
                    : 'rgba(255,255,255,0.4)',
    textFaint:    c ? 'rgba(44,26,6,0.30)'
                    : m ? 'rgba(245,230,200,0.22)'
                    : 'rgba(255,255,255,0.25)',
    // Sidebar
    sidebarBg:    c ? 'linear-gradient(180deg,#E8CFA0 0%,#DFC08A 100%)'
                    : m ? 'linear-gradient(180deg,#160d04 0%,#0e0904 100%)'
                    : 'linear-gradient(180deg,#0a1205 0%,#080b0f 100%)',
    // Topbar
    topbarBg:     c ? 'linear-gradient(90deg,#E8CFA0,#DFC08A)'
                    : m ? 'linear-gradient(90deg,#150f05,#0e0904)'
                    : 'linear-gradient(90deg,#0a1205,#080b0f)',
    // Inputs
    inputBg:      c ? '#E8CFA0'    : m ? '#150f05'    : '#0a1a0a',
    inputBorder:  c ? '#C8A96E'    : m ? '#3d2e0a'    : '#1a3a1a',
    // Cards
    cardBg:       c ? '#EDD9A3'
                    : m ? 'linear-gradient(145deg,#1c1409,#241808)'
                    : 'linear-gradient(145deg,#0d1117,#111820)',
    cardBorder:   c ? '#C8A96E'    : m ? '#3d2e0a'    : '#1e2d1e',
    // Navegação ativa
    navActive:    c ? 'rgba(212,175,55,0.15)'
                    : m ? 'rgba(212,175,55,0.12)'
                    : 'rgba(74,222,128,0.12)',
    navActiveColor: c ? '#8B6914'  : m ? '#D4AF37'    : 'rgba(74,222,128,1)',
    // Destaque
    accent:       c ? '#4A5E3A'    : m ? '#D4AF37'    : '#4ade80',
    accentGlow:   c ? 'rgba(74,94,58,0.2)'
                    : m ? 'rgba(212,175,55,0.25)'
                    : 'rgba(74,222,128,0.2)',
    // Cards
    cardShadow:   c ? '0 2px 8px rgba(100,70,20,0.15)'
                    : m ? 'inset 0 1px 0 rgba(212,175,55,.08), 0 4px 16px rgba(0,0,0,0.5)'
                    : 'inset 0 1px 0 rgba(212,160,23,.04)',
    divider:      c ? '#C8A96E'    : m ? '#3d2e0a'    : '#1a3a1a',
  }
}
