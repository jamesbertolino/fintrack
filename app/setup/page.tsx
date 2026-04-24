'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import GranaUpLogo from '@/components/GranaUpLogo'

type Passo  = 1 | 2
type Status = 'aguardando' | 'conectado'

function formatarWhatsapp(num: string): string {
  const digits = num.replace(/\D/g, '')
  if (digits.startsWith('55') && digits.length >= 12) {
    const dd   = digits.slice(2, 4)
    const rest = digits.slice(4)
    if (rest.length === 9) return `+55 (${dd}) ${rest.slice(0, 5)}-${rest.slice(5)}`
    if (rest.length === 8) return `+55 (${dd}) ${rest.slice(0, 4)}-${rest.slice(4)}`
    return `+55 (${dd}) ${rest}`
  }
  return `+${digits}`
}

export default function SetupPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [passo, setPasso]           = useState<Passo>(1)
  const [userId, setUserId]         = useState('')
  const [whatsapp, setWhatsapp]     = useState('')
  const [nomeGrupo, setNomeGrupo]   = useState('')
  const [instancia, setInstancia]   = useState('')
  const [qrcode, setQrcode]         = useState('')
  const [status, setStatus]         = useState<Status>('aguardando')
  const [carregando, setCarregando] = useState(false)
  const [gerandoQR, setGerandoQR]   = useState(false)
  const [erro, setErro]             = useState('')
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      setUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('nome, whatsapp, setup_completo')
        .eq('id', user.id)
        .single()

      if (profile?.setup_completo) { router.push('/dashboard'); return }

      if (profile?.whatsapp) setWhatsapp(profile.whatsapp)
      if (profile?.nome)     setNomeGrupo(`Família ${profile.nome}`)
    }

    init()

    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function iniciarPolling(inst: string, grupo: string) {
    if (pollingRef.current) clearInterval(pollingRef.current)
    pollingRef.current = setInterval(async () => {
      try {
        const res  = await fetch(`/api/evolution/status/${inst}?grupo=${encodeURIComponent(grupo)}`)
        const data = await res.json()
        if (data.state === 'open') {
          clearInterval(pollingRef.current!)
          pollingRef.current = null
          setStatus('conectado')
          setTimeout(() => router.push('/dashboard'), 2000)
        }
      } catch { /* polling silencioso */ }
    }, 3000)
  }

  async function avancarPasso2() {
    if (!nomeGrupo.trim()) return
    setCarregando(true)
    setErro('')

    try {
      const res  = await fetch('/api/evolution/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao criar instância')

      if (data.jaConectada) {
        setStatus('conectado')
        setTimeout(() => router.push('/dashboard'), 2000)
        return
      }

      setInstancia(data.instancia)
      setQrcode(data.qrcode || '')
      setPasso(2)
      iniciarPolling(data.instancia, nomeGrupo.trim())
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setCarregando(false)
    }
  }

  async function gerarNovoQR() {
    setGerandoQR(true)
    setErro('')

    try {
      const res  = await fetch('/api/evolution/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar QR')

      if (data.jaConectada) {
        setStatus('conectado')
        setTimeout(() => router.push('/dashboard'), 2000)
        return
      }

      setInstancia(data.instancia)
      setQrcode(data.qrcode || '')
      iniciarPolling(data.instancia, nomeGrupo.trim())
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setGerandoQR(false)
    }
  }

  const card: React.CSSProperties = {
    width: '100%', maxWidth: 440,
    background: '#111', border: '1px solid #1a3a1a', borderRadius: 16, padding: '2rem',
  }
  const btn = (active: boolean): React.CSSProperties => ({
    width: '100%', padding: '12px', borderRadius: 10, border: 'none',
    background: active ? '#16a34a' : 'rgba(22,163,74,.25)',
    color: '#fff', fontSize: 14, fontWeight: 600,
    cursor: active ? 'pointer' : 'default', opacity: active ? 1 : 0.55,
  })

  // Tela de sucesso antecipada (jaConectada)
  if (status === 'conectado' && passo === 1) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', color: '#fff' }}>
        <div style={card}>
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#4ade80', marginBottom: 8 }}>WhatsApp conectado!</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)' }}>Redirecionando para o dashboard...</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', color: '#fff', padding: '1.5rem' }}>

      <div style={{ marginBottom: '2rem' }}>
        <GranaUpLogo mode="compact" />
      </div>

      {/* Indicador de passos */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1.75rem' }}>
        {([1, 2] as const).map((s, i) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700,
              background: passo >= s ? '#16a34a' : 'rgba(255,255,255,.08)',
              color: passo >= s ? '#fff' : 'rgba(255,255,255,.3)',
              border: `2px solid ${passo >= s ? '#4ade80' : 'rgba(255,255,255,.12)'}`,
              transition: 'all .3s',
            }}>{s}</div>
            {i < 1 && (
              <div style={{ width: 44, height: 2, background: passo > 1 ? '#16a34a' : 'rgba(255,255,255,.1)', borderRadius: 1, transition: 'background .3s' }} />
            )}
          </div>
        ))}
      </div>

      <div style={card}>

        {/* ── PASSO 1 ── */}
        {passo === 1 && (
          <div>
            <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 6 }}>Configure seu grupo</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', marginBottom: '1.75rem', lineHeight: 1.5 }}>
              Esse será o nome do grupo do WhatsApp para receber seus alertas financeiros.
            </div>

            {/* Número detectado */}
            {whatsapp ? (
              <div style={{ background: 'rgba(22,163,74,.08)', border: '1px solid rgba(22,163,74,.2)', borderRadius: 10, padding: '10px 14px', marginBottom: '1.25rem', fontSize: 13, color: 'rgba(255,255,255,.7)' }}>
                Você vai conectar o WhatsApp: <strong style={{ color: '#4ade80' }}>{formatarWhatsapp(whatsapp)}</strong>
              </div>
            ) : (
              <div style={{ background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 10, padding: '10px 14px', marginBottom: '1.25rem', fontSize: 13, color: 'rgba(255,255,255,.6)' }}>
                Nenhum número cadastrado.{' '}
                <a href="/dashboard/perfil" style={{ color: '#f87171', fontWeight: 600, textDecoration: 'none' }}>Cadastrar número →</a>
              </div>
            )}

            <label style={{ display: 'block', fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,.4)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
              Nome do grupo
            </label>
            <input
              value={nomeGrupo}
              onChange={e => setNomeGrupo(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && avancarPasso2()}
              style={{ width: '100%', padding: '10px 12px', background: '#0a1a0a', border: '1px solid #1a3a1a', borderRadius: 8, color: '#fff', fontSize: 14, outline: 'none', marginBottom: '1.25rem', boxSizing: 'border-box' }}
            />

            {erro && (
              <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#f87171', marginBottom: 14 }}>
                {erro}
              </div>
            )}

            <button onClick={avancarPasso2} disabled={carregando || !nomeGrupo.trim() || !whatsapp} style={btn(!carregando && !!nomeGrupo.trim() && !!whatsapp)}>
              {carregando ? 'Criando instância...' : 'Continuar →'}
            </button>
          </div>
        )}

        {/* ── PASSO 2 ── */}
        {passo === 2 && (
          <div>
            {status === 'conectado' ? (
              <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#4ade80', marginBottom: 8 }}>WhatsApp conectado!</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)' }}>Redirecionando para o dashboard...</div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 6 }}>Conecte o WhatsApp</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                  No WhatsApp: <strong style={{ color: 'rgba(255,255,255,.7)' }}>Menu → Dispositivos vinculados → Vincular dispositivo</strong> e escaneie o QR Code.
                </div>

                {/* QR Code */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', borderRadius: 12, padding: 16, marginBottom: '1.25rem', minHeight: 220 }}>
                  {qrcode ? (
                    <Image
                      src={qrcode.startsWith('data:') ? qrcode : `data:image/png;base64,${qrcode}`}
                      alt="QR Code WhatsApp"
                      width={200}
                      height={200}
                      unoptimized
                    />
                  ) : (
                    <div style={{ color: '#999', fontSize: 13 }}>Carregando QR Code...</div>
                  )}
                </div>

                {/* Status */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: '1.25rem', fontSize: 12, color: 'rgba(255,255,255,.4)' }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80' }} />
                  Aguardando leitura do QR Code...
                </div>

                {erro && (
                  <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#f87171', marginBottom: 14 }}>
                    {erro}
                  </div>
                )}

                <button onClick={gerarNovoQR} disabled={gerandoQR} style={{
                  width: '100%', padding: '10px', background: 'transparent',
                  border: '1px solid #1a3a1a', borderRadius: 8, color: 'rgba(255,255,255,.5)',
                  fontSize: 13, cursor: gerandoQR ? 'default' : 'pointer',
                  opacity: gerandoQR ? 0.5 : 1,
                }}>
                  {gerandoQR ? 'Gerando...' : '↻ Gerar novo QR'}
                </button>

                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.25)', textAlign: 'center', marginTop: 12 }}>
                  instância: {instancia}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
