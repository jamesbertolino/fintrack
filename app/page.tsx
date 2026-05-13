'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import PoupaUpLogo from '@/components/PoupaUpLogo'

function BotaoAssinar({ plano, label, estilo = 'primario' }: { plano: string; label: string; estilo?: 'primario' | 'secundario' }) {
  const router = useRouter()
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  async function handleClick() {
    setCarregando(true)
    setErro('')
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push(`/login?next=%2Fsetup`)
        return
      }

      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plano }),
      })
      const text = await res.text()
      let data: { url?: string; error?: string } = {}
      try { data = JSON.parse(text) } catch { /* resposta não-JSON */ }
      if (data.url) {
        window.location.href = data.url
      } else {
        setErro(data.error || `Erro ${res.status} — verifique as configurações do Stripe`)
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro de conexão')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div style={{ marginTop: 24 }}>
      <button
        onClick={handleClick}
        disabled={carregando}
        style={{
          display: 'block', width: '100%',
          background: estilo === 'secundario' ? 'transparent' : (carregando ? '#15803d' : '#16a34a'),
          color: estilo === 'secundario' ? 'rgba(255,255,255,.5)' : '#fff',
          border: estilo === 'secundario' ? '1px solid rgba(255,255,255,.15)' : 'none',
          padding: estilo === 'secundario' ? '10px' : '12px',
          borderRadius: 10, textAlign: 'center', fontSize: estilo === 'secundario' ? 13 : 14,
          fontWeight: 600, transition: 'background .15s', cursor: carregando ? 'default' : 'pointer',
          opacity: carregando ? 0.8 : 1,
        }}
      >
        {carregando ? 'Aguarde...' : label}
      </button>
      {erro && (
        <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(248,113,113,.1)', border: '1px solid rgba(248,113,113,.3)', borderRadius: 8, fontSize: 12, color: '#f87171', textAlign: 'center' }}>
          {erro}
        </div>
      )}
    </div>
  )
}

