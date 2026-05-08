'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import PoupaUpLogo from '@/components/PoupaUpLogo'
import Link from 'next/link'

function AceiteLGPDContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const next = searchParams.get('next') || '/dashboard'

  const [aceitou, setAceitou] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function confirmar() {
    if (!aceitou) return
    setSalvando(true)
    setErro('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { error } = await supabase
      .from('profiles')
      .update({ lgpd_aceito_em: new Date().toISOString() })
      .eq('id', user.id)

    if (error) { setErro('Erro ao salvar. Tente novamente.'); setSalvando(false); return }

    router.push(next)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#080b0f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.5rem', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 480, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <PoupaUpLogo mode="compact" />
        </div>

        <div style={{ background: '#0d1a0d', border: '1px solid #1a3a1a', borderRadius: 16, padding: '2rem' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 8 }}>
            Antes de continuar
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            Para usar o PoupaUp precisamos que você leia e aceite nossa política de privacidade e termos de uso, conforme exigido pela LGPD (Lei nº 13.709/2018).
          </div>

          <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: '1rem', marginBottom: '1.5rem', fontSize: 12, color: 'rgba(255,255,255,.45)', lineHeight: 1.7 }}>
            <div style={{ marginBottom: 6 }}>📋 <strong style={{ color: 'rgba(255,255,255,.7)' }}>O que coletamos:</strong> nome, e-mail, dados financeiros que você inserir.</div>
            <div style={{ marginBottom: 6 }}>🔒 <strong style={{ color: 'rgba(255,255,255,.7)' }}>Segurança:</strong> dados protegidos com TLS, RLS e autenticação JWT.</div>
            <div style={{ marginBottom: 6 }}>🚫 <strong style={{ color: 'rgba(255,255,255,.7)' }}>Não vendemos</strong> seus dados a terceiros.</div>
            <div>🗑 <strong style={{ color: 'rgba(255,255,255,.7)' }}>Seus direitos:</strong> acesso, correção, portabilidade e exclusão a qualquer momento.</div>
          </div>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: '1.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={aceitou}
              onChange={e => setAceitou(e.target.checked)}
              style={{ marginTop: 2, accentColor: '#4ade80', flexShrink: 0, width: 15, height: 15 }}
            />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', lineHeight: 1.6 }}>
              Li e concordo com a{' '}
              <Link href="/privacidade" target="_blank" style={{ color: '#4ade80' }}>Política de Privacidade</Link>
              {' '}e os{' '}
              <Link href="/privacidade#termos" target="_blank" style={{ color: '#4ade80' }}>Termos de Uso</Link>
              {' '}do PoupaUp.
            </span>
          </label>

          {erro && (
            <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#f87171', marginBottom: 12 }}>
              {erro}
            </div>
          )}

          <button
            onClick={confirmar}
            disabled={!aceitou || salvando}
            style={{
              width: '100%', padding: '12px', background: '#16a34a', color: '#fff',
              border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
              cursor: (!aceitou || salvando) ? 'default' : 'pointer',
              opacity: (!aceitou || salvando) ? 0.5 : 1,
            }}
          >
            {salvando ? 'Salvando...' : 'Continuar para o PoupaUp →'}
          </button>

          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <button
              onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
              style={{ fontSize: 11, color: 'rgba(255,255,255,.25)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Cancelar e sair
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AceiteLGPDPage() {
  return (
    <Suspense>
      <AceiteLGPDContent />
    </Suspense>
  )
}
