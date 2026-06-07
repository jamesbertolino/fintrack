'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import PoupaUpLogo from '@/components/PoupaUpLogo'

// ── Botão assinar ──────────────────────────────────────────────────────────────
function BotaoAssinar({ plano, label, estilo = 'primario' }: { plano: string; label: string; estilo?: 'primario' | 'secundario' }) {
  const router = useRouter()
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  async function handleClick() {
    setCarregando(true); setErro('')
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push(`/login?next=%2Fsetup`); return }
      const res = await fetch('/api/stripe/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plano }) })
      const text = await res.text()
      let data: { url?: string; error?: string } = {}
      try { data = JSON.parse(text) } catch { /* não-JSON */ }
      if (data.url) window.location.href = data.url
      else setErro(data.error || `Erro ${res.status}`)
    } catch (e) { setErro(e instanceof Error ? e.message : 'Erro de conexão') }
    finally { setCarregando(false) }
  }

  return (
    <div style={{ marginTop: 24 }}>
      <button onClick={handleClick} disabled={carregando} style={{ display: 'block', width: '100%', background: estilo === 'secundario' ? 'transparent' : (carregando ? '#15803d' : '#16a34a'), color: estilo === 'secundario' ? 'rgba(255,255,255,.5)' : '#fff', border: estilo === 'secundario' ? '1px solid rgba(255,255,255,.15)' : 'none', padding: estilo === 'secundario' ? '10px' : '12px', borderRadius: 10, textAlign: 'center', fontSize: estilo === 'secundario' ? 13 : 14, fontWeight: 600, cursor: carregando ? 'default' : 'pointer', opacity: carregando ? 0.8 : 1 }}>
        {carregando ? 'Aguarde...' : label}
      </button>
      {erro && <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(248,113,113,.1)', border: '1px solid rgba(248,113,113,.3)', borderRadius: 8, fontSize: 12, color: '#f87171', textAlign: 'center' }}>{erro}</div>}
    </div>
  )
}

// ── Gráfico antes/depois animado ──────────────────────────────────────────────
function GraficoAntesDepois({ visivel }: { visivel: boolean }) {
  const W = 560, H = 220, PAD = { t: 20, r: 20, b: 40, l: 52 }
  const cw = W - PAD.l - PAD.r
  const ch = H - PAD.t - PAD.b

  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago']
  const antes  = [200,  150,  180,  120,  100,  80,   110,  60]   // poupança caindo
  const depois = [200,  480,  820, 1240, 1750, 2380, 3050, 3800]  // crescendo

  const maxVal = Math.max(...depois)
  const minVal = 0

  function xPos(i: number) { return PAD.l + (i / (meses.length - 1)) * cw }
  function yPos(v: number) { return PAD.t + ch - ((v - minVal) / (maxVal - minVal)) * ch }

  function polyline(data: number[]) {
    return data.map((v, i) => `${xPos(i)},${yPos(v)}`).join(' ')
  }
  function pathD(data: number[]) {
    return data.map((v, i) => `${i === 0 ? 'M' : 'L'}${xPos(i)},${yPos(v)}`).join(' ')
  }
  function areaD(data: number[]) {
    const pts = data.map((v, i) => `${i === 0 ? 'M' : 'L'}${xPos(i)},${yPos(v)}`).join(' ')
    return `${pts} L${xPos(data.length - 1)},${PAD.t + ch} L${PAD.l},${PAD.t + ch} Z`
  }

  // Calcular comprimento aproximado do path para dash animation
  const depoisLen = 1200

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: W }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', overflow: 'visible' }}>
        {/* Linhas de grade */}
        {[0, 0.25, 0.5, 0.75, 1].map(pct => {
          const y = PAD.t + ch * (1 - pct)
          const val = Math.round(minVal + (maxVal - minVal) * pct)
          return (
            <g key={pct}>
              <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke="rgba(255,255,255,.06)" strokeWidth="1" />
              <text x={PAD.l - 8} y={y + 4} textAnchor="end" fontSize="9" fill="rgba(255,255,255,.3)">
                {val >= 1000 ? `R$${(val / 1000).toFixed(0)}k` : val === 0 ? 'R$0' : `R$${val}`}
              </text>
            </g>
          )
        })}

        {/* Labels meses */}
        {meses.map((m, i) => (
          <text key={m} x={xPos(i)} y={H - 8} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,.3)">{m}</text>
        ))}

        {/* Área verde depois (animada) */}
        <path d={areaD(depois)} fill="rgba(74,222,128,.06)"
          style={{ opacity: visivel ? 1 : 0, transition: 'opacity 1s ease 0.5s' }} />

        {/* Linha "antes" */}
        <polyline points={polyline(antes)} fill="none" stroke="rgba(248,113,113,.5)" strokeWidth="2" strokeDasharray="5 4"
          style={{ opacity: visivel ? 1 : 0, transition: 'opacity .8s ease 0.2s' }} />

        {/* Linha "depois" — animação de desenho */}
        <path d={pathD(depois)} fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray={depoisLen}
          strokeDashoffset={visivel ? 0 : depoisLen}
          style={{ transition: visivel ? 'stroke-dashoffset 1.4s cubic-bezier(.4,0,.2,1) 0.3s' : 'none' }} />

        {/* Pontos nos marcos da linha depois */}
        {depois.map((v, i) => (
          <circle key={i} cx={xPos(i)} cy={yPos(v)} r="4" fill="#4ade80"
            style={{ opacity: visivel ? 1 : 0, transition: `opacity .3s ease ${0.3 + i * 0.15}s` }} />
        ))}

        {/* Último valor destacado */}
        {visivel && (
          <g>
            <rect x={xPos(7) - 38} y={yPos(depois[7]) - 22} width={76} height={18} rx={5} fill="rgba(74,222,128,.15)" stroke="rgba(74,222,128,.4)" strokeWidth="1" />
            <text x={xPos(7)} y={yPos(depois[7]) - 9} textAnchor="middle" fontSize="10" fill="#4ade80" fontWeight="700">R$ 3.800 poupados</text>
          </g>
        )}

        {/* Label "Sem controle" */}
        {visivel && (
          <text x={xPos(3) + 8} y={yPos(antes[3]) - 8} fontSize="9" fill="rgba(248,113,113,.7)">Sem controle</text>
        )}
      </svg>

      {/* Legenda */}
      <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'rgba(255,255,255,.5)' }}>
          <svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke="#4ade80" strokeWidth="2.5" /></svg>
          Com PoupaUp
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'rgba(255,255,255,.5)' }}>
          <svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke="rgba(248,113,113,.6)" strokeWidth="2" strokeDasharray="4 3" /></svg>
          Sem controle
        </div>
      </div>
    </div>
  )
}

