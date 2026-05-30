import { useEffect, useRef } from 'react'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/**
 * Traps keyboard focus inside the referenced container while active.
 * Returns focus to the previously focused element when deactivated.
 */
export function useFocusTrap(ativo: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  const anteriorFoco = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!ativo) return

    anteriorFoco.current = document.activeElement as HTMLElement

    // Move focus to first focusable element inside the trap
    const first = ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE)[0]
    first?.focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !ref.current) return
      const focusable = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (focusable.length === 0) return

      const first = focusable[0]
      const last  = focusable[focusable.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      anteriorFoco.current?.focus()
    }
  }, [ativo])

  return ref
}
