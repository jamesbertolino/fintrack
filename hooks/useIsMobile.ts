'use client'

import { useState, useEffect } from 'react'

export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    // matchMedia respeita o viewport meta tag — funciona corretamente no Android WebView/TWA
    return window.matchMedia(`(max-width: ${breakpoint - 1}px)`).matches
  })

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    const check = () => {
      const mobile = mq.matches
      setIsMobile(mobile)
      if (breakpoint === 768) {
        document.documentElement.classList.toggle('is-mobile', mobile)
      }
    }
    check()
    mq.addEventListener('change', check)
    return () => mq.removeEventListener('change', check)
  }, [breakpoint])

  return isMobile
}
