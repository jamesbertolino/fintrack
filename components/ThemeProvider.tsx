'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Tema = 'escuro' | 'claro'

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
  return {
    pageBg:       c ? '#f5f7fa'    : '#080b0f',
    surface:      c ? '#ffffff'    : '#0d1117',
    surfaceAlt:   c ? '#f0f4f0'    : '#0a1205',
    surfaceDark:  c ? '#e8f0e8'    : '#080b0f',
    border:       c ? '#e5e7eb'    : '#1e2d1e',
    borderMid:    c ? '#d1d5db'    : '#1a3a1a',
    text:         c ? '#111827'    : '#ededed',
    textMuted:    c ? 'rgba(0,0,0,0.45)'       : 'rgba(255,255,255,0.4)',
    textFaint:    c ? 'rgba(0,0,0,0.3)'        : 'rgba(255,255,255,0.25)',
    sidebarBg:    c ? 'linear-gradient(180deg,#e8f5e9 0%,#f0f4f0 100%)'
                    : 'linear-gradient(180deg,#0a1205 0%,#080b0f 100%)',
    topbarBg:     c ? 'linear-gradient(90deg,#e8f5e9,#f0f4f0)'
                    : 'linear-gradient(90deg,#0a1205,#080b0f)',
    inputBg:      c ? '#f0f4f0'    : '#0a1a0a',
    inputBorder:  c ? '#d1d5db'    : '#1a3a1a',
    cardBg:       c ? '#ffffff'    : 'linear-gradient(145deg,#0d1117,#111820)',
    cardBorder:   c ? '#e5e7eb'    : '#1e2d1e',
    navActive:    c ? 'rgba(22,163,74,0.12)'   : 'rgba(74,222,128,0.12)',
    navActiveColor: c ? '#16a34a'  : 'rgba(74,222,128,1)',
  }
}
