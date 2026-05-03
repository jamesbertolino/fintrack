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
    // Fundos principais
    pageBg:       c ? '#F5E6C8'    : '#0e0904',
    surface:      c ? '#EDD9A3'    : '#1c1409',
    surfaceAlt:   c ? '#E8CFA0'    : '#150f05',
    surfaceDark:  c ? '#DFC08A'    : '#0e0904',
    // Bordas
    border:       c ? '#C8A96E'    : '#3d2e0a',
    borderMid:    c ? '#B89050'    : '#4a3810',
    // Texto
    text:         c ? '#2C1A06'    : '#F5E6C8',
    textMuted:    c ? 'rgba(44,26,6,0.50)'     : 'rgba(245,230,200,0.42)',
    textFaint:    c ? 'rgba(44,26,6,0.30)'     : 'rgba(245,230,200,0.22)',
    // Sidebar — parede de castelo
    sidebarBg:    c ? 'linear-gradient(180deg,#E8CFA0 0%,#DFC08A 100%)'
                    : 'linear-gradient(180deg,#160d04 0%,#0e0904 100%)',
    // Topbar
    topbarBg:     c ? 'linear-gradient(90deg,#E8CFA0,#DFC08A)'
                    : 'linear-gradient(90deg,#150f05,#0e0904)',
    // Inputs
    inputBg:      c ? '#E8CFA0'    : '#150f05',
    inputBorder:  c ? '#C8A96E'    : '#3d2e0a',
    // Cards
    cardBg:       c ? '#EDD9A3'    : 'linear-gradient(145deg,#1c1409,#241808)',
    cardBorder:   c ? '#C8A96E'    : '#3d2e0a',
    // Navegação ativa — dourado medieval
    navActive:    c ? 'rgba(212,175,55,0.15)'  : 'rgba(212,175,55,0.12)',
    navActiveColor: c ? '#8B6914'  : '#D4AF37',
    // Cor de destaque (verde musgo → ouro para dark)
    accent:       c ? '#4A5E3A'    : '#D4AF37',
    accentGlow:   c ? 'rgba(74,94,58,0.2)'     : 'rgba(212,175,55,0.25)',
  }
}
