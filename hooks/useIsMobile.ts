'use client'

import { useState, useEffect } from 'react'

export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    // Lê a classe que o script inline da <head> já definiu — zero flash
    if (breakpoint === 768) return document.documentElement.classList.contains('is-mobile')
    return window.innerWidth < breakpoint
  })

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < breakpoint
      setIsMobile(mobile)
      if (breakpoint === 768) {
        document.documentElement.classList.toggle('is-mobile', mobile)
      }
    }
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [breakpoint])

  return isMobile
}
