'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import PoupaUpLogo from '@/components/PoupaUpLogo'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [tab, setTab] = useState<'login' | 'cadastro'>('login')
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [nomeUsuario, setNomeUsuario] = useState('')
  const [erro, setErro] = useState('')

  const [loginForm, setLoginForm] = useState({ email: '', senha: '' })
  const [cadForm, setCadForm] = useState({ nome: '', email: '', senha: '' })
  const [forca, setForca] = useState({ pct: 0, cor: '', label: '' })

  function calcularForca(pw: string) {
    let score = 0
    if (pw.length >= 8) score++
    if (/[A-Z]/.test(pw)) score++
    if (/[0-9]/.test(pw)) score++
    if (/[^A-Za-z0-9]/.test(pw)) score++
    const map = [
      { pct: 0,   cor: 'transparent', label: '' },
      { pct: 25,  cor: '#ef4444',     label: 'Fraca' },
      { pct: 50,  cor: '#f97316',     label: 'Média' },
      { pct: 75,  cor: '#22c55e',     label: 'Boa' },
      { pct: 100, cor: '#4ade80',     label: 'Forte' },
    ]
    setForca(map[score] || map[0])
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: loginForm.email,
      password: loginForm.senha,
    })
    setLoading(false)
    if (error) { setErro('E-mail ou senha incorretos.'); return }
    router.push('/dashboard')
  }

  async function handleCadastro(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (cadForm.senha.length < 8) { setErro('A senha precisa ter pelo menos 8 caracteres.'); return }
    setLoading(true)
    const { data, error } = await supabase.auth.signUp({
      email: cadForm.email,
      password: cadForm.senha,
      options: {
        data: { nome: cadForm.nome },
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    })
    setLoading(false)
    if (error) { setErro(error.message); return }

    // Criar perfil na tabela profiles
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        nome: cadForm.nome.split(' ')[0],
        sobrenome: cadForm.nome.split(' ').slice(1).join(' '),
        plano: 'free',
      })
    }
    setNomeUsuario(cadForm.nome.split(' ')[0])
    setSucesso(true)
  }

  async function loginGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      minHeight: '100vh',
      fontFamily: 'system-ui, sans-serif',
    }}>

      {/* ── Lado esquerdo ── */}
      <div style={{
        background: '#0a1a0a',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '2.5rem',
      }}>
        {/* Logo */}
        <div>
          <PoupaUpLogo mode="full" />
        </div>

        {/* Hero */}
        <div>
          <div style={{ fontSize: 28, fontWeight: 500, color: '#fff', lineHeight: 1.3, marginBottom: '1.5rem' }}>
            Seu dinheiro<br />subindo de{' '}
            <span style={{ color: '#4ade80' }}>nível</span><br />todo mês.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              ['IA que categoriza', 'gastos automaticamente via webhook'],
              ['Detecta padrões', '"você gasta R$ 54 em delivery às sextas"'],
              ['Gamificação real', 'níveis, conquistas e XP financeiro'],
              ['Assistente IA', '"posso comprar isso agora?"'],
            ].map(([bold, rest]) => (
              <div key={bold} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', flexShrink: 0 }} />
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.4 }}>
                  <strong style={{ color: '#fff', fontWeight: 500 }}>{bold}</strong> {rest}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '2rem' }}>
          {[['847', 'usuários ativos'], ['R$ 2.4M', 'economizados'], ['4.9★', 'avaliação']].map(([val, lbl]) => (
            <div key={lbl}>
              <div style={{ fontSize: 18, fontWeight: 500, color: '#4ade80' }}>{val}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>{lbl}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Lado direito — formulário ── */}
      <div style={{
        background: '#0f1f0f',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        borderLeft: '1px solid #1a3a1a',
      }}>
        <div style={{ width: '100%', maxWidth: 320 }}>

          {/* Tabs */}
          <div style={{
            display: 'flex',
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid #1a3a1a',
            borderRadius: 8,
            padding: 3,
            marginBottom: '1.5rem',
          }}>
            {(['login', 'cadastro'] as const).map(t => (
              <button key={t} onClick={() => { setTab(t); setErro(''); setSucesso(false) }} style={{
                flex: 1, padding: '7px', textAlign: 'center', fontSize: 12, fontWeight: 500,
                borderRadius: 6, cursor: 'pointer', border: 'none',
                background: tab === t ? '#16a34a' : 'transparent',
                color: tab === t ? '#fff' : 'rgba(255,255,255,0.4)',
                transition: 'all .15s',
              }}>
                {t === 'login' ? 'Entrar' : 'Criar conta'}
              </button>
            ))}
          </div>

          {erro && (
            <div style={{
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#f87171',
              marginBottom: 12,
            }}>{erro}</div>
          )}

          {/* ── LOGIN ── */}
          {tab === 'login' && (
            <form onSubmit={handleLogin}>
              <div style={{ fontSize: 17, fontWeight: 500, color: '#fff', marginBottom: 3 }}>Bem-vindo de volta</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: '1.25rem' }}>Continue subindo de nível</div>
              <button type="button" onClick={loginGoogle} style={{
                width: '100%', padding: '11px', marginBottom: 16,
                background: '#fff', border: '1px solid #e5e7eb',
                borderRadius: 10, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                fontSize: 14, fontWeight: 500, color: '#374151',
              }}>
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
                  <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
                Entrar com Google
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1, height: 1, background: '#1a3a1a' }} />
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>ou</span>
                <div style={{ flex: 1, height: 1, background: '#1a3a1a' }} />
              </div>
              {[
                { label: 'E-mail', key: 'email', type: 'email', placeholder: 'seu@email.com' },
                { label: 'Senha',  key: 'senha', type: showPw ? 'text' : 'password', placeholder: '••••••••' },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key} style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.5)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={type}
                      placeholder={placeholder}
                      value={loginForm[key as keyof typeof loginForm]}
                      onChange={e => setLoginForm(prev => ({ ...prev, [key]: e.target.value }))}
                      required
                      style={{
                        width: '100%', fontSize: 13, padding: '9px 36px 9px 12px',
                        borderRadius: 8, border: '1px solid #1a3a1a',
                        background: 'rgba(0,0,0,0.3)', color: '#fff', outline: 'none',
                      }}
                    />
                    {key === 'senha' && (
                      <button type="button" onClick={() => setShowPw(!showPw)}
                        style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: showPw ? '#4ade80' : 'rgba(255,255,255,0.3)' }}>
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 7s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z" stroke="currentColor" strokeWidth="1.2"/><circle cx="7" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.2"/></svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <div style={{ textAlign: 'right', marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: 'rgba(74,222,128,0.7)', cursor: 'pointer' }}>Esqueci minha senha</span>
              </div>
              <button type="submit" disabled={loading} style={{
                width: '100%', padding: 11, background: '#16a34a', color: '#fff', border: 'none',
                borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: loading ? 'default' : 'pointer',
                opacity: loading ? 0.6 : 1,
              }}>
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>
          )}

          {/* ── CADASTRO ── */}
          {tab === 'cadastro' && !sucesso && (
            <form onSubmit={handleCadastro}>
              <div style={{ fontSize: 17, fontWeight: 500, color: '#fff', marginBottom: 3 }}>Criar sua conta</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: '1.25rem' }}>7 dias grátis no plano Pro</div>
              <button type="button" onClick={loginGoogle} style={{
                width: '100%', padding: '11px', marginBottom: 16,
                background: '#fff', border: '1px solid #e5e7eb',
                borderRadius: 10, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                fontSize: 14, fontWeight: 500, color: '#374151',
              }}>
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
                  <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
                Entrar com Google
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1, height: 1, background: '#1a3a1a' }} />
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>ou</span>
                <div style={{ flex: 1, height: 1, background: '#1a3a1a' }} />
              </div>
              {[
                { label: 'Nome',   key: 'nome',  type: 'text',     placeholder: 'Seu nome' },
                { label: 'E-mail', key: 'email', type: 'email',    placeholder: 'seu@email.com' },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key} style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.5)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
                  <input
                    type={type} placeholder={placeholder}
                    value={cadForm[key as keyof typeof cadForm]}
                    onChange={e => setCadForm(prev => ({ ...prev, [key]: e.target.value }))}
                    required
                    style={{
                      width: '100%', fontSize: 13, padding: '9px 12px',
                      borderRadius: 8, border: '1px solid #1a3a1a',
                      background: 'rgba(0,0,0,0.3)', color: '#fff', outline: 'none',
                    }}
                  />
                </div>
              ))}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.5)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Senha</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPw ? 'text' : 'password'}
                    placeholder="mín. 8 caracteres"
                    value={cadForm.senha}
                    onChange={e => { setCadForm(prev => ({ ...prev, senha: e.target.value })); calcularForca(e.target.value) }}
                    required
                    style={{
                      width: '100%', fontSize: 13, padding: '9px 36px 9px 12px',
                      borderRadius: 8, border: '1px solid #1a3a1a',
                      background: 'rgba(0,0,0,0.3)', color: '#fff', outline: 'none',
                    }}
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: showPw ? '#4ade80' : 'rgba(255,255,255,0.3)' }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 7s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z" stroke="currentColor" strokeWidth="1.2"/><circle cx="7" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.2"/></svg>
                  </button>
                </div>
                {cadForm.senha && (
                  <>
                    <div style={{ height: 3, borderRadius: 2, marginTop: 5, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 2, width: `${forca.pct}%`, background: forca.cor, transition: 'all .3s' }} />
                    </div>
                    <div style={{ fontSize: 10, marginTop: 3, color: forca.cor }}>{forca.label}</div>
                  </>
                )}
              </div>
              <button type="submit" disabled={loading} style={{
                width: '100%', padding: 11, background: '#16a34a', color: '#fff', border: 'none',
                borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: loading ? 'default' : 'pointer',
                opacity: loading ? 0.6 : 1,
              }}>
                {loading ? 'Criando conta...' : 'Criar conta grátis'}
              </button>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', textAlign: 'center', marginTop: '0.875rem', lineHeight: 1.6 }}>
                Ao criar sua conta você concorda com os{' '}
                <span style={{ color: 'rgba(74,222,128,0.6)', cursor: 'pointer' }}>Termos</span> e a{' '}
                <span style={{ color: 'rgba(74,222,128,0.6)', cursor: 'pointer' }}>Privacidade</span>
              </div>
            </form>
          )}

          {/* ── SUCESSO ── */}
          {tab === 'cadastro' && sucesso && (
            <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <polyline points="3,12 10,19 21,6" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)',
                borderRadius: 20, padding: '4px 12px', fontSize: 11, color: '#4ade80',
                fontWeight: 500, marginBottom: '0.875rem',
              }}>
                +50 XP — conta criada!
              </div>
              <div style={{ fontSize: 16, fontWeight: 500, color: '#fff', marginBottom: 6 }}>
                Bem-vindo, {nomeUsuario}!
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
                Você está no nível 1. Verifique seu e-mail para ativar a conta e começar a subir de nível.
              </div>
              <button
                onClick={() => router.push('/dashboard')}
                style={{
                  width: '100%', padding: 11, background: '#16a34a', color: '#fff', border: 'none',
                  borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                }}>
                Ir para o app →
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

