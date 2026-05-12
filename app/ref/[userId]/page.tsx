'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import PoupaUpLogo from '@/components/PoupaUpLogo'

export default function RefPage() {
  const params = useParams()
  const router = useRouter()
  const referrerId = params.userId as string

  useEffect(() => {
    if (referrerId) {
      sessionStorage.setItem('ref', referrerId)
    }
    router.replace(`/login?ref=${referrerId}`)
  }, [referrerId, router])

  return (
    <div style={{
      minHeight: '100vh', background: '#0a0a0a',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif', color: '#fff',
    }}>
      <PoupaUpLogo mode="compact" />
      <p style={{ marginTop: 24, color: 'rgba(255,255,255,.4)', fontSize: 13 }}>Redirecionando...</p>
    </div>
  )
}