// ── Contador animado ──────────────────────────────────────────────────────────
function ContadorAnimado({ alvo, prefixo = '', sufixo = '', duracao = 1800, visivel }: { alvo: number; prefixo?: string; sufixo?: string; duracao?: number; visivel: boolean }) {
  const [val, setVal] = useState(0)
  const iniciou = useRef(false)

  useEffect(() => {
    if (!visivel || iniciou.current) return
    iniciou.current = true
    const inicio = performance.now()
    function frame(agora: number) {
      const p = Math.min((agora - inicio) / duracao, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setVal(Math.round(ease * alvo))
      if (p < 1) requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  }, [visivel, alvo, duracao])

  return <>{prefixo}{val.toLocaleString('pt-BR')}{sufixo}</>
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function LandingPage() {
  const router = useRouter()
  const observerRef = useRef<IntersectionObserver | null>(null)
  const [toastContaExcluida, setToastContaExcluida] = useState(false)
  const [consentBanner, setConsentBanner] = useState(false)
  const [visivelChart, setVisivelChart] = useState(false)
  const [visivelStats, setVisivelStats] = useState(false)
  const chartRef = useRef<HTMLDivElement>(null)
  const statsRef = useRef<HTMLDivElement>(null)

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
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) e.target.classList.add('visible')
      })
    }, { threshold: 0.1 })
    observerRef.current = io
    document.querySelectorAll('.fade-in').forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [])

  // Observer para o gráfico
  useEffect(() => {
    if (!chartRef.current) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisivelChart(true) }, { threshold: 0.3 })
    io.observe(chartRef.current)
    return () => io.disconnect()
  }, [])

  // Observer para stats
  useEffect(() => {
    if (!statsRef.current) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisivelStats(true) }, { threshold: 0.4 })
    io.observe(statsRef.current)
    return () => io.disconnect()
  }, [])

  return (
    <div style={{ background: '#0a0a0a', color: '#fff', fontFamily: 'system-ui, sans-serif', minHeight: '100vh' }}>

      <style>{`
        .fade-in { opacity: 0; transform: translateY(24px); transition: opacity .6s ease, transform .6s ease; }
        .fade-in.visible { opacity: 1; transform: translateY(0); }
        .hover-green:hover { background: #15803d !important; }
        .hover-outline:hover { background: rgba(74,222,128,.08) !important; border-color: #4ade80 !important; color: #4ade80 !important; }
        .nav-link { color: rgba(255,255,255,.55); text-decoration: none; font-size: 14px; transition: color .15s; }
        .nav-link:hover { color: #fff; }
        .card-feature:hover { border-color: rgba(74,222,128,.3) !important; transform: translateY(-2px); }
        .card-feature { transition: border-color .2s, transform .2s; }
        .benefit-item:hover { background: rgba(74,222,128,.06) !important; border-color: rgba(74,222,128,.2) !important; }
        .benefit-item { transition: background .2s, border-color .2s; }
        @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.4)} }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @media (max-width: 768px) {
          .hero-title { font-size: 34px !important; }
          .hero-btns { flex-direction: column !important; }
          .stats-grid { grid-template-columns: 1fr 1fr !important; }
          .steps-grid { grid-template-columns: 1fr !important; }
          .features-grid { grid-template-columns: 1fr 1fr !important; }
          .plans-grid { grid-template-columns: 1fr !important; }
          .nav-links { display: none !important; }
          .chart-layout { flex-direction: column !important; }
          .benefits-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 480px) {
          .features-grid { grid-template-columns: 1fr !important; }
          .stats-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>

      {/* LGPD */}
      {consentBanner && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9998, background: '#0d1a0d', borderTop: '1px solid #1a3a1a', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,.6)', maxWidth: 700 }}>
            Usamos cookies essenciais para o funcionamento do app, conforme nossa{' '}
            <a href="/privacidade" style={{ color: '#4ade80', textDecoration: 'underline' }}>Política de Privacidade</a> (LGPD). Não vendemos seus dados.
          </p>
          <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
            <a href="/privacidade" style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', textDecoration: 'none', padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,.1)' }}>Ver política</a>
            <button onClick={aceitarConsent} style={{ fontSize: 13, fontWeight: 600, color: '#0a0a0a', background: '#4ade80', border: 'none', borderRadius: 8, padding: '8px 20px', cursor: 'pointer' }}>Entendi e aceito</button>
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
      <header style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: 'rgba(10,10,10,.88)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #1a2a1a' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 1.5rem', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <PoupaUpLogo mode="compact" />
          <nav className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
            <a href="#beneficios" className="nav-link">Benefícios</a>
            <a href="#funcionalidades" className="nav-link">Funcionalidades</a>
            <a href="#precos" className="nav-link">Preços</a>
            <a href="/login" className="nav-link">Entrar</a>
          </nav>
          <a href="/login" style={{ background: '#16a34a', color: '#fff', padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none' }} className="hover-green">
            Começar grátis
          </a>
        </div>
      </header>

      {/* ── HERO ── */}
      <section style={{ paddingTop: 120, paddingBottom: 80, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%,-50%)', width: 700, height: 500, background: 'radial-gradient(ellipse, rgba(74,222,128,.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ maxWidth: 820, margin: '0 auto', padding: '0 1.5rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(74,222,128,.1)', border: '1px solid rgba(74,222,128,.25)', borderRadius: 20, padding: '5px 14px', fontSize: 12, color: '#4ade80', fontWeight: 500, marginBottom: 28 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', display: 'inline-block', animation: 'pulse-dot 2s infinite' }} />
            Controle financeiro completo com IA
          </div>

          <h1 className="hero-title" style={{ fontSize: 52, fontWeight: 800, lineHeight: 1.15, letterSpacing: -1.5, margin: '0 auto 20px' }}>
            Pare de perder dinheiro.<br />
            <span style={{ color: '#4ade80' }}>Comece a acumular riqueza.</span>
          </h1>

          <p style={{ fontSize: 18, color: 'rgba(255,255,255,.5)', lineHeight: 1.7, maxWidth: 600, margin: '0 auto 16px' }}>
            Dashboard completo, IA que analisa seus gastos, lançamentos pelo WhatsApp, metas, gamificação e controle familiar — tudo em um único app.
          </p>

          {/* Chips de benefícios rápidos */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 36 }}>
            {[
              '💬 WhatsApp', '🤖 IA integrada', '👨‍👩‍👧 Família', '🎮 Gamificação',
              '🎯 Metas', '📊 Relatórios', '💳 Dívidas', '🔔 Alertas',
            ].map(chip => (
              <div key={chip} style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 20, padding: '4px 12px', fontSize: 12, color: 'rgba(255,255,255,.55)' }}>{chip}</div>
            ))}
          </div>

          <div className="hero-btns" style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 56 }}>
            <a href="/login" style={{ background: '#16a34a', color: '#fff', padding: '14px 32px', borderRadius: 10, fontSize: 15, fontWeight: 700, textDecoration: 'none' }} className="hover-green">
              Começar grátis →
            </a>
            <a href="#grafico" style={{ background: 'transparent', color: 'rgba(255,255,255,.7)', padding: '14px 28px', borderRadius: 10, fontSize: 15, fontWeight: 500, textDecoration: 'none', border: '1px solid rgba(255,255,255,.15)' }} className="hover-outline">
              Ver resultado real
            </a>
          </div>

          {/* Mock dashboard animado */}
          <div className="fade-in" style={{ background: '#0a1a0a', border: '1px solid #1a3a1a', borderRadius: 16, padding: '1.25rem', boxShadow: '0 32px 80px rgba(0,0,0,.6), 0 0 0 1px rgba(74,222,128,.05)', animation: 'float 4s ease-in-out infinite' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid #1a3a1a' }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,.7)' }}>PoupaUp · Dashboard</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', animation: 'pulse-dot 2s infinite' }} />
                <span style={{ fontSize: 10, color: '#4ade80' }}>WhatsApp ativo</span>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: '1rem' }}>
              {[
                { label: 'Saldo', val: 'R$ 3.280', cor: '#4ade80' },
                { label: 'Receitas', val: 'R$ 8.500', cor: '#4ade80' },
                { label: 'Gastos', val: 'R$ 5.220', cor: '#f87171' },
                { label: 'XP total', val: '1.840 XP', cor: '#fbbf24' },
              ].map(c => (
                <div key={c.label} style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,.35)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>{c.label}</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: c.cor }}>{c.val}</div>
                </div>
              ))}
            </div>
            <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: '#4ade80' }}>Nível 4 · Cavaleiro das Finanças 🏰</span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,.3)' }}>1.840 / 2.000 XP</span>
              </div>
              <div style={{ height: 5, background: 'rgba(255,255,255,.06)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: '92%', background: 'linear-gradient(90deg, #16a34a, #4ade80)', borderRadius: 3, backgroundSize: '200% 100%', animation: 'shimmer 2s linear infinite' }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section ref={statsRef} style={{ padding: '60px 1.5rem', maxWidth: 900, margin: '0 auto' }}>
        <div className="stats-grid fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, textAlign: 'center' }}>
          {[
            { alvo: 3800, prefixo: 'R$ ', sufixo: '', label: 'poupados em média em 8 meses', cor: '#4ade80' },
            { alvo: 47, prefixo: '', sufixo: '%', label: 'de redução nos gastos desnecessários', cor: '#22d3ee' },
            { alvo: 12, prefixo: '', sufixo: 's', label: 'para lançar uma despesa pelo WhatsApp', cor: '#fbbf24' },
            { alvo: 100, prefixo: '', sufixo: '+', label: 'conquistas e missões para manter o foco', cor: '#a78bfa' },
          ].map((s, i) => (
            <div key={i} style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 14, padding: '1.5rem 1rem' }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: s.cor, marginBottom: 6 }}>
                <ContadorAnimado alvo={s.alvo} prefixo={s.prefixo} sufixo={s.sufixo} visivel={visivelStats} />
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', lineHeight: 1.5 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── GRÁFICO ANTES / DEPOIS ── */}
      <section id="grafico" style={{ padding: '80px 1.5rem', maxWidth: 1100, margin: '0 auto' }}>
        <div className="fade-in" style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 12 }}>Resultado real</div>
          <h2 style={{ fontSize: 36, fontWeight: 700, letterSpacing: -0.5, margin: '0 0 14px' }}>O que muda quando você controla</h2>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,.4)', margin: 0, maxWidth: 500, marginLeft: 'auto', marginRight: 'auto' }}>
            Usuários que usam o PoupaUp por 8 meses poupam em média R$ 3.800 que antes sumiam sem explicação.
          </p>
        </div>

        <div className="chart-layout" ref={chartRef} style={{ display: 'flex', gap: 40, alignItems: 'center', background: '#0a1a0a', border: '1px solid #1a3a1a', borderRadius: 20, padding: '2rem' }}>
          {/* Gráfico */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <GraficoAntesDepois visivel={visivelChart} />
          </div>

          {/* Callouts */}
          <div style={{ flexShrink: 0, width: 220, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { emoji: '📉', titulo: 'Sem controle', desc: 'Gastos invisíveis, dinheiro desaparecendo, sem poupança.', cor: '#f87171' },
              { emoji: '📈', titulo: 'Com PoupaUp', desc: 'Cada centavo rastreado, metas batidas, poupança crescendo todo mês.', cor: '#4ade80' },
            ].map(c => (
              <div key={c.titulo} style={{ background: `${c.cor}08`, border: `1px solid ${c.cor}22`, borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 20, marginBottom: 6 }}>{c.emoji}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: c.cor, marginBottom: 4 }}>{c.titulo}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.45)', lineHeight: 1.5 }}>{c.desc}</div>
              </div>
            ))}
            <div style={{ background: 'rgba(74,222,128,.06)', border: '1px solid rgba(74,222,128,.2)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#4ade80' }}>R$ 3.800</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', lineHeight: 1.5 }}>poupança extra em 8 meses vs. quem não controla</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── BENEFÍCIOS ── */}
      <section id="beneficios" style={{ padding: '80px 1.5rem', maxWidth: 1100, margin: '0 auto' }}>
        <div className="fade-in" style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 12 }}>Por que o PoupaUp</div>
          <h2 style={{ fontSize: 36, fontWeight: 700, letterSpacing: -0.5, margin: 0 }}>Tudo que você precisava, finalmente junto</h2>
        </div>

        <div className="benefits-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { emoji: '💬', titulo: 'Lance pelo WhatsApp', desc: 'Mande "almoço R$45" e pronto — categorizado, registrado e confirmado em 10 segundos, sem abrir app.' },
            { emoji: '🤖', titulo: 'IA que realmente ajuda', desc: 'O PoupaBot analisa seus padrões, identifica desperdícios e sugere como economizar com base nos seus dados reais.' },
            { emoji: '📊', titulo: 'Dashboard que faz sentido', desc: 'Gráficos de evolução, comparativos mensais, breakdown por categoria e insights automáticos em uma tela.' },
            { emoji: '🎯', titulo: 'Metas com previsão real', desc: 'Defina seu objetivo e veja exatamente em que mês vai atingi-lo com base na sua contribuição mensal.' },
            { emoji: '⚖️', titulo: 'Orçamento inteligente', desc: 'Configure limites por categoria e receba alertas antes de estourar — não depois. IA sugere valores baseados no seu histórico.' },
            { emoji: '💳', titulo: 'Simulador de dívidas', desc: 'Compare estratégias Avalanche vs. Bola de Neve e veja quando você ficará livre de cada dívida.' },
            { emoji: '👨‍👩‍👧', titulo: 'Controle familiar', desc: 'Marido, esposa e filhos no mesmo grupo. Veja os gastos de todos consolidados e identifique onde a família pode economizar.' },
            { emoji: '🎮', titulo: 'Gamificação que motiva', desc: 'XP, níveis, conquistas e missões diárias. Porque poupar dinheiro precisa ser recompensador, não chato.' },
            { emoji: '📋', titulo: 'Importação de extrato', desc: 'Importe OFX/CSV direto do seu banco. A IA categoriza automaticamente e detecta duplicatas.' },
          ].map(b => (
            <div key={b.titulo} className="fade-in benefit-item card-feature" style={{ background: '#0d0d0d', border: '1px solid #1a2a1a', borderRadius: 14, padding: '1.25rem' }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>{b.emoji}</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, color: '#fff' }}>{b.titulo}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.42)', lineHeight: 1.65 }}>{b.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── COMO FUNCIONA ── */}
      <section id="como-funciona" style={{ padding: '80px 1.5rem', maxWidth: 900, margin: '0 auto' }}>
        <div className="fade-in" style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 12 }}>Começar é simples</div>
          <h2 style={{ fontSize: 36, fontWeight: 700, letterSpacing: -0.5, margin: 0 }}>3 passos e você já está no controle</h2>
        </div>
        <div className="steps-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
          {[
            { num: '01', emoji: '📱', titulo: 'Crie sua conta grátis', desc: 'Cadastro em 1 minuto. Configure seu perfil, adicione suas contas bancárias e defina seus objetivos.' },
            { num: '02', emoji: '💬', titulo: 'Conecte o WhatsApp', desc: 'Escaneie um QR Code e pronto. Mande qualquer gasto por mensagem e o PoupaUp registra na hora.' },
            { num: '03', emoji: '🚀', titulo: 'Veja o dinheiro crescer', desc: 'Dashboard em tempo real, alertas de orçamento, missões diárias e conquistas para manter o foco.' },
          ].map(s => (
            <div key={s.num} className="fade-in card-feature" style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 16, padding: '1.75rem' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#4ade80', marginBottom: 16 }}>{s.num}</div>
              <div style={{ fontSize: 36, marginBottom: 14 }}>{s.emoji}</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{s.titulo}</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,.45)', lineHeight: 1.6 }}>{s.desc}</div>
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
            {['Dashboard completo', 'Lançamentos via WhatsApp', 'PoupaBot básico', '5 metas ativas', 'Orçamento por categoria', 'Alertas automáticos', 'Gamificação e conquistas'].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10, fontSize: 13, color: 'rgba(255,255,255,.65)' }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><polyline points="1.5,7 5,10.5 12.5,3" stroke="#4ade80" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                {f}
              </div>
            ))}
            <a href="/login" style={{ display: 'block', marginTop: 24, background: 'rgba(22,163,74,.15)', color: '#4ade80', padding: '12px', borderRadius: 10, textAlign: 'center', fontSize: 14, fontWeight: 600, textDecoration: 'none', border: '1px solid rgba(74,222,128,.2)' }} className="hover-green">
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
            {['Tudo do Free', 'Grupo familiar (membros ilimitados)', 'PoupaBot avançado sem limites', 'Simulador de dívidas completo', 'Importação de extratos OFX/CSV', 'Relatórios mensais em PDF', 'Suporte prioritário'].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10, fontSize: 13, color: 'rgba(255,255,255,.65)' }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><polyline points="1.5,7 5,10.5 12.5,3" stroke="#4ade80" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                {f}
              </div>
            ))}
            <BotaoAssinar plano="pro_mensal" label="Assinar Pro — R$ 27/mês →" />
            <BotaoAssinar plano="pro_anual" label="Assinar anual — R$ 197/ano →" estilo="secundario" />
            <div style={{ textAlign: 'center', marginTop: 10, fontSize: 11, color: 'rgba(255,255,255,.25)' }}>🔒 Pagamento seguro via Stripe</div>
          </div>
        </div>
      </section>

      {/* ── DEPOIMENTO ── */}
      <section style={{ padding: '60px 1.5rem', maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
        <div className="fade-in" style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 20, padding: '2rem 2.5rem', position: 'relative' }}>
          <div style={{ fontSize: 48, color: 'rgba(74,222,128,.3)', fontFamily: 'Georgia, serif', lineHeight: 1, marginBottom: 16, marginTop: -8 }}>&quot;</div>
          <p style={{ fontSize: 18, lineHeight: 1.7, color: 'rgba(255,255,255,.8)', fontStyle: 'italic', margin: '0 0 24px' }}>
            Em 3 meses usando o PoupaUp, identifiquei R$ 800 em gastos que eu nem sabia que tinha. Quitei uma dívida e ainda sobrou pra meta de viagem.
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
            Quanto você está perdendo<br /><span style={{ color: '#4ade80' }}>sem controlar seu dinheiro?</span>
          </h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,.45)', marginBottom: 32 }}>
            Crie sua conta grátis em menos de 1 minuto. Sem cartão de crédito.
          </p>
          <a href="/login" onClick={(e) => { e.preventDefault(); router.push('/login') }} style={{ display: 'inline-block', background: '#16a34a', color: '#fff', padding: '16px 44px', borderRadius: 12, fontSize: 16, fontWeight: 700, textDecoration: 'none', boxShadow: '0 8px 32px rgba(22,163,74,.3)' }} className="hover-green">
            Criar conta grátis →
          </a>
          <div style={{ marginTop: 16, fontSize: 12, color: 'rgba(255,255,255,.2)' }}>Grátis para sempre · sem cartão · cancele quando quiser</div>
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
            <a href="/privacidade#termos" style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', textDecoration: 'none' }} className="nav-link">Termos</a>
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
