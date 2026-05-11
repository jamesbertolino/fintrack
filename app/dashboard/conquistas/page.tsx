'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ConquistasRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/dashboard/tarefas?aba=conquistas') }, [router])
  return null
}
