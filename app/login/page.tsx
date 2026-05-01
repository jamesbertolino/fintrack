'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import PoupaUpLogo from '@/components/PoupaUpLogo'

// ── Componentes fora do render ──────────────────────────────────────────────

function GoogleBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{
      width: '100%', padding: '11px', marginBottom: 16,
      background: '#fff', border: '1px solid #e5e7eb',
      borderRadius: 10, cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      fontSize: 14, fontWeight: 500, color: '#374151', boxSizing: 'border-box',
    }}>
      <svg width="18" height="18" viewBox="0 0 18 18">
        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
        <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
        <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
      </svg>
      Entrar com Google
    </button>
  )
}

function Divider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
      <div style={{ flex: 1, height: 1, background: '#1a3a1a' }} />
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>ou</span>
      <div style={{ flex: 1, height: 1, background: '#1a3a1a' }} />
    </div>
  )
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  )
  useState(() => {
    if (typeof window === 'undefined') return
    const check = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  })
  return isMobile
}

// ── Componente principal ────────────────────────────────────────────────────

function LoginContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const supabase     = createClient()
  const isMobile     = useIsMobile()

  const [tab, setTab]       = useState<'login' | 'cadastro'>('login')
  const [estado, setEstado] = useState<'form' | 'sucesso' | 'aguardando_email'>('form')
  const [loading, setLoading]         = useState(false)
  const [showPw, setShowPw]           = useState(false)
  const [nomeUsuario, setNomeUsuario] = useState('')
  const [emailDigitado, setEmailDigitado] = useState('')
  const [erro, setErro]               = useState('')

  const [loginForm, setLoginForm] = useState({ email: '', senha: '' })
  const [cadForm, setCadForm]     = useState({ nome: '', email: '', senha: '' })
  const [forca, setForca]         = useState({ pct: 0, cor: '', label: '' })

  const erroParam = searchParams.get('erro')

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
    const { error } = await supabase.auth.signInWithPassword({ email: loginForm.email, password: loginForm.senha })
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
      options: { data: { nome: cadForm.nome }, emailRedirectTo: `${window.location.origin}/dashboard` },
    })
    setLoading(false)
    if (error) { setErro(error.message); return }
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        nome: cadForm.nome.split(' ')[0],
        sobrenome: cadForm.nome.split(' ').slice(1).join(' '),
        plano: 'free',
      })
    }
    if (data.user && !data.user.email_confirmed_at) { setEstado('aguardando_email'); return }
    setNomeUsuario(cadForm.nome.split(' ')[0])
    setEstado('sucesso')
  }

  async function loginGoogle() {
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/auth/callback` } })
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', fontSize: 13, padding: '10px 12px',
    borderRadius: 8, border: '1px solid #1a3a1a',
    background: 'rgba(0,0,0,0.3)', color: '#fff', outline: 'none',
    boxSizing: 'border-box',
  }

  const Erros = () => (
    <>
      {erroParam === 'email_nao_confirmado' && (
        <div style={{ background: 'rgba(234,179,8,.1)', border: '1px solid rgba(234,179,8,.3)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#fde047', marginBottom: 12 }}>
          ⚠️ Confirme seu email antes de entrar.
        </div>
      )}
      {erro && (
        <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#f87171', marginBottom: 12 }}>
          {erro}
        </div>
      )}
    </>
  )

  const FormLogin = () => (
    <form onSubmit={handleLogin}>
      <div style={{ fontSize: isMobile ? 18 : 17, fontWeight: 500, color: '#fff', marginBottom: 3 }}>Bem-vindo de volta</div>
      <div style={{ fontSize: isMobile ? 13 : 12, color: 'rgba(255,255,255,.4)', marginBottom: '1.25rem' }}>Continue subindo de nível</div>
      <GoogleBtn onClick={loginGoogle} />
      <Divider />
      {[
        { label: 'E-mail', key: 'email', type: 'email',                          placeholder: 'seu@email.com' },
        { label: 'Senha',  key: 'senha', type: showPw ? 'text' : 'password',     placeholder: '••••••••' },
      ].map(({ label, key, type, placeholder }) => (
        <div key={key} style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,.5)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</label>
          <div style={{ position: 'relative' }}>
            <input type={type} placeholder={placeholder}
              value={loginForm[key as keyof typeof loginForm]}
              onChange={e => setLoginForm(prev => ({ ...prev, [key]: e.target.value }))}
              required style={{ ...inputStyle, paddingRight: key === 'senha' ? 40 : 12 }} />
            {key === 'senha' && (
              <button type="button" onClick={() => setShowPw(!showPw)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: showPw ? '#4ade80' : 'rgba(255,255,255,.3)' }}>
                <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M1 7s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z" stroke="currentColor" strokeWidth="1.2"/><circle cx="7" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.2"/></svg>
              </button>
            )}
          </div>
        </div>
      ))}
      <div style={{ textAlign: 'right', marginBottom: 16 }}>
        <span style={{ fontSize: 12, color: 'rgba(74,222,128,.7)', cursor: 'pointer' }}>Esqueci minha senha</span>
      </div>
      <button type="submit" disabled={loading} style={{
        width: '100%', padding: isMobile ? 13 : 11, background: '#16a34a', color: '#fff', border: 'none',
        borderRadius: 8, fontSize: isMobile ? 14 : 13, fontWeight: 500, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1,
      }}>
        {loading ? 'Entrando...' : 'Entrar'}
      </button>
    </form>
  )

  const FormCadastro = () => (
    <form onSubmit={handleCadastro}>
      <div style={{ fontSize: isMobile ? 18 : 17, fontWeight: 500, color: '#fff', marginBottom: 3 }}>Criar sua conta</div>
      <div style={{ fontSize: isMobile ? 13 : 12, color: 'rgba(255,255,255,.4)', marginBottom: '1.25rem' }}>7 dias grátis no plano Pro</div>
      <GoogleBtn onClick={loginGoogle} />
      <Divider />
      {[
        { label: 'Nome',   key: 'nome',  type: 'text',  placeholder: 'Seu nome' },
        { label: 'E-mail', key: 'email', type: 'email', placeholder: 'seu@email.com' },
      ].map(({ label, key, type, placeholder }) => (
        <div key={key} style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,.5)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</label>
          <input type={type} placeholder={placeholder}
            value={cadForm[key as keyof typeof cadForm]}
            onChange={e => { setCadForm(prev => ({ ...prev, [key]: e.target.value })); if (key === 'email') setEmailDigitado(e.target.value) }}
            required style={inputStyle} />
        </div>
      ))}
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,.5)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>Senha</label>
        <div style={{ position: 'relative' }}>
          <input type={showPw ? 'text' : 'password'} placeholder="mín. 8 caracteres"
            value={cadForm.senha}
            onChange={e => { setCadForm(prev => ({ ...prev, senha: e.target.value })); calcularForca(e.target.value) }}
            required style={{ ...inputStyle, paddingRight: 40 }} />
          <button type="button" onClick={() => setShowPw(!showPw)}
            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: showPw ? '#4ade80' : 'rgba(255,255,255,.3)' }}>
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M1 7s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z" stroke="currentColor" strokeWidth="1.2"/><circle cx="7" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.2"/></svg>
          </button>
        </div>
        {cadForm.senha && (
          <>
            <div style={{ height: 3, borderRadius: 2, marginTop: 6, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 2, width: `${forca.pct}%`, background: forca.cor, transition: 'all .3s' }} />
            </div>
            <div style={{ fontSize: 11, marginTop: 3, color: forca.cor }}>{forca.label}</div>
          </>
        )}
      </div>
      <button type="submit" disabled={loading} style={{
        width: '100%', padding: isMobile ? 13 : 11, background: '#16a34a', color: '#fff', border: 'none',
        borderRadius: 8, fontSize: isMobile ? 14 : 13, fontWeight: 500, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1,
      }}>
        {loading ? 'Criando conta...' : 'Criar conta grátis'}
      </button>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', textAlign: 'center', marginTop: '1rem', lineHeight: 1.6 }}>
        Ao criar sua conta você concorda com os{' '}
        <span style={{ color: 'rgba(74,222,128,.6)', cursor: 'pointer' }}>Termos</span> e a{' '}
        <span style={{ color: 'rgba(74,222,128,.6)', cursor: 'pointer' }}>Privacidade</span>
      </div>
    </form>
  )

  const Sucesso = () => (
    <div style={{ textAlign: 'center', padding: '1rem 0' }}>
      <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(74,222,128,.15)', border: '1px solid rgba(74,222,128,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><polyline points="3,12 10,19 21,6" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </div>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(74,222,128,.1)', border: '1px solid rgba(74,222,128,.3)', borderRadius: 20, padding: '4px 12px', fontSize: 12, color: '#4ade80', fontWeight: 500, marginBottom: '1rem' }}>
        +50 XP — conta criada!
      </div>
      <div style={{ fontSize: 17, fontWeight: 500, color: '#fff', marginBottom: 6 }}>Bem-vindo, {nomeUsuario}!</div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
        Você está no nível 1. Verifique seu e-mail para ativar a conta.
      </div>
      <button onClick={() => router.push('/dashboard')} style={{ width: '100%', padding: 13, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
        Ir para o app →
      </button>
    </div>
  )

  const Tabs = ({ size }: { size: 'sm' | 'lg' }) => (
    <div style={{ display: 'flex', background: 'rgba(0,0,0,.3)', border: '1px solid #1a3a1a', borderRadius: 8, padding: 3, marginBottom: size === 'lg' ? '1.5rem' : '1.25rem' }}>
      {(['login', 'cadastro'] as const).map(t => (
        <button key={t} onClick={() => { setTab(t); setErro(''); setEstado('form') }} style={{
          flex: 1, padding: size === 'lg' ? '8px' : '7px', textAlign: 'center',
          fontSize: size === 'lg' ? 13 : 12, fontWeight: 500,
          borderRadius: 6, cursor: 'pointer', border: 'none',
          background: tab === t ? '#16a34a' : 'transparent',
          color: tab === t ? '#fff' : 'rgba(255,255,255,.4)', transition: 'all .15s',
        }}>
          {t === 'login' ? 'Entrar' : 'Criar conta'}
        </button>
      ))}
    </div>
  )

  if (estado === 'aguardando_email') return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui', padding: '1.5rem' }}>
      <div style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>📧</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 8 }}>Confirme seu email</h2>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,.5)', marginBottom: 24, lineHeight: 1.6 }}>
          Enviamos um link para <strong style={{ color: '#4ade80' }}>{emailDigitado}</strong>.<br />
          Acesse e clique no link para ativar sua conta.
        </p>
        <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 12, padding: '1rem', marginBottom: 20, fontSize: 13, color: 'rgba(255,255,255,.5)', textAlign: 'left' }}>
          <div style={{ marginBottom: 8 }}>✉️ Verifique sua caixa de entrada</div>
          <div style={{ marginBottom: 8 }}>📁 Verifique também o spam</div>
          <div>⏱ O link expira em 24 horas</div>
        </div>
        <button onClick={() => { setEstado('form'); setTab('login') }} style={{ fontSize: 13, color: '#4ade80', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
          Voltar para o login
        </button>
      </div>
    </div>
  )

  // ── Mobile ──────────────────────────────────────────────────────────────
  if (isMobile) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: '#0a1a0a', borderBottom: '1px solid #1a3a1a', padding: '1.25rem 1.5rem' }}>
        <div style={{ marginBottom: 12 }}><PoupaUpLogo mode="full" /></div>
        <div style={{ fontSize: 18, fontWeight: 500, color: '#fff', lineHeight: 1.3, marginBottom: 10 }}>
          Seu dinheiro subindo de <span style={{ color: '#4ade80' }}>nível</span> todo mês.
        </div>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          {[['847', 'usuários'], ['R$ 2.4M', 'economizados'], ['4.9★', 'avaliação']].map(([val, lbl]) => (
            <div key={lbl}>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#4ade80' }}>{val}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)' }}>{lbl}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto' }}>
        <Tabs size="lg" />
        <Erros />
        {tab === 'login' && <FormLogin />}
        {tab === 'cadastro' && estado === 'form' && <FormCadastro />}
        {tab === 'cadastro' && estado === 'sucesso' && <Sucesso />}
      </div>
    </div>
  )

  // ── Desktop ──────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: '#0a1a0a', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '2.5rem' }}>
        <div><PoupaUpLogo mode="full" /></div>
        <div>
          <div style={{ fontSize: 28, fontWeight: 500, color: '#fff', lineHeight: 1.3, marginBottom: '1.5rem' }}>
            Seu dinheiro<br />subindo de <span style={{ color: '#4ade80' }}>nível</span><br />todo mês.
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
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,.65)', lineHeight: 1.4 }}>
                  <strong style={{ color: '#fff', fontWeight: 500 }}>{bold}</strong> {rest}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '2rem' }}>
          {[['847', 'usuários ativos'], ['R$ 2.4M', 'economizados'], ['4.9★', 'avaliação']].map(([val, lbl]) => (
            <div key={lbl}>
              <div style={{ fontSize: 18, fontWeight: 500, color: '#4ade80' }}>{val}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', marginTop: 1 }}>{lbl}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ background: '#0f1f0f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', borderLeft: '1px solid #1a3a1a' }}>
        <div style={{ width: '100%', maxWidth: 320 }}>
          <Tabs size="sm" />
          <Erros />
          {tab === 'login' && <FormLogin />}
          {tab === 'cadastro' && estado === 'form' && <FormCadastro />}
          {tab === 'cadastro' && estado === 'sucesso' && <Sucesso />}
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}