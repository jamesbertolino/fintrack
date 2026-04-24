'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

interface Profile {
  id: string
  nome: string
  sobrenome: string
  whatsapp: string
  timezone: string
  idioma: string
  plano: string
  created_at: string
}

interface WebhookConfig {
  token: string
  ativo: boolean
  plano: string
}

interface GrupoMembro {
  id: string
  whatsapp: string
  status: string
  profiles: { nome: string }[] | { nome: string } | null
}

interface Grupo {
  id: string
  nome: string
  criado_por: string
}

export default function PerfilPage() {
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile]       = useState<Profile | null>(null)
  const [webhook, setWebhook]       = useState<WebhookConfig | null>(null)
  const [email, setEmail]           = useState('')
  const [loading, setLoading]       = useState(true)
  const [salvando, setSalvando]     = useState(false)
  const [sucesso, setSucesso]       = useState('')
  const [erro, setErro]             = useState('')
  const [abaSel, setAbaSel]         = useState<'perfil' | 'webhook' | 'grupo' | 'plano' | 'seguranca'>('perfil')
  const [grupo, setGrupo]           = useState<Grupo | null>(null)
  const [membros, setMembros]       = useState<GrupoMembro[]>([])
  const [novoNumero, setNovoNum]    = useState('')
  const [convidando, setConvidan]   = useState(false)
  const [removendo, setRemovendo]   = useState<string | null>(null)
  const [tokenVisivel, setTokenVis] = useState(false)
  const [copiado, setCopiado]       = useState(false)

  const [form, setForm] = useState({ nome: '', sobrenome: '', whatsapp: '', timezone: 'America/Sao_Paulo', idioma: 'pt-BR' })
  const [senhaForm, setSenhaForm] = useState({ nova: '', confirmar: '' })

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    setEmail(user.email || '')

    const [{ data: prof }, { data: wh }, { data: grupoData, error: grupoError }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('webhook_configs').select('token, ativo, plano').eq('user_id', user.id).single(),
      supabase.from('grupos').select('id, nome, whatsapp_grupo_id, criado_por').eq('criado_por', user.id).single(),
    ])

    console.log('[perfil] user.id:', user.id)
    console.log('[perfil] grupoData:', JSON.stringify(grupoData))
    console.log('[perfil] grupoError:', JSON.stringify(grupoError))

    const grp = grupoData

    if (prof) {
      setProfile(prof)
      setForm({ nome: prof.nome || '', sobrenome: prof.sobrenome || '', whatsapp: prof.whatsapp || '', timezone: prof.timezone || 'America/Sao_Paulo', idioma: prof.idioma || 'pt-BR' })
    }
    if (wh) setWebhook(wh)
    if (grp) {
      setGrupo(grp)
      const { data: mem } = await supabase
        .from('grupo_membros')
        .select('id, whatsapp, status, profiles(nome)')
        .eq('grupo_id', grp.id)
        .order('created_at')
      setMembros((mem as GrupoMembro[]) || [])
    }
    setLoading(false)
  }, [supabase, router])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar()
  }, [carregar])

  async function salvarPerfil(e: React.FormEvent) {
    e.preventDefault()
    setErro(''); setSucesso('')
    if (!form.nome.trim()) { setErro('Nome obrigatório'); return }
    setSalvando(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('profiles').update({
      nome: form.nome.trim(),
      sobrenome: form.sobrenome.trim(),
      whatsapp: form.whatsapp.replace(/\D/g, '') || null,
      timezone: form.timezone,
      idioma: form.idioma,
    }).eq('id', user.id)

    setSalvando(false)
    if (error) { setErro('Erro ao salvar: ' + error.message); return }
    setSucesso('Perfil atualizado com sucesso!')
    carregar()
    setTimeout(() => setSucesso(''), 3000)
  }

  async function alterarSenha(e: React.FormEvent) {
    e.preventDefault()
    setErro(''); setSucesso('')
    if (senhaForm.nova.length < 8) { setErro('Senha deve ter no mínimo 8 caracteres'); return }
    if (senhaForm.nova !== senhaForm.confirmar) { setErro('Senhas não conferem'); return }
    setSalvando(true)

    const { error } = await supabase.auth.updateUser({ password: senhaForm.nova })
    setSalvando(false)
    if (error) { setErro('Erro: ' + error.message); return }
    setSucesso('Senha alterada com sucesso!')
    setSenhaForm({ nova: '', confirmar: '' })
    setTimeout(() => setSucesso(''), 3000)
  }

  async function toggleWebhook() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !webhook) return
    const novoAtivo = !webhook.ativo
    await supabase.from('webhook_configs').update({ ativo: novoAtivo }).eq('user_id', user.id)
    setWebhook(prev => prev ? { ...prev, ativo: novoAtivo } : prev)
  }

  async function regenerarToken() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const novoToken = crypto.randomUUID().replace(/-/g, '')
    await supabase.from('webhook_configs').update({ token: novoToken }).eq('user_id', user.id)
    setWebhook(prev => prev ? { ...prev, token: novoToken } : prev)
    setSucesso('Token regenerado!')
    setTimeout(() => setSucesso(''), 2000)
  }

  function copiarToken() {
    if (!webhook) return
    navigator.clipboard.writeText(webhook.token)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  async function convidarMembro() {
    if (!novoNumero.trim() || !grupo) return
    setConvidan(true); setErro(''); setSucesso('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const res  = await fetch('/api/grupo/convidar', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ userId: user.id, numero: novoNumero.trim(), grupo_id: grupo.id }),
    })
    const data = await res.json()
    setConvidan(false)
    if (!res.ok) { setErro(data.error || 'Erro ao convidar'); return }
    setSucesso('Convite enviado via WhatsApp!')
    setNovoNum('')
    carregar()
    setTimeout(() => setSucesso(''), 3000)
  }

  async function removerMembro(membroId: string) {
    setRemovendo(membroId)
    await supabase.from('grupo_membros').delete().eq('id', membroId)
    setMembros(prev => prev.filter(m => m.id !== membroId))
    setRemovendo(null)
  }

  function copiarUrlWebhook() {
    const url = `${window.location.origin}/api/webhook/${profile?.id}`
    navigator.clipboard.writeText(url)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const inputStyle = {
    width: '100%', padding: '9px 12px', background: '#0a1a0a',
    border: '1px solid #1a3a1a', borderRadius: 8, color: '#fff',
    fontSize: 13, outline: 'none',
  }

  const labelStyle = {
    display: 'block', fontSize: 10, fontWeight: 500,
    color: 'rgba(255,255,255,.4)', marginBottom: 5,
    textTransform: 'uppercase' as const, letterSpacing: '.05em',
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', fontFamily: 'system-ui' }}>Carregando perfil...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: 'system-ui, sans-serif', fontSize: 13, color: '#fff' }}>

      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '.875rem 1.5rem', borderBottom: '1px solid #1a3a1a', background: '#0a1a0a' }}>
        <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.4)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Dashboard
        </button>
        <span style={{ color: 'rgba(255,255,255,.2)' }}>/</span>
        <span style={{ fontSize: 15, fontWeight: 500 }}>Perfil</span>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '1.5rem' }}>

        {/* Avatar + nome */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: '1.5rem', padding: '1.25rem', background: '#111', border: '1px solid #1a3a1a', borderRadius: 14 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
            {profile?.nome?.[0]?.toUpperCase() || 'U'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#fff' }}>{profile?.nome} {profile?.sobrenome}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>{email}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <span style={{ fontSize: 10, background: profile?.plano === 'pro' ? 'rgba(251,191,36,.15)' : 'rgba(74,222,128,.1)', color: profile?.plano === 'pro' ? '#fbbf24' : '#4ade80', padding: '2px 8px', borderRadius: 10, fontWeight: 500, textTransform: 'uppercase' }}>
                {profile?.plano === 'pro' ? '⭐ Pro' : 'Free'}
              </span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,.3)' }}>
                desde {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Abas */}
        <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,.3)', border: '1px solid #1a3a1a', borderRadius: 8, padding: 3, marginBottom: '1.25rem' }}>
          {([
            { id: 'perfil',    label: 'Dados pessoais' },
            { id: 'webhook',   label: 'Webhook' },
            { id: 'grupo',     label: 'Grupo' },
            { id: 'plano',     label: 'Plano' },
            { id: 'seguranca', label: 'Segurança' },
          ] as const).map(a => (
            <button key={a.id} onClick={() => { setAbaSel(a.id); setErro(''); setSucesso('') }} style={{
              flex: 1, padding: '7px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
              background: abaSel === a.id ? '#16a34a' : 'transparent',
              color: abaSel === a.id ? '#fff' : 'rgba(255,255,255,.4)',
            }}>{a.label}</button>
          ))}
        </div>

        {/* Feedback */}
        {sucesso && <div style={{ background: 'rgba(74,222,128,.1)', border: '1px solid rgba(74,222,128,.3)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#4ade80', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><polyline points="2,7 5.5,10.5 12,3" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          {sucesso}
        </div>}
        {erro && <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#f87171', marginBottom: 12 }}>{erro}</div>}

        {/* ── DADOS PESSOAIS ── */}
        {abaSel === 'perfil' && (
          <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 12, padding: '1.25rem' }}>
            <form onSubmit={salvarPerfil}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={labelStyle}>Nome</label>
                  <input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Seu nome" required style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Sobrenome</label>
                  <input value={form.sobrenome} onChange={e => setForm(p => ({ ...p, sobrenome: e.target.value }))} placeholder="Seu sobrenome" style={inputStyle} />
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>WhatsApp</label>
                <input
                  value={form.whatsapp}
                  onChange={e => setForm(p => ({ ...p, whatsapp: e.target.value }))}
                  placeholder="5511999999999 (DDI + DDD + número)"
                  type="tel"
                  style={inputStyle}
                />
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', marginTop: 4 }}>
                  Número autorizado a enviar mensagens e receber alertas via WhatsApp. Formato: <strong style={{color: 'rgba(255,255,255,.5)'}}>5511999999999</strong>
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Idioma</label>
                <select
                  value={form.idioma}
                  onChange={e => setForm(p => ({ ...p, idioma: e.target.value }))}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  <option value="pt-BR">🇧🇷 Português (Brasil)</option>
                  <option value="en-US">🇺🇸 English (US)</option>
                  <option value="es-ES">🇪🇸 Español</option>
                </select>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Fuso horário (Timezone)</label>
                <select
                  value={form.timezone}
                  onChange={e => setForm(p => ({ ...p, timezone: e.target.value }))}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  <optgroup label="Brasil">
                    <option value="America/Sao_Paulo">🇧🇷 Brasília (GMT-3)</option>
                    <option value="America/Manaus">🇧🇷 Manaus (GMT-4)</option>
                    <option value="America/Belem">🇧🇷 Belém (GMT-3)</option>
                    <option value="America/Fortaleza">🇧🇷 Fortaleza (GMT-3)</option>
                    <option value="America/Recife">🇧🇷 Recife (GMT-3)</option>
                    <option value="America/Noronha">🇧🇷 Fernando de Noronha (GMT-2)</option>
                    <option value="America/Porto_Velho">🇧🇷 Porto Velho (GMT-4)</option>
                    <option value="America/Boa_Vista">🇧🇷 Boa Vista (GMT-4)</option>
                    <option value="America/Rio_Branco">🇧🇷 Rio Branco (GMT-5)</option>
                  </optgroup>
                  <optgroup label="América do Sul">
                    <option value="America/Argentina/Buenos_Aires">🇦🇷 Buenos Aires (GMT-3)</option>
                    <option value="America/Santiago">🇨🇱 Santiago (GMT-3)</option>
                    <option value="America/Lima">🇵🇪 Lima (GMT-5)</option>
                    <option value="America/Bogota">🇨🇴 Bogotá (GMT-5)</option>
                  </optgroup>
                  <optgroup label="América do Norte">
                    <option value="America/New_York">🇺🇸 New York (GMT-5)</option>
                    <option value="America/Chicago">🇺🇸 Chicago (GMT-6)</option>
                    <option value="America/Denver">🇺🇸 Denver (GMT-7)</option>
                    <option value="America/Los_Angeles">🇺🇸 Los Angeles (GMT-8)</option>
                    <option value="America/Toronto">🇨🇦 Toronto (GMT-5)</option>
                  </optgroup>
                  <optgroup label="Europa">
                    <option value="Europe/Lisbon">🇵🇹 Lisboa (GMT+0)</option>
                    <option value="Europe/London">🇬🇧 Londres (GMT+0)</option>
                    <option value="Europe/Paris">🇫🇷 Paris (GMT+1)</option>
                    <option value="Europe/Berlin">🇩🇪 Berlin (GMT+1)</option>
                  </optgroup>
                  <optgroup label="UTC">
                    <option value="UTC">🌍 UTC (GMT+0)</option>
                  </optgroup>
                </select>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', marginTop: 4 }}>
                  Usado para exibir datas e horas corretamente no app e nas mensagens WhatsApp.
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>E-mail</label>
                <input value={email} disabled style={{ ...inputStyle, opacity: 0.5, cursor: 'not-allowed' }} />
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', marginTop: 4 }}>O e-mail não pode ser alterado por aqui.</div>
              </div>
              <button type="submit" disabled={salvando} style={{ padding: '10px 20px', background: '#16a34a', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 500, cursor: salvando ? 'default' : 'pointer', opacity: salvando ? 0.6 : 1 }}>
                {salvando ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </form>
          </div>
        )}

        {/* ── WEBHOOK ── */}
        {abaSel === 'webhook' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Status */}
            <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 12, padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 3 }}>Status do webhook</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)' }}>Receba transações automaticamente via n8n ou outros sistemas</div>
                </div>
                <div onClick={toggleWebhook} style={{
                  width: 44, height: 24, borderRadius: 12, cursor: 'pointer',
                  background: webhook?.ativo ? '#16a34a' : 'rgba(255,255,255,.1)',
                  position: 'relative', transition: 'background .2s', flexShrink: 0,
                }}>
                  <div style={{ position: 'absolute', top: 3, left: webhook?.ativo ? 22 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: webhook?.ativo ? '#4ade80' : '#6b7280' }} />
                <span style={{ fontSize: 12, color: webhook?.ativo ? '#4ade80' : 'rgba(255,255,255,.4)' }}>
                  {webhook?.ativo ? 'Ativo — recebendo transações' : 'Inativo'}
                </span>
              </div>
            </div>

            {/* URL */}
            <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 12, padding: '1.25rem' }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>URL do endpoint</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, padding: '9px 12px', background: '#0a1a0a', border: '1px solid #1a3a1a', borderRadius: 8, fontSize: 11, fontFamily: 'monospace', color: 'rgba(255,255,255,.6)', wordBreak: 'break-all' }}>
                  {typeof window !== 'undefined' ? `${window.location.origin}/api/webhook/${profile?.id}` : '/api/webhook/...'}
                </div>
                <button onClick={copiarUrlWebhook} style={{ padding: '9px 14px', background: copiado ? 'rgba(74,222,128,.15)' : 'rgba(255,255,255,.06)', border: `1px solid ${copiado ? 'rgba(74,222,128,.3)' : '#1a3a1a'}`, borderRadius: 8, color: copiado ? '#4ade80' : 'rgba(255,255,255,.5)', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {copiado ? '✓ copiado' : 'Copiar'}
                </button>
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', marginTop: 6 }}>Use esta URL no n8n como destino do webhook. Sempre envie o token no header <code style={{ color: '#4ade80' }}>Authorization: Bearer TOKEN</code></div>
            </div>

            {/* Token */}
            <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 12, padding: '1.25rem' }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Token de autenticação</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 1, padding: '9px 12px', background: '#0a1a0a', border: '1px solid #1a3a1a', borderRadius: 8, fontSize: 11, fontFamily: 'monospace', color: 'rgba(255,255,255,.7)', letterSpacing: tokenVisivel ? '0' : '0.2em' }}>
                  {tokenVisivel ? (webhook?.token || '—') : '••••••••••••••••••••••••'}
                </div>
                <button onClick={() => setTokenVis(!tokenVisivel)} style={{ padding: '9px 12px', background: 'rgba(255,255,255,.06)', border: '1px solid #1a3a1a', borderRadius: 8, color: 'rgba(255,255,255,.5)', fontSize: 12, cursor: 'pointer' }}>
                  {tokenVisivel ? 'Ocultar' : 'Mostrar'}
                </button>
                <button onClick={copiarToken} style={{ padding: '9px 12px', background: copiado ? 'rgba(74,222,128,.15)' : 'rgba(255,255,255,.06)', border: `1px solid ${copiado ? 'rgba(74,222,128,.3)' : '#1a3a1a'}`, borderRadius: 8, color: copiado ? '#4ade80' : 'rgba(255,255,255,.5)', fontSize: 12, cursor: 'pointer' }}>
                  {copiado ? '✓' : 'Copiar'}
                </button>
              </div>
              <button onClick={regenerarToken} style={{ fontSize: 11, padding: '6px 12px', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 6, color: '#f87171', cursor: 'pointer' }}>
                ⚠ Regenerar token — invalida o token atual
              </button>
            </div>

            {/* Formato payload */}
            <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 12, padding: '1.25rem' }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Formato do payload</div>
              <div style={{ background: '#0a0a0a', borderRadius: 8, padding: '12px', fontFamily: 'monospace', fontSize: 11, color: '#4ade80', lineHeight: 1.8 }}>
                {`{
  "descricao": "Supermercado Extra",
  "valor": -87.50,
  "data_hora": "2026-04-23T10:00:00Z",
  "tipo": "debito",
  "categoria": "Alimentação"
}`}
              </div>
            </div>
          </div>
        )}

        {/* ── GRUPO ── */}
        {abaSel === 'grupo' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {!grupo ? (
              <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 12, padding: '1.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', marginBottom: 12 }}>
                  Você ainda não tem um grupo configurado. Conclua o setup para criar seu grupo familiar.
                </div>
                <button onClick={() => router.push('/setup')} style={{ padding: '9px 18px', background: '#16a34a', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
                  Ir para o Setup
                </button>
              </div>
            ) : (
              <>
                {/* Info do grupo */}
                <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 12, padding: '1.25rem' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{grupo.nome}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>
                    {membros.length} membro{membros.length !== 1 ? 's' : ''}
                  </div>
                </div>

                {/* Convidar */}
                <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 12, padding: '1.25rem' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Convidar membro</div>
                  {profile?.plano !== 'pro' ? (
                    <div style={{ background: 'rgba(251,191,36,.07)', border: '1px solid rgba(251,191,36,.2)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#fbbf24' }}>
                      ⭐ Convide membros com o plano Pro
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        value={novoNumero}
                        onChange={e => setNovoNum(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && convidarMembro()}
                        placeholder="5511999999999"
                        style={{ ...inputStyle, flex: 1 }}
                      />
                      <button onClick={convidarMembro} disabled={convidando || !novoNumero.trim()} style={{ padding: '9px 14px', background: '#16a34a', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 500, cursor: convidando ? 'default' : 'pointer', opacity: convidando ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                        {convidando ? 'Enviando...' : 'Convidar'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Lista de membros */}
                <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 12, padding: '1.25rem' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Membros</div>
                  {membros.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)' }}>Nenhum membro ainda. Convide alguém!</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {membros.map(m => (
                        <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: '#0a1a0a', borderRadius: 8, border: '1px solid #1a3a1a' }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500 }}>{(Array.isArray(m.profiles) ? m.profiles[0]?.nome : (m.profiles as { nome: string } | null)?.nome) || m.whatsapp}</div>
                            {(Array.isArray(m.profiles) ? m.profiles[0]?.nome : (m.profiles as { nome: string } | null)?.nome) && <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', marginTop: 1 }}>{m.whatsapp}</div>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 500, background: m.status === 'ativo' ? 'rgba(74,222,128,.12)' : 'rgba(251,191,36,.12)', color: m.status === 'ativo' ? '#4ade80' : '#fbbf24' }}>
                              {m.status === 'ativo' ? 'ativo' : 'pendente'}
                            </span>
                            {profile?.plano === 'pro' && (
                              <button onClick={() => removerMembro(m.id)} disabled={removendo === m.id} style={{ padding: '3px 8px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 6, color: '#f87171', fontSize: 11, cursor: removendo === m.id ? 'default' : 'pointer', opacity: removendo === m.id ? 0.5 : 1 }}>
                                {removendo === m.id ? '...' : 'Remover'}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── PLANO ── */}
        {abaSel === 'plano' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {/* Free */}
              <div style={{ background: profile?.plano === 'free' ? 'rgba(74,222,128,.06)' : '#111', border: `1px solid ${profile?.plano === 'free' ? 'rgba(74,222,128,.3)' : '#1a3a1a'}`, borderRadius: 14, padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>Free</div>
                  {profile?.plano === 'free' && <span style={{ fontSize: 10, background: 'rgba(74,222,128,.15)', color: '#4ade80', padding: '2px 8px', borderRadius: 10 }}>Plano atual</span>}
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#4ade80', marginBottom: 14 }}>R$ 0<span style={{ fontSize: 13, fontWeight: 400, color: 'rgba(255,255,255,.4)' }}>/mês</span></div>
                {['5 metas', '10 webhooks/min', 'GranaBot básico', 'Dashboard completo'].map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7, fontSize: 12, color: 'rgba(255,255,255,.6)' }}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><polyline points="1.5,6 4.5,9 10.5,3" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    {f}
                  </div>
                ))}
              </div>

              {/* Pro */}
              <div style={{ background: profile?.plano === 'pro' ? 'rgba(251,191,36,.06)' : '#111', border: `1px solid ${profile?.plano === 'pro' ? 'rgba(251,191,36,.3)' : '#1a3a1a'}`, borderRadius: 14, padding: '1.25rem', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 12, right: 12, fontSize: 10, background: '#fbbf24', color: '#0a0a0a', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>EM BREVE</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>Pro ⭐</div>
                  {profile?.plano === 'pro' && <span style={{ fontSize: 10, background: 'rgba(251,191,36,.15)', color: '#fbbf24', padding: '2px 8px', borderRadius: 10 }}>Plano atual</span>}
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#fbbf24', marginBottom: 14 }}>R$ 29<span style={{ fontSize: 13, fontWeight: 400, color: 'rgba(255,255,255,.4)' }}>/mês</span></div>
                {['Metas ilimitadas', '60 webhooks/min', 'GranaBot avançado', 'Relatórios em PDF', 'Suporte prioritário', 'Multibancos (em breve)'].map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7, fontSize: 12, color: 'rgba(255,255,255,.6)' }}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><polyline points="1.5,6 4.5,9 10.5,3" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    {f}
                  </div>
                ))}
                <button disabled style={{ width: '100%', marginTop: 10, padding: '9px', background: 'rgba(251,191,36,.1)', border: '1px solid rgba(251,191,36,.2)', borderRadius: 8, color: '#fbbf24', fontSize: 12, fontWeight: 500, cursor: 'not-allowed', opacity: 0.7 }}>
                  Assinar Pro — em breve
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── SEGURANÇA ── */}
        {abaSel === 'seguranca' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 12, padding: '1.25rem' }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 14 }}>Alterar senha</div>
              <form onSubmit={alterarSenha}>
                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>Nova senha</label>
                  <input type="password" value={senhaForm.nova} onChange={e => setSenhaForm(p => ({ ...p, nova: e.target.value }))} placeholder="mínimo 8 caracteres" required style={inputStyle} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Confirmar nova senha</label>
                  <input type="password" value={senhaForm.confirmar} onChange={e => setSenhaForm(p => ({ ...p, confirmar: e.target.value }))} placeholder="repita a senha" required style={inputStyle} />
                </div>
                <button type="submit" disabled={salvando} style={{ padding: '10px 20px', background: '#16a34a', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 500, cursor: salvando ? 'default' : 'pointer', opacity: salvando ? 0.6 : 1 }}>
                  {salvando ? 'Alterando...' : 'Alterar senha'}
                </button>
              </form>
            </div>

            <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 12, padding: '1.25rem' }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Sessões ativas</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', marginBottom: 12 }}>Você está conectado neste dispositivo.</div>
              <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }} style={{ padding: '9px 16px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 8, color: '#f87171', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                Encerrar todas as sessões
              </button>
            </div>

            <div style={{ background: 'rgba(239,68,68,.04)', border: '1px solid rgba(239,68,68,.15)', borderRadius: 12, padding: '1.25rem' }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#f87171', marginBottom: 6 }}>Zona de perigo</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', marginBottom: 12 }}>Ações irreversíveis. Tenha certeza antes de continuar.</div>
              <button disabled style={{ padding: '9px 16px', background: 'transparent', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, color: 'rgba(239,68,68,.5)', fontSize: 12, cursor: 'not-allowed' }}>
                Excluir conta — em breve
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