export default function LandingPage() {
  const router = useRouter()
  const observerRef = useRef<IntersectionObserver | null>(null)
  const [toastContaExcluida, setToastContaExcluida] = useState(false)
  const [consentBanner, setConsentBanner] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!localStorage.getItem('lgpd_consent')) setConsentBanner(true)
  }, [])

  function aceitarConsent() {
    localStorage.setItem('lgpd_consent', new Date().toISOString())
    setConsentBanner(false)
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('conta') === 'excluida') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToastContaExcluida(true)
      setTimeout(() => setToastContaExcluida(false), 5000)
    }
  }, [])

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
          }
        })
      },
      { threshold: 0.1 }
    )

    document.querySelectorAll('.fade-in').forEach((el) => {
      observerRef.current?.observe(el)
    })

    return () => observerRef.current?.disconnect()
  }, [])

  return (
    <div style={{ background: '#0a0a0a', color: '#fff', fontFamily: 'system-ui, -apple-system, sans-serif', minHeight: '100vh' }}>

      <style>{`
        .fade-in { opacity: 0; transform: translateY(24px); transition: opacity .6s ease, transform .6s ease; }
        .fade-in.visible { opacity: 1; transform: translateY(0); }
        .hover-green:hover { background: #15803d !important; }
        .hover-outline:hover { background: rgba(74,222,128,.08) !important; border-color: #4ade80 !important; color: #4ade80 !important; }
        .nav-link { color: rgba(255,255,255,.55); text-decoration: none; font-size: 14px; transition: color .15s; }
        .nav-link:hover { color: #fff; }
        .card-feature:hover { border-color: rgba(74,222,128,.3) !important; transform: translateY(-2px); }
        .card-feature { transition: border-color .2s, transform .2s; }
        @media (max-width: 768px) {
          .hero-title { font-size: 36px !important; }
          .hero-btns { flex-direction: column !important; }
          .metrics { flex-wrap: wrap !important; }
          .steps-grid { grid-template-columns: 1fr !important; }
          .features-grid { grid-template-columns: 1fr !important; }
          .plans-grid { grid-template-columns: 1fr !important; }
          .nav-links { display: none !important; }
          .mock-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>

      {/* ── Banner de consentimento LGPD ── */}
      {consentBanner && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9998, background: '#0d1a0d', borderTop: '1px solid #1a3a1a', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, backdropFilter: 'blur(8px)' }}>
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,.6)', lineHeight: 1.5, maxWidth: 700 }}>
            Usamos cookies essenciais para o funcionamento do app e dados de acesso para segurança, conforme nossa{' '}
            <a href="/privacidade" style={{ color: '#4ade80', textDecoration: 'underline' }}>Política de Privacidade</a>{' '}
            (LGPD · Lei nº 13.709/2018). Não vendemos seus dados.
          </p>
          <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
            <a href="/privacidade" style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', textDecoration: 'none', padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,.1)' }}>
              Ver política
            </a>
            <button onClick={aceitarConsent} style={{ fontSize: 13, fontWeight: 600, color: '#0a0a0a', background: '#4ade80', border: 'none', borderRadius: 8, padding: '8px 20px', cursor: 'pointer' }}>
              Entendi e aceito
            </button>
          </div>
        </div>
      )}

      {/* Toast conta excluída */}
      {toastContaExcluida && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: '#111', border: '1px solid rgba(74,222,128,.3)', borderRadius: 10, padding: '12px 20px', fontSize: 13, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 4px 24px rgba(0,0,0,.5)', whiteSpace: 'nowrap' }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><polyline points="2,8 6,12 14,4" stroke="#4ade80" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Conta excluída com sucesso.
        </div>
      )}

      {/* ── HEADER ── */}
      <header style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: 'rgba(10,10,10,.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #1a2a1a' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 1.5rem', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <PoupaUpLogo mode="compact" />
          <nav className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
            <a href="#funcionalidades" className="nav-link">Funcionalidades</a>
            <a href="#precos" className="nav-link">Preços</a>
            <a href="/login" className="nav-link">Entrar</a>
          </nav>
          <a href="/login" style={{ background: '#16a34a', color: '#fff', padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none', transition: 'background .15s' }} className="hover-green">
            Começar grátis
          </a>
        </div>
      </header>

      {/* ── HERO ── */}
      <section style={{ paddingTop: 120, paddingBottom: 80, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        {/* Glow background */}
        <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translate(-50%,-50%)', width: 600, height: 400, background: 'radial-gradient(ellipse, rgba(74,222,128,.07) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 1.5rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(74,222,128,.1)', border: '1px solid rgba(74,222,128,.25)', borderRadius: 20, padding: '5px 14px', fontSize: 12, color: '#4ade80', fontWeight: 500, marginBottom: 32 }}>
            🚀 Novo · Controle financeiro com IA
          </div>

          <h1 className="hero-title" style={{ fontSize: 56, fontWeight: 800, lineHeight: 1.15, letterSpacing: -1.5, marginBottom: 24, margin: '0 auto 24px' }}>
            Poupar mais.<br />
            <span style={{ color: '#4ade80' }}>Evolua sempre.</span><br />
            Conquiste seus sonhos.
          </h1>

          <p style={{ fontSize: 18, color: 'rgba(255,255,255,.55)', lineHeight: 1.7, maxWidth: 580, margin: '0 auto 40px' }}>
            O único app financeiro que você controla pelo WhatsApp, com IA que entende sua vida e gamificação que te mantém motivado.
          </p>

          <div className="hero-btns" style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 48 }}>
            <a href="/login" style={{ background: '#16a34a', color: '#fff', padding: '14px 28px', borderRadius: 10, fontSize: 15, fontWeight: 700, textDecoration: 'none', transition: 'background .15s' }} className="hover-green">
              Começar grátis
            </a>
            <a href="#como-funciona" style={{ background: 'transparent', color: 'rgba(255,255,255,.7)', padding: '14px 28px', borderRadius: 10, fontSize: 15, fontWeight: 500, textDecoration: 'none', border: '1px solid rgba(255,255,255,.15)', transition: 'all .15s' }} className="hover-outline">
              Ver como funciona
            </a>
          </div>

          {/* Métricas */}
          <div className="metrics" style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            {['100% via WhatsApp', 'IA Integrada', 'Família conectada', 'Gamificado'].map((m) => (
              <div key={m} style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 20, padding: '5px 14px', fontSize: 12, color: 'rgba(255,255,255,.5)' }}>
                {m}
              </div>
            ))}
          </div>
        </div>

        {/* Mock dashboard */}
        <div className="fade-in" style={{ maxWidth: 720, margin: '56px auto 0', padding: '0 1.5rem' }}>
          <div style={{ background: '#0a1a0a', border: '1px solid #1a3a1a', borderRadius: 16, padding: '1.25rem', boxShadow: '0 32px 80px rgba(0,0,0,.6), 0 0 0 1px rgba(74,222,128,.05)' }}>
            {/* Topbar mock */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid #1a3a1a' }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,.7)' }}>Dashboard · Início</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80' }} />
                <span style={{ fontSize: 10, color: '#4ade80' }}>webhook ativo</span>
              </div>
            </div>
            {/* Cards mock */}
            <div className="mock-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: '1rem' }}>
              {[
                { label: 'Saldo', val: 'R$ 3.280', cor: '#4ade80' },
                { label: 'Receitas', val: 'R$ 8.500', cor: '#4ade80' },
                { label: 'Gastos', val: 'R$ 5.220', cor: '#f87171' },
                { label: 'XP total', val: '1.840 XP', cor: '#fbbf24' },
              ].map((c) => (
                <div key={c.label} style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,.35)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>{c.label}</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: c.cor }}>{c.val}</div>
                </div>
              ))}
            </div>
            {/* Progress bar nivel */}
            <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: '#4ade80' }}>Nível 2 · Poupador</span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,.3)' }}>840 / 1000 XP</span>
              </div>
              <div style={{ height: 5, background: 'rgba(255,255,255,.06)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: '84%', background: 'linear-gradient(90deg, #16a34a, #4ade80)', borderRadius: 3 }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── COMO FUNCIONA ── */}
      <section id="como-funciona" style={{ padding: '80px 1.5rem', maxWidth: 1100, margin: '0 auto' }}>
        <div className="fade-in" style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 12 }}>Como funciona</div>
          <h2 style={{ fontSize: 36, fontWeight: 700, letterSpacing: -0.5, margin: 0 }}>3 passos para transformar suas finanças</h2>
        </div>
        <div className="steps-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
          {[
            { num: '01', emoji: '📱', titulo: 'Conecte seu WhatsApp', desc: 'Escaneie um QR Code e pronto. Seu número vira seu controle financeiro.' },
            { num: '02', emoji: '💬', titulo: 'Lance pelo WhatsApp', desc: 'Mande "mercado - R$150" e o PoupaUp lança, categoriza e responde na hora.' },
            { num: '03', emoji: '📊', titulo: 'Acompanhe e evolua', desc: 'Dashboard completo, metas, níveis e conquistas para te manter motivado.' },
          ].map((s) => (
            <div key={s.num} className="fade-in card-feature" style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 16, padding: '1.75rem' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#4ade80', marginBottom: 16, fontVariantNumeric: 'tabular-nums' }}>{s.num}</div>
              <div style={{ fontSize: 36, marginBottom: 14 }}>{s.emoji}</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{s.titulo}</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,.45)', lineHeight: 1.6 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FUNCIONALIDADES ── */}
      <section id="funcionalidades" style={{ padding: '80px 1.5rem', maxWidth: 1100, margin: '0 auto' }}>
        <div className="fade-in" style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 12 }}>Funcionalidades</div>
          <h2 style={{ fontSize: 36, fontWeight: 700, letterSpacing: -0.5, margin: 0 }}>Tudo que você precisa, simples assim</h2>
        </div>
        <div className="features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          {[
            { emoji: '🤖', titulo: 'IA que entende tudo',    desc: 'PoupaBot analisa seus gastos e sugere onde você pode economizar mais.' },
            { emoji: '👨‍👩‍👧', titulo: 'Grupo familiar',        desc: 'Marido e esposa controlam juntos pelo mesmo grupo WhatsApp.' },
            { emoji: '🎮', titulo: 'Gamificação',            desc: 'Níveis, XP e conquistas para tornar o ato de poupar divertido.' },
            { emoji: '📱', titulo: '100% WhatsApp',          desc: 'Lance gastos em segundos sem precisar abrir nenhum aplicativo.' },
            { emoji: '🎯', titulo: 'Metas inteligentes',     desc: 'Previsão dinâmica de quando você vai atingir cada objetivo.' },
            { emoji: '🔔', titulo: 'Alertas automáticos',    desc: 'Receba avisos no WhatsApp quando ultrapassar seus limites.' },
          ].map((f) => (
            <div key={f.titulo} className="fade-in card-feature" style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 14, padding: '1.5rem' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>{f.emoji}</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{f.titulo}</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,.45)', lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── PLANOS ── */}
      <section id="precos" style={{ padding: '80px 1.5rem', maxWidth: 900, margin: '0 auto' }}>
        <div className="fade-in" style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 12 }}>Planos</div>
          <h2 style={{ fontSize: 36, fontWeight: 700, letterSpacing: -0.5, margin: '0 0 12px' }}>Simples e transparente</h2>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,.4)', margin: 0 }}>Comece grátis, evolua quando quiser.</p>
        </div>
        <div className="plans-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

          {/* Free */}
          <div className="fade-in" style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 16, padding: '1.75rem' }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Free</div>
            <div style={{ fontSize: 40, fontWeight: 800, color: '#4ade80', marginBottom: 4 }}>R$ 0<span style={{ fontSize: 15, fontWeight: 400, color: 'rgba(255,255,255,.3)' }}>/mês</span></div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', marginBottom: 24 }}>Para sempre, sem cartão</div>
            {['Dashboard completo', 'PoupaBot básico', '5 metas', 'Lançamentos via WhatsApp', 'Alertas automáticos'].map((f) => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10, fontSize: 13, color: 'rgba(255,255,255,.65)' }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><polyline points="1.5,7 5,10.5 12.5,3" stroke="#4ade80" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                {f}
              </div>
            ))}
            <a href="/login" style={{ display: 'block', marginTop: 24, background: 'rgba(22,163,74,.15)', color: '#4ade80', padding: '12px', borderRadius: 10, textAlign: 'center', fontSize: 14, fontWeight: 600, textDecoration: 'none', border: '1px solid rgba(74,222,128,.2)', transition: 'background .15s' }} className="hover-green">
              Começar grátis
            </a>
          </div>

          {/* Pro */}
          <div className="fade-in" style={{ background: 'rgba(74,222,128,.04)', border: '1px solid rgba(74,222,128,.3)', borderRadius: 16, padding: '1.75rem', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 16, right: 16, background: '#4ade80', color: '#0a0a0a', fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 10, textTransform: 'uppercase', letterSpacing: '.05em' }}>Mais popular</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Pro ⭐</div>
            <div style={{ fontSize: 40, fontWeight: 800, color: '#4ade80', marginBottom: 4 }}>R$ 27<span style={{ fontSize: 15, fontWeight: 400, color: 'rgba(255,255,255,.3)' }}>/mês</span></div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', marginBottom: 4 }}>Cobrado mensalmente · cancele quando quiser</div>
            <div style={{ fontSize: 11, color: '#4ade80', marginBottom: 20, opacity: .8 }}>ou R$ 197/ano <span style={{ color: 'rgba(255,255,255,.3)' }}>(economize R$ 127)</span></div>
            {['Tudo do Free', 'Grupo familiar (membros ilimitados)', 'PoupaBot avançado (IA sem limites)', 'Relatórios em PDF', 'Suporte prioritário', 'Multibancos (em breve)'].map((f) => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10, fontSize: 13, color: 'rgba(255,255,255,.65)' }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><polyline points="1.5,7 5,10.5 12.5,3" stroke="#4ade80" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                {f}
              </div>
            ))}
            <BotaoAssinar plano="pro_mensal" label="Assinar Pro — R$ 27/mês →" />
            <BotaoAssinar plano="pro_anual" label="Assinar anual — R$ 197/ano →" estilo="secundario" />
            <div style={{ textAlign: 'center', marginTop: 10, fontSize: 11, color: 'rgba(255,255,255,.25)' }}>
              🔒 Pagamento seguro via Stripe
            </div>
          </div>

        </div>
      </section>

      {/* ── DEPOIMENTO ── */}
      <section style={{ padding: '80px 1.5rem', maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
        <div className="fade-in" style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 20, padding: '2rem 2.5rem', position: 'relative' }}>
          <div style={{ fontSize: 48, color: 'rgba(74,222,128,.3)', fontFamily: 'Georgia, serif', lineHeight: 1, marginBottom: 16, marginTop: -8 }}>&quot;</div>
          <p style={{ fontSize: 18, lineHeight: 1.7, color: 'rgba(255,255,255,.8)', fontStyle: 'italic', margin: '0 0 24px' }}>
            Lancei meu salário no WhatsApp e em 2 segundos já estava no app. Nunca foi tão fácil controlar meu dinheiro.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #4ade80, #16a34a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#0a0a0a' }}>J</div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>James B.</div>
              <div style={{ fontSize: 11, color: '#4ade80' }}>Fundador e primeiro usuário</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section style={{ padding: '80px 1.5rem', textAlign: 'center', background: 'linear-gradient(135deg, #0a1a0a, #0a0a0a)', borderTop: '1px solid #1a3a1a', borderBottom: '1px solid #1a3a1a' }}>
        <div className="fade-in" style={{ maxWidth: 600, margin: '0 auto' }}>
          <h2 style={{ fontSize: 36, fontWeight: 700, letterSpacing: -0.5, marginBottom: 16 }}>
            Pronto para transformar sua<br /><span style={{ color: '#4ade80' }}>relação com o dinheiro?</span>
          </h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,.45)', marginBottom: 32 }}>
            Crie sua conta grátis em menos de 1 minuto.
          </p>
          <a href="/login" onClick={(e) => { e.preventDefault(); router.push('/login') }} style={{ display: 'inline-block', background: '#16a34a', color: '#fff', padding: '16px 40px', borderRadius: 12, fontSize: 16, fontWeight: 700, textDecoration: 'none', boxShadow: '0 8px 32px rgba(22,163,74,.3)', transition: 'background .15s' }} className="hover-green">
            Criar conta grátis →
          </a>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: '1px solid #1a2a1a', padding: '2.5rem 1.5rem', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24, marginBottom: 20 }}>
          <div>
            <PoupaUpLogo mode="compact" />
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.25)', marginTop: 8 }}>Poupar. Evoluir. Conquistar.</div>
          </div>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
            <a href="/login" style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', textDecoration: 'none' }} className="nav-link">Entrar</a>
            <a href="/login" style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', textDecoration: 'none' }} className="nav-link">Cadastrar</a>
            <a href="/privacidade" style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', textDecoration: 'none' }} className="nav-link">Privacidade</a>
            <a href="/privacidade#termos" style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', textDecoration: 'none' }} className="nav-link">Termos de Uso</a>
            <a href="mailto:privacidade@poupaup.com.br" style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', textDecoration: 'none' }} className="nav-link">Contato</a>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,.05)' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.18)' }}>© 2026 PoupaUp. Todos os direitos reservados.</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.18)', display: 'flex', gap: 16 }}>
            <span>🔒 Dados protegidos pela LGPD</span>
            <span>🇧🇷 Feito no Brasil</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
