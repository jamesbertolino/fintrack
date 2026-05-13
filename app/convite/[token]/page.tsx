'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import PoupaUpLogo from '@/components/PoupaUpLogo'

type Estado = 'carregando' | 'valido' | 'invalido' | 'aceito' | 'erro'
type Tipo   = 'familia' | 'grupo'

export default function ConvitePage() {
  const params   = useParams()
  const token    = params.token as string
  const router   = useRouter()
  const search   = useSearchParams()
  const tipo: Tipo = search.get('tipo') === 'familia' ? 'familia' : 'grupo'
  const supabase = createClient()

  const [estado, setEstado]         = useState<Estado>('carregando')
  const [titulo, setTitulo]         = useState('')
  const [subtitulo, setSubtitulo]   = useState('')
  const [permissao, setPermissao]   = useState('')
  const [logado, setLogado]         = useState(false)
  const [aceitando, setAceitando]   = useState(false)
  const [erroMsg, setErroMsg]       = useState('')

  const aceitar = useCallback(async () => {
    setAceitando(true)
    try {
      const endpoint = tipo === 'familia' ? '/api/familia/aceitar' : '/api/grupo/aceitar'
      const body     = tipo === 'familia' ? { token } : { token, user_id: (await supabase.auth.getUser()).data.user?.id }
      const res      = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d        = await res.json()
      if (res.ok) {
        if (d.permissao) setPermissao(d.permissao)
        setEstado('aceito')
        setTimeout(() => router.push('/dashboard'), 2500)
      } else {
        setErroMsg(d.error || 'Erro ao aceitar convite')
        setEstado('erro')
      }
    } catch {
      setErroMsg('Erro de conexão')
      setEstado('erro')
    } finally {
      setAceitando(false)
    }
  }, [token, tipo, router, supabase])

  useEffect(() => {
    async function init() {
      if (tipo === 'familia') {
        // Lê token diretamente via supabase (política permite select público)
        const { data: convite } = await supabase
          .from('familia_convites')
          .select('aceito, expires_at, permissao, familia_grupos!familia_convites_grupo_id_fkey(dono_id, profiles!familia_grupos_dono_id_fkey(nome))')
          .eq('token', token)
          .single()

        if (!convite) { setErroMsg('Convite não encontrado ou expirado'); setEstado('invalido'); return }
        if (convite.aceito) { setErroMsg('Este convite já foi utilizado'); setEstado('invalido'); return }
        if (new Date(convite.expires_at) < new Date()) { setErroMsg('Convite expirado'); setEstado('invalido'); return }

        const grupo = convite.familia_grupos as { dono_id: string; profiles: { nome: string } | { nome: string }[] } | null
        const prof  = grupo ? (Array.isArray(grupo.profiles) ? grupo.profiles[0] : grupo.profiles) : null
        const nomeDono = prof?.nome || 'Alguém'
        setTitulo(`${nomeDono} te convidou!`)
        setSubtitulo(`Você terá acesso de <strong style="color:#fff">${convite.permissao === 'edicao' ? 'edição' : 'leitura'}</strong> ao painel financeiro compartilhado.`)
        setEstado('valido')
      } else {
        const res = await fetch(`/api/grupo/aceitar?token=${token}`)
        if (!res.ok) { const d = await res.json(); setErroMsg(d.error || 'Convite inválido'); setEstado('invalido'); return }
        const d = await res.json()
        setTitulo(`Você foi convidado para ${d.grupo_nome}!`)
        setSubtitulo(`<strong style="color:#4ade80">${d.convidado_por}</strong> te convidou para o grupo WhatsApp do PoupaUp.`)
        setEstado('valido')
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (user) { setLogado(true); await aceitar() }
    }
    init()
  }, [token, tipo, aceitar, supabase])

  const card: React.CSSProperties = {
    width: '100%', maxWidth: 440,
    background: '#111', border: '1px solid #1a3a1a',
    borderRadius: 16, padding: '2rem', textAlign: 'center',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', color: '#fff', padding: '1.5rem' }}>
      <div style={{ marginBottom: '2rem' }}><PoupaUpLogo mode="compact" /></div>
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
            <div style={{ fontSize: 18, fontWeight: 700, color: '#4ade80', marginBottom: 8 }}>
              {tipo === 'familia' ? `Bem-vindo à família! ${permissao === 'edicao' ? '(acesso de edição)' : '(acesso de leitura)'}` : 'Bem-vindo ao grupo!'}
            </div>
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
            <div style={{ fontSize: 36, marginBottom: 14 }}>{tipo === 'familia' ? '👨‍👩‍👧' : '👋'}</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{titulo}</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', marginBottom: '1.5rem', lineHeight: 1.6 }}
              dangerouslySetInnerHTML={{ __html: subtitulo }} />
            <div style={{ background: 'rgba(22,163,74,.08)', border: '1px solid rgba(22,163,74,.2)', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: 'rgba(255,255,255,.6)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              🎯 PoupaUp é um app de controle financeiro {tipo === 'familia' ? 'familiar' : 'com WhatsApp e IA'} para poupar e evoluir financeiramente.
            </div>
            <a
              href={`/login?next=/convite/${token}${tipo === 'familia' ? '?tipo=familia' : ''}`}
              style={{ display: 'block', width: '100%', padding: '12px', background: '#16a34a', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 600, textDecoration: 'none', boxSizing: 'border-box' }}
            >
              Criar conta / Fazer login →
            </a>
          </>
        )}

        {estado === 'valido' && logado && aceitando && (
          <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 13 }}>Processando convite...</div>
        )}

      </div>
    </div>
  )
}
