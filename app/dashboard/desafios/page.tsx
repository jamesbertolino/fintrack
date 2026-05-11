'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function DesafiosRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/dashboard/tarefas?aba=desafios') }, [router])
  return null
}
