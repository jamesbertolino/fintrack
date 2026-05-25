'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import PoupaUpLogo from '@/components/PoupaUpLogo'
import { useCores, useTema } from '@/components/ThemeProvider'

function GoogleSVG() {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18" style={{ flexShrink: 0 }}>
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}

function EyeSVG() {
  return (
    <svg width="18" height="18" viewBox="0 0 14 14" fill="none">
      <path d="M1 7s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z" stroke="currentColor" strokeWidth="1.2"/>
      <circle cx="7" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  )
}

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const cores = useCores()
  const { tema } = useTema()
  const isClaro = tema === 'claro'

  const [tab, setTab] = useState<'login' | 'cadastro'>('login')
  const [estado, setEstado] = useState<'form' | 'sucesso' | 'aguardando_email'>('form')
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [nomeUsuario, setNomeUsuario] = useState('')
  const [emailDigitado, setEmailDigitado] = useState('')
  const [erro, setErro] = useState('')

  const [loginForm, setLoginForm] = useState({ email: '', senha: '' })
  const [cadForm, setCadForm] = useState({ nome: '', email: '', senha: '' })
  const [lgpdAceito, setLgpdAceito] = useState(false)
  const [forca, setForca] = useState({ pct: 0, cor: '', label: '' })

  const erroParam = searchParams.get('erro')
  const refParam  = searchParams.get('ref') || (typeof window !== 'undefined' ? sessionStorage.getItem('ref') : null) || ''

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
    if (!lgpdAceito) { setErro('Você precisa aceitar a Política de Privacidade para criar uma conta.'); return }
    setLoading(true)
    const { data, error } = await supabase.auth.signUp({
      email: cadForm.email,
      password: cadForm.senha,
      options: {
        data: { nome: cadForm.nome },
        emailRedirectTo: `${window.location.origin}${searchParams.get('next') || '/dashboard'}`,
      },
    })
    setLoading(false)
    if (error) { setErro(error.message); return }

    if (data.user) {
      await supabase.from('profiles').upsert({
        id:             data.user.id,
        nome:           cadForm.nome.split(' ')[0],
        sobrenome:      cadForm.nome.split(' ').slice(1).join(' '),
        plano:          'free',
        lgpd_aceito_em: new Date().toISOString(),
        ...(refParam ? { referido_por: refParam } : {}),
      })
      fetch('/api/email/boas-vindas', { method: 'POST' }).catch(() => null)
      if (refParam) {
        fetch('/api/referral/bonus', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ referrer_id: refParam }),
        }).catch(() => null)
        sessionStorage.removeItem('ref')
      }
    }

    if (data.user && !data.user.email_confirmed_at) {
      setEstado('aguardando_email')
      return
    }

    setNomeUsuario(cadForm.nome.split(' ')[0])
    setEstado('sucesso')
  }

  async function loginGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  // ── Tela: aguardando confirmação de email ─────────────────────────────────
  if (estado === 'aguardando_email') return (
    <div className="login-root">
      <style>{loginStyles(cores, isClaro)}</style>
      <div className="login-form-col">
        <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📧</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: cores.text, margin: '0 0 8px' }}>Confirme seu email</h2>
          <p style={{ fontSize: 14, color: cores.textMuted, lineHeight: 1.65, margin: '0 0 20px' }}>
            Enviamos um link para <strong style={{ color: '#4ade80' }}>{emailDigitado}</strong>.
            <br />Clique no link para ativar sua conta.
          </p>
          <div className="login-info-box">
            <div>✉️ Verifique sua caixa de entrada</div>
            <div>📁 Verifique também o spam</div>
            <div>⏱ O link expira em 24 horas</div>
          </div>
          <button onClick={() => { setEstado('form'); setTab('login') }} className="login-link-btn">
            Voltar para o login
          </button>
        </div>
      </div>
    </div>
  )

  // ── Formulário compartilhado ──────────────────────────────────────────────
  const formulario = (
    <>
      {/* Abas Login / Cadastro */}
      <div className="login-tabs">
        {(['login', 'cadastro'] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); setErro(''); setEstado('form') }}
            className={`login-tab ${tab === t ? 'login-tab-active' : ''}`}>
            {t === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        ))}
      </div>

      {/* Alertas */}
      {erroParam === 'email_nao_confirmado' && (
        <div className="login-alert login-alert-warn">⚠️ Confirme seu email antes de entrar. Verifique sua caixa de entrada.</div>
      )}
      {erro && <div className="login-alert login-alert-err">{erro}</div>}

      {/* ── LOGIN ── */}
      {tab === 'login' && (
        <form onSubmit={handleLogin}>
          <p className="login-sub">Bem-vindo de volta 👋</p>

          <button type="button" onClick={loginGoogle} className="login-google-btn">
            <GoogleSVG />
            <span style={{ pointerEvents: 'none' }}>Continuar com Google</span>
          </button>

          <div className="login-divider"><span>ou</span></div>

          <div className="login-field">
            <label className="login-label">E-mail</label>
            <input type="email" placeholder="seu@email.com"
              value={loginForm.email}
              onChange={e => setLoginForm(p => ({ ...p, email: e.target.value }))}
              required className="login-input" />
          </div>

          <div className="login-field">
            <label className="login-label">Senha</label>
            <div style={{ position: 'relative' }}>
              <input type={showPw ? 'text' : 'password'} placeholder="••••••••"
                value={loginForm.senha}
                onChange={e => setLoginForm(p => ({ ...p, senha: e.target.value }))}
                required className="login-input" style={{ paddingRight: 48 }} />
              <button type="button" onClick={() => setShowPw(!showPw)} className="login-eye-btn"
                style={{ color: showPw ? '#4ade80' : cores.textFaint }}>
                <EyeSVG />
              </button>
            </div>
          </div>

          <div style={{ textAlign: 'right', marginBottom: 20 }}>
            <button type="button" className="login-link-btn">Esqueci minha senha</button>
          </div>

          <button type="submit" disabled={loading} className="login-submit-btn">
            {loading ? 'Entrando...' : 'Entrar →'}
          </button>
        </form>
      )}

      {/* ── CADASTRO ── */}
      {tab === 'cadastro' && estado === 'form' && (
        <form onSubmit={handleCadastro}>
          <p className="login-sub">7 dias grátis no plano Pro 🎉</p>

          <button type="button" onClick={loginGoogle} className="login-google-btn">
            <GoogleSVG />
            <span style={{ pointerEvents: 'none' }}>Continuar com Google</span>
          </button>

          <div className="login-divider"><span>ou</span></div>

          {[
            { label: 'Nome',   key: 'nome',  type: 'text',  ph: 'Seu nome completo' },
            { label: 'E-mail', key: 'email', type: 'email', ph: 'seu@email.com' },
          ].map(({ label, key, type, ph }) => (
            <div className="login-field" key={key}>
              <label className="login-label">{label}</label>
              <input type={type} placeholder={ph}
                value={cadForm[key as keyof typeof cadForm]}
                onChange={e => {
                  setCadForm(p => ({ ...p, [key]: e.target.value }))
                  if (key === 'email') setEmailDigitado(e.target.value)
                }}
                required className="login-input" />
            </div>
          ))}

          <div className="login-field">
            <label className="login-label">Senha</label>
            <div style={{ position: 'relative' }}>
              <input type={showPw ? 'text' : 'password'} placeholder="mín. 8 caracteres"
                value={cadForm.senha}
                onChange={e => { setCadForm(p => ({ ...p, senha: e.target.value })); calcularForca(e.target.value) }}
                required className="login-input" style={{ paddingRight: 48 }} />
              <button type="button" onClick={() => setShowPw(!showPw)} className="login-eye-btn"
                style={{ color: showPw ? '#4ade80' : cores.textFaint }}>
                <EyeSVG />
              </button>
            </div>
            {cadForm.senha && (
              <>
                <div style={{ height: 4, borderRadius: 2, marginTop: 6, background: cores.border, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 2, width: `${forca.pct}%`, background: forca.cor, transition: 'all .3s' }} />
                </div>
                <div style={{ fontSize: 11, marginTop: 4, color: forca.cor, fontWeight: 500 }}>{forca.label}</div>
              </>
            )}
          </div>

          <label className="login-lgpd">
            <input type="checkbox" checked={lgpdAceito} onChange={e => setLgpdAceito(e.target.checked)}
              style={{ accentColor: '#4ade80', flexShrink: 0, width: 18, height: 18 }} />
            <span>
              Li e concordo com a{' '}
              <Link href="/privacidade" target="_blank" style={{ color: '#4ade80' }}>Política de Privacidade</Link>
              {' '}e os{' '}
              <Link href="/privacidade#termos" target="_blank" style={{ color: '#4ade80' }}>Termos de Uso</Link>
            </span>
          </label>

          <button type="submit" disabled={loading || !lgpdAceito} className="login-submit-btn"
            style={{ opacity: (loading || !lgpdAceito) ? 0.5 : 1 }}>
            {loading ? 'Criando conta...' : 'Criar conta grátis →'}
          </button>
        </form>
      )}

      {/* ── SUCESSO ── */}
      {tab === 'cadastro' && estado === 'sucesso' && (
        <div style={{ textAlign: 'center', padding: '1rem 0' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(74,222,128,0.15)', border: '2px solid rgba(74,222,128,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <polyline points="3,12 10,19 21,6" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 20, padding: '5px 14px', fontSize: 12, color: '#4ade80', fontWeight: 600, marginBottom: 12 }}>
            +50 XP — conta criada!
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: cores.text, marginBottom: 6 }}>Bem-vindo, {nomeUsuario}!</div>
          <div style={{ fontSize: 14, color: cores.textMuted, marginBottom: 24, lineHeight: 1.65 }}>
            Você está no nível 1. Verifique seu e-mail para ativar a conta.
          </div>
          <button onClick={() => router.push('/dashboard')} className="login-submit-btn">
            Ir para o app →
          </button>
        </div>
      )}
    </>
  )

  // ── Layout principal ──────────────────────────────────────────────────────
  return (
    <>
      <style>{loginStyles(cores, isClaro)}</style>

      <div className="login-root">

        {/* Coluna esquerda: hero (só desktop) */}
        <div className="login-hero">
          <div className="login-hero-inner">
            <PoupaUpLogo mode="full" />
            <p className="login-hero-tagline">
              Seu dinheiro<br />subindo de <em>nível</em><br />todo mês.
            </p>
            <div className="login-hero-stats">
              {[['847+', 'usuários'], ['R$ 2.4M', 'economizados'], ['4.9★', 'avaliação']].map(([v, l]) => (
                <div key={l} className="login-stat">
                  <span className="login-stat-val">{v}</span>
                  <span className="login-stat-lbl">{l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Coluna direita: formulário (mobile: tela inteira) */}
        <div className="login-form-col">
          {/* Logo só aparece no mobile */}
          <div className="login-mobile-logo">
            <PoupaUpLogo mode="full" />
          </div>
          {formulario}
        </div>

      </div>
    </>
  )
}

// ── Estilos ───────────────────────────────────────────────────────────────
function loginStyles(cores: ReturnType<typeof useCores>, isClaro: boolean) {
  const accentBg = isClaro ? '#2563EB' : '#16a34a'
  return `
    * { box-sizing: border-box; }

    /* ── ROOT: mobile = coluna única ── */
    .login-root {
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      font-family: system-ui, -apple-system, sans-serif;
      background: ${cores.surface};
    }

    /* Hero oculto no mobile */
    .login-hero { display: none; }

    /* Logo mobile */
    .login-mobile-logo {
      display: flex;
      justify-content: center;
      padding: 2.5rem 0 1.75rem;
    }

    /* Coluna do form: ocupa tudo no mobile */
    .login-form-col {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 0 1.5rem 2.5rem;
      padding-bottom: calc(2.5rem + env(safe-area-inset-bottom, 0px));
      max-width: 480px;
      width: 100%;
      margin: 0 auto;
    }

    /* ── TABS ── */
    .login-tabs {
      display: flex;
      background: ${cores.surfaceDark};
      border: 1px solid ${cores.borderMid};
      border-radius: 12px;
      padding: 3px;
      margin-bottom: 1.5rem;
    }
    .login-tab {
      flex: 1;
      padding: 13px;
      font-size: 15px;
      font-weight: 600;
      border-radius: 10px;
      border: none;
      background: transparent;
      color: ${cores.textMuted};
      cursor: pointer;
      transition: all .15s;
    }
    .login-tab-active {
      background: ${accentBg};
      color: #fff;
    }

    /* ── INPUTS ── */
    .login-field { margin-bottom: 14px; }
    .login-label {
      display: block;
      font-size: 11px;
      font-weight: 600;
      color: ${cores.textMuted};
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: .06em;
    }
    .login-input {
      width: 100%;
      font-size: 16px;
      padding: 15px 16px;
      min-height: 54px;
      border-radius: 12px;
      border: 1.5px solid ${cores.inputBorder};
      background: ${cores.inputBg};
      color: ${cores.text};
      outline: none;
      transition: border-color .15s;
    }
    .login-input:focus { border-color: #4ade80; }
    .login-eye-btn {
      position: absolute;
      right: 14px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      cursor: pointer;
      padding: 8px;
      min-width: 44px;
      min-height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* ── GOOGLE BUTTON ── */
    .login-google-btn {
      width: 100%;
      padding: 15px;
      margin-bottom: 16px;
      background: #fff;
      border: 1.5px solid #e5e7eb;
      border-radius: 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      font-size: 16px;
      font-weight: 600;
      color: #374151;
      min-height: 54px;
    }

    /* ── DIVIDER ── */
    .login-divider {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
      color: ${cores.textFaint};
      font-size: 12px;
    }
    .login-divider::before,
    .login-divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: ${cores.borderMid};
    }

    /* ── SUBMIT BUTTON ── */
    .login-submit-btn {
      width: 100%;
      padding: 17px;
      background: #16a34a;
      color: #fff;
      border: none;
      border-radius: 14px;
      font-size: 17px;
      font-weight: 700;
      cursor: pointer;
      min-height: 58px;
      letter-spacing: -.01em;
      transition: opacity .15s;
    }

    /* ── ALERTS ── */
    .login-alert {
      border-radius: 10px;
      padding: 10px 14px;
      font-size: 13px;
      margin-bottom: 12px;
      line-height: 1.5;
    }
    .login-alert-warn {
      background: rgba(234,179,8,0.1);
      border: 1px solid rgba(234,179,8,0.3);
      color: #fde047;
    }
    .login-alert-err {
      background: rgba(239,68,68,0.1);
      border: 1px solid rgba(239,68,68,0.3);
      color: #f87171;
    }

    /* ── MISC ── */
    .login-link-btn {
      font-size: 13px;
      color: #4ade80;
      background: none;
      border: none;
      cursor: pointer;
      padding: 10px 4px;
      min-height: 44px;
      text-decoration: underline;
    }
    .login-sub {
      font-size: 15px;
      color: ${cores.textMuted};
      margin: 0 0 18px;
      font-weight: 500;
    }
    .login-lgpd {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      margin-bottom: 20px;
      cursor: pointer;
      font-size: 12px;
      color: ${cores.textMuted};
      line-height: 1.65;
    }
    .login-info-box {
      background: ${cores.surfaceDark};
      border: 1px solid ${cores.border};
      border-radius: 12px;
      padding: 14px 16px;
      margin-bottom: 20px;
      font-size: 13px;
      color: ${cores.textMuted};
      text-align: left;
      display: flex;
      flex-direction: column;
      gap: 8px;
      line-height: 1.5;
    }

    /* ── DESKTOP (≥768px): duas colunas ── */
    @media (min-width: 768px) {
      .login-root {
        flex-direction: row;
        background: #071a07;
      }

      /* Hero: coluna esquerda */
      .login-hero {
        display: flex;
        flex: 1;
        background: linear-gradient(160deg, #0d2e0d 0%, #071a07 60%, #030f03 100%);
        padding: 3rem;
        min-height: 100dvh;
        align-items: center;
        justify-content: center;
        position: relative;
        overflow: hidden;
      }
      .login-hero::before {
        content: '';
        position: absolute;
        top: -60px; left: -60px;
        width: 280px; height: 280px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(74,222,128,.12) 0%, transparent 70%);
        pointer-events: none;
      }
      .login-hero-inner {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 1.25rem;
        max-width: 380px;
        position: relative;
        z-index: 1;
      }
      .login-hero-tagline {
        font-size: 36px;
        font-weight: 700;
        color: #fff;
        line-height: 1.3;
        margin: 0;
        letter-spacing: -.02em;
      }
      .login-hero-tagline em { font-style: normal; color: #4ade80; }
      .login-hero-stats {
        display: flex;
        gap: 1.75rem;
        padding-top: 0.25rem;
      }
      .login-stat { display: flex; flex-direction: column; align-items: center; gap: 2px; }
      .login-stat-val { font-size: 16px; font-weight: 700; color: #4ade80; }
      .login-stat-lbl { font-size: 10px; color: rgba(255,255,255,.4); text-transform: uppercase; letter-spacing: .05em; }

      /* Form: coluna direita */
      .login-mobile-logo { display: none; }
      .login-form-col {
        flex: none;
        width: 440px;
        min-height: 100dvh;
        padding: 0 3rem;
        justify-content: center;
        border-left: 1px solid ${cores.border};
        background: ${cores.surface};
        margin: 0;
        max-width: none;
        overflow-y: auto;
      }
    }
  `
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
