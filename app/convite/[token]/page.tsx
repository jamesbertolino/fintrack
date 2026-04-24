'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import GranaUpLogo from '@/components/GranaUpLogo'

type Estado = 'carregando' | 'valido' | 'invalido' | 'aceito' | 'erro'

export default function ConvitePage() {
  const params = useParams()
  const token  = params.token as string
  const router = useRouter()
  const supabase = createClient()

  const [estado, setEstado]       = useState<Estado>('carregando')
  const [grupoNome, setGrupoNome] = useState('')
  const [convidadoPor, setConvid] = useState('')
  const [logado, setLogado]       = useState(false)
  const [aceitando, setAceitando] = useState(false)
  const [erroMsg, setErroMsg]     = useState('')

  useEffect(() => {
    async function init() {
      // Busca info pública do convite
      const res = await fetch(`/api/grupo/aceitar?token=${token}`)
      if (!res.ok) {
        const d = await res.json()
        setErroMsg(d.error || 'Convite inválido')
        setEstado('invalido')
        return
      }
      const d = await res.json()
      setGrupoNome(d.grupo_nome)
      setConvid(d.convidado_por)
      setEstado('valido')

      // Verifica se usuário está logado
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setLogado(true)
        // Aceita automaticamente
        await aceitar(user.id)
      }
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  async function aceitar(userId: string) {
    setAceitando(true)
    try {
      const res = await fetch('/api/grupo/aceitar', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token, user_id: userId }),
      })
      if (res.ok) {
        setEstado('aceito')
        setTimeout(() => router.push('/dashboard'), 2000)
      } else {
        const d = await res.json()
        setErroMsg(d.error || 'Erro ao aceitar convite')
        setEstado('erro')
      }
    } catch {
      setErroMsg('Erro de conexão')
      setEstado('erro')
    } finally {
      setAceitando(false)
    }
  }

  const card: React.CSSProperties = {
    width: '100%', maxWidth: 420,
    background: '#111', border: '1px solid #1a3a1a',
    borderRadius: 16, padding: '2rem', textAlign: 'center',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', color: '#fff', padding: '1.5rem' }}>

      <div style={{ marginBottom: '2rem' }}>
        <GranaUpLogo mode="compact" />
      </div>

      <div style={card}>

        {estado === 'carregando' && (
          <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 13 }}>Verificando convite...</div>
        )}

        {estado === 'invalido' && (
          <>
            <div style={{ fontSize: 40, marginBottom: 12 }}>❌</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#f87171', marginBottom: 8 }}>Convite inválido</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)' }}>{erroMsg}</div>
          </>
        )}

        {estado === 'aceito' && (
          <>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#4ade80', marginBottom: 8 }}>Bem-vindo ao {grupoNome}!</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)' }}>Redirecionando para o dashboard...</div>
          </>
        )}

        {estado === 'erro' && (
          <>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#f87171', marginBottom: 8 }}>Algo deu errado</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)' }}>{erroMsg}</div>
          </>
        )}

        {estado === 'valido' && !logado && (
          <>
            <div style={{ fontSize: 36, marginBottom: 14 }}>👋</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Você foi convidado!</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              <strong style={{ color: '#4ade80' }}>{convidadoPor}</strong> te convidou para o grupo{' '}
              <strong style={{ color: '#fff' }}>{grupoNome}</strong> no GranaUp.
            </div>
            <div style={{ background: 'rgba(22,163,74,.08)', border: '1px solid rgba(22,163,74,.2)', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: 'rgba(255,255,255,.6)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              🎯 GranaUp é um app de controle financeiro familiar com IA. Lance gastos pelo WhatsApp e acompanhe tudo no dashboard.
            </div>
            <a
              href={`/login?next=/convite/${token}`}
              style={{ display: 'block', width: '100%', padding: '12px', background: '#16a34a', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 600, textDecoration: 'none', boxSizing: 'border-box' }}
            >
              Criar conta / Fazer login →
            </a>
          </>
        )}

        {estado === 'valido' && logado && aceitando && (
          <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 13 }}>Entrando no grupo {grupoNome}...</div>
        )}

      </div>
    </div>
  )
}
