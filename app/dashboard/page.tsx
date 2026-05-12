'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import PoupaUpLogo from '@/components/PoupaUpLogo'
import SinoNotificacoes from '@/components/SinoNotificacoes'
import Avatar from '@/components/Avatar'
import TarefasWidget from '@/components/TarefasWidget'
import TourGuiado from '@/components/TourGuiado'
import PushManager from '@/components/PushManager'
import ExtratoXP from '@/components/ExtratoXP'
import PrioridadeWidget, { type PrioridadeComMetrica } from '@/components/PrioridadeWidget'
import { usePerfil } from '@/hooks/usePerfil'
import { calcularXP, calcularNivel, getNomeNivel } from '@/lib/calcularXP'
import { useCores, useTema } from '@/components/ThemeProvider'
import { APP_VERSION, APP_BUILD } from '@/lib/version'

interface Transacao {
  id: string
  descricao: string
  valor: number
  tipo: 'debito' | 'credito'
  categoria: string
  data_hora: string
}

interface Meta {
  id: string
  nome: string
  valor_total: number
  valor_atual: number
  ativo?: boolean
}

interface Profile {
  nome: string
  plano: string
  avatar_url?: string | null
  setup_completo?: boolean
  prioridades?: PrioridadeComMetrica[]
  xp_bonus?: number
  is_admin?: boolean
}

interface Conta {
  id: string
  nome: string
  saldo: number
  mostrar_saldo: boolean
  bancos: { nome_curto: string; cor: string | null } | null
}

const CORES: Record<string, string> = {
  'Alimentação': '#4ade80', 'Transporte': '#22d3ee', 'Lazer': '#f97316',
  'Saúde': '#a78bfa', 'Moradia': '#fbbf24', 'Educação': '#60a5fa',
  'Receita': '#4ade80', 'Outros': '#6b7280',
}

const LogoPoupaUp = ({ collapsed }: { collapsed: boolean }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
    <div style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 8, overflow: 'hidden' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/velocimetro.png" alt="PoupaUp" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </div>
    {!collapsed && (
      <div style={{ lineHeight: 1 }}>
        <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.02em', background: 'linear-gradient(135deg, #fff 40%, #4ade80 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Poupa<span style={{ background: 'linear-gradient(135deg, #4ade80, #a3e635)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Up</span>
        </div>
        <div style={{ fontSize: 8, color: 'rgba(255,255,255,.3)', letterSpacing: '.1em', marginTop: 2, textTransform: 'uppercase' }}>
          Poupar · Evoluir · Conquistar
        </div>
      </div>
    )}
  </div>
)

// Hook simples para detectar largura da tela
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return isMobile
}

// Componente isolado para usar useSearchParams dentro de Suspense
function UpgradeBanner({ onDetect }: { onDetect: (v: 'success' | 'cancelled' | null) => void }) {
  const searchParams = useSearchParams()
  useEffect(() => {
    const v = searchParams.get('upgrade')
    if (v === 'success' || v === 'cancelled') onDetect(v)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}

export default function Dashboard() {
  const router = useRouter()
  const supabase = createClient()
  const { fmtData, timezone, idioma } = usePerfil()
  const isMobile = useIsMobile()
  const cores = useCores()
  const { tema } = useTema()
  const m = tema === 'medieval'

  const [upgradeBanner, setUpgradeBanner] = useState<'success' | 'cancelled' | null>(null)

  const [profile, setProfile]       = useState<Profile | null>(null)
  const [transacoes, setTransacoes] = useState<Transacao[]>([])
  const [metas, setMetas]           = useState<Meta[]>([])
  const [contas, setContas]         = useState<Conta[]>([])
  const [loading, setLoading]       = useState(true)
  const [paginaAtiva, setPagina]    = useState('inicio')
  const [iaAnalisando, setIaAnalisando]   = useState(false)
  const [extratoXPAberto, setExtratoXP]   = useState(false)

  // Em mobile sidebar começa fechada, em desktop aberta
  const [sidebarAberta, setSidebar] = useState(true)

useEffect(() => {
  setSidebar(!isMobile) // eslint-disable-line react-hooks/set-state-in-effect
}, [isMobile])

  const xp           = calcularXP({ transacoes, metas, xpBonus: profile?.xp_bonus || 0 })
  const { receitas, despesas, saldo } = xp
  const xpTotal      = xp.xpTotal
  const nivel        = calcularNivel(xpTotal)
  const nomeNivel    = getNomeNivel(nivel, m)
  const proxNomeNivel = nivel.proximoNivel ? getNomeNivel(nivel.proximoNivel, m) : null

  const nome = profile?.nome || (m ? 'Nobre Guerreiro' : 'usuário')
  const tx = {
    navSep1:      m ? 'Câmara Real'            : 'Menu',
    navSep2:      m ? 'Salão do Herói'         : 'Ferramentas',
    tituloInicio: m ? '🏰 Salão do Reino'      : '🏠 Início',
    tituloEvol:   m ? '⚡ Jornada do Herói'    : '📈 Evolução',
    saudacao:     m ? `⚔ Saudações, ${nome}`   : `Olá, ${nome} 👋`,
    xpIcone:      m ? '⚔'                      : '★',
    metLabels:    m ? ['Tesouro','Tributos','Batalhas','Glória']   as const : ['Saldo','Receitas','Gastos','Score']   as const,
    metIcones:    m ? ['💰','📈','⚔️','👑']    as const           : ['💰','📈','💸','⭐']   as const,
    secContas:    m ? '💰 Cofres do Reino'      : '🏦 Contas',
    btnContas:    m ? 'explorar →'              : 'ver contas',
    secInsights:  m ? '🔮 Profecias do Oráculo' : '💡 Análise Financeira',
    secCats:      m ? '📊 Crônicas por Ordem'   : '📊 Por Categoria',
    secTx:        m ? '⚔️ Crônicas de Batalha'  : '📋 Últimas Transações',
    btnTx:        m ? 'ver crônicas'             : 'ver todas',
    emptyTx:      m ? 'As crônicas estão vazias.' : 'Nenhuma transação ainda.',
    emptyTxCta:   m ? 'Registrar no Livro →'    : 'Adicionar transação →',
    secMetas:     m ? '🎯 Quests Ativas'         : '🎯 Metas Ativas',
    btnMetas:     m ? 'ver quests'               : 'ver todas',
    emptyMeta:    m ? 'Nenhuma meta.'            : 'Nenhuma meta cadastrada.',
    emptyMetaCta: m ? 'Declarar Quest →'         : 'Nova meta →',
    secConq:      m ? '🏅 Brasões de Honra'      : '🏅 Conquistas',
    evolTitulo:   m ? 'Título'                   : 'Nível',
    evolXP:       m ? 'Glória'                   : 'Score',
    accentColor:  m ? '#D4AF37'                  : cores.accent,
    accentMuted:  m ? 'rgba(212,175,55,.6)'      : `${cores.accent}99`,
    fontDisplay:  m ? 'var(--font-cinzel, Georgia, serif)' : 'inherit',
  }

  const porCategoria = transacoes.filter(t => t.tipo === 'debito').reduce((acc, t) => {
    acc[t.categoria] = (acc[t.categoria] || 0) + Math.abs(t.valor); return acc
  }, {} as Record<string, number>)
  const maxCategoria = Math.max(...Object.values(porCategoria), 1)
  const insights     = gerarInsights(transacoes, saldo)

  const carregarDados = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const [{ data: prof }, { data: tx }, { data: mt }] = await Promise.all([
      supabase.from('profiles').select('nome, plano, avatar_url, setup_completo, xp_bonus, is_admin').eq('id', user.id).single(),
      supabase.from('transactions').select('*').eq('user_id', user.id).order('data_hora', { ascending: false }),
      supabase.from('goals').select('*').eq('user_id', user.id).eq('ativo', true).limit(4),
    ])

    if (prof) {
      if (prof.setup_completo === false) { router.push('/onboarding'); return }
      setProfile(prof)
    }
    if (tx)   setTransacoes(tx)
    if (mt)   setMetas(mt)

    const contasRes   = await fetch('/api/contas')
    const contasDados = await contasRes.json()
    setContas(contasDados.contas || [])
    setLoading(false)

    // Auto-trigger IA notification (máx 2x/dia, aleatório)
    const hoje = new Date().toISOString().slice(0, 10)
    const key  = `poupaup_ia_notif_${hoje}`
    const count = parseInt(localStorage.getItem(key) || '0', 10)
    if (count < 2 && Math.random() < 0.4) {
      const delay = 8000 + Math.random() * 12000 // 8-20s após carregar
      setTimeout(async () => {
        setIaAnalisando(true)
        try {
          const r = await fetch('/api/notificacoes/ia', { method: 'POST' })
          const d = await r.json()
          if (d.ok) localStorage.setItem(key, String(count + 1))
        } finally {
          setIaAnalisando(false)
        }
      }, delay)
    }
  }, [supabase, router])

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel>
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      carregarDados()
      channel = supabase
        .channel('dashboard-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${user.id}` }, () => { carregarDados() })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => { carregarDados() })
        .subscribe()
    }
    init()
    return () => { if (channel) supabase.removeChannel(channel) }
  }, [carregarDados, supabase])

  async function sair() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: cores.pageBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, fontFamily: 'system-ui, sans-serif' }}>
      <PoupaUpLogo mode="compact" />
      <div style={{ fontSize: 13, color: 'rgba(212,175,55,.5)', fontFamily: 'var(--font-cinzel, Georgia, serif)', letterSpacing: '0.1em' }}>Convocando o Reino...</div>
    </div>
  )

  const NAV_ITEMS = [
    { id: 'inicio',       label: m ? 'Salão do Reino'   : 'Início',          icon: m ? '🏰' : '🏠' },
    { id: 'lancamento',   label: m ? 'Livro do Tesouro' : 'Lançamentos',     icon: m ? '📜' : '📝', href: '/dashboard/lancamento',    tour: 'tour-nav-lancamento' },
    { id: 'gastos',       label: m ? 'Batalhas'         : 'Gastos',          icon: m ? '⚔️' : '💸', href: '/dashboard/gastos',         tour: 'tour-nav-gastos' },
    { id: 'orcamento',    label: m ? 'Edito do Reino'   : 'Orçamento',       icon: m ? '⚖️' : '📊', href: '/dashboard/orcamento',      tour: 'tour-nav-orcamento' },
    { id: 'metas',        label: m ? 'Quests'           : 'Metas',           icon: m ? '🎯' : '🎯', href: '/dashboard/metas',          tour: 'tour-nav-metas' },
    { id: 'tarefas',      label: m ? 'Missões & Desafios': 'Tarefas',         icon: '📋',              href: '/dashboard/tarefas' },
    { id: 'ia',           label: m ? 'Oráculo'          : 'Assistente IA',   icon: m ? '🔮' : '🤖', href: '/dashboard/ia',             tour: 'tour-nav-ia' },
    { id: 'notificacoes', label: m ? 'Pergaminhos'      : 'Notificações',    icon: m ? '📯' : '🔔', href: '/dashboard/notificacoes',   tour: 'tour-nav-notificacoes' },
    { id: 'evolucao',     label: m ? 'Jornada do Herói' : 'Evolução',        icon: m ? '⚡' : '📈', href: '/dashboard/evolucao' },
    { id: 'contas',       label: m ? 'Cofres do Reino'  : 'Contas',          icon: m ? '💰' : '🏦', href: '/dashboard/contas' },
    ...(profile?.is_admin ? [{ id: 'admin', label: 'Painel Admin', icon: '🛠️', href: '/dashboard/admin' }] : []),
  ]

  // largura do sidebar — em mobile sempre 200 quando aberto (drawer), em desktop colapsa para 56
  const sidebarWidth = isMobile ? 200 : (sidebarAberta ? 200 : 56)
  const collapsed    = !isMobile && !sidebarAberta

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: cores.pageBg, fontFamily: 'system-ui, sans-serif', fontSize: 13, position: 'relative', color: cores.text }}>

      {/* Overlay IA analisando */}
      {iaAnalisando && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backdropFilter: 'blur(6px) brightness(0.45)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
          <div style={{ position: 'relative', width: 64, height: 64 }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `3px solid ${m ? '#D4AF37' : cores.accent}33` }} />
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `3px solid transparent`, borderTopColor: m ? '#D4AF37' : cores.accent, animation: 'ia-spin 0.9s linear infinite' }} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>{m ? '🔮' : '🤖'}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', fontFamily: m ? 'var(--font-cinzel, Georgia, serif)' : 'inherit', marginBottom: 6 }}>
              {m ? 'O Oráculo consulta os astros…' : 'IA analisando seus dados…'}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.45)' }}>
              {m ? 'Aguarde as profecias do reino' : 'Criando notificações personalizadas para você'}
            </div>
          </div>
          <style>{`@keyframes ia-spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )}

      {/* Overlay escuro em mobile quando sidebar aberta */}
      {isMobile && sidebarAberta && (
        <div
          onClick={() => setSidebar(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 40 }}
        />
      )}

      {/* ── Tour guiado (primeira vez) ── */}
      <TourGuiado />
      {/* ── Banner push (aparece após 5s se não ativado) ── */}
      <PushManager />

      {/* ── Extrato de XP ── */}
      {extratoXPAberto && (
        <ExtratoXP
          xpTotal={xpTotal}
          xpSaldo={xp.xpSaldo}
          xpBonus={profile?.xp_bonus || 0}
          saldo={saldo}
          transacoes={transacoes}
          metas={metas}
          onFechar={() => setExtratoXP(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside data-tour="tour-sidebar" style={{
        width: sidebarWidth,
        background: cores.sidebarBg,
        borderRight: `1px solid ${cores.border}`,
        display: 'flex',
        flexDirection: 'column',
        transition: 'width .2s, transform .2s',
        flexShrink: 0,
        ...(isMobile ? {
          position: 'fixed',
          top: 0, left: 0,
          height: '100vh',
          zIndex: 50,
          transform: sidebarAberta ? 'translateX(0)' : 'translateX(-100%)',
          width: 200,
        } : {}),
      }}>
        {/* Logo */}
        <div style={{ padding: '1rem', borderBottom: `1px solid ${cores.sidebarBorder}`, display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start' }}>
          <LogoPoupaUp collapsed={collapsed} />
        </div>

        {/* Perfil resumido */}
        {!collapsed && profile && (
          <div
            data-tour="tour-perfil"
            onClick={() => router.push('/dashboard/perfil')}
            style={{ padding: '10px 1rem', borderBottom: `1px solid ${cores.sidebarBorder}`, display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}
          >
            <Avatar url={profile.avatar_url} nome={profile.nome || 'U'} size={30} nivel={nivel.nivel} onClick={undefined} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: cores.sidebarText, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile.nome}</div>
            </div>
          </div>
        )}

        <nav style={{ flex: 1, padding: '0.5rem 0', overflowY: 'auto' }}>
          {!collapsed && (
            <div style={{ padding: '6px 1rem 4px', fontSize: 9, color: cores.sidebarTextFaint, textTransform: 'uppercase' as const, letterSpacing: '.15em', fontFamily: tx.fontDisplay }}>
              {tx.navSep1}
            </div>
          )}

          {NAV_ITEMS.slice(0, 4).map(item => (
            <button key={item.id}
              {...('tour' in item && item.tour ? { 'data-tour': item.tour } : {})}
              onClick={() => {
                if ('href' in item && item.href) router.push(item.href)
                else setPagina(item.id)
                if (isMobile) setSidebar(false)
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: !collapsed ? '7px 1rem' : '7px 14px',
                width: '100%',
                background: paginaAtiva === item.id ? cores.sidebarActive : 'transparent',
                border: 'none',
                borderLeft: paginaAtiva === item.id ? `2px solid ${cores.sidebarActiveColor}` : '2px solid transparent',
                cursor: 'pointer',
                color: paginaAtiva === item.id ? cores.sidebarActiveColor : cores.sidebarTextMuted,
                fontSize: 12, fontWeight: paginaAtiva === item.id ? 600 : 400,
                transition: 'all .15s', textAlign: 'left', whiteSpace: 'nowrap',
              }}>
              <span style={{ fontSize: 15, flexShrink: 0, lineHeight: 1 }}>{item.icon}</span>
              {!collapsed && item.label}
            </button>
          ))}

          {!collapsed && (
            <div style={{ padding: '10px 1rem 4px', fontSize: 9, color: cores.sidebarTextFaint, textTransform: 'uppercase' as const, letterSpacing: '.15em', fontFamily: tx.fontDisplay }}>
              {tx.navSep2}
            </div>
          )}
          {collapsed && <div style={{ height: 1, background: cores.sidebarBorder, margin: '6px 10px' }} />}

          {NAV_ITEMS.slice(4).map(item => (
            <button key={item.id}
              {...('tour' in item && item.tour ? { 'data-tour': item.tour } : {})}
              onClick={() => {
                if ('href' in item && item.href) router.push(item.href)
                else setPagina(item.id)
                if (isMobile) setSidebar(false)
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: !collapsed ? '7px 1rem' : '7px 14px',
                width: '100%',
                background: paginaAtiva === item.id ? cores.sidebarActive : 'transparent',
                border: 'none',
                borderLeft: paginaAtiva === item.id ? `2px solid ${cores.sidebarActiveColor}` : '2px solid transparent',
                cursor: 'pointer',
                color: paginaAtiva === item.id ? cores.sidebarActiveColor : cores.sidebarTextMuted,
                fontSize: 12, fontWeight: paginaAtiva === item.id ? 600 : 400,
                transition: 'all .15s', textAlign: 'left', whiteSpace: 'nowrap',
              }}>
              <span style={{ fontSize: 15, flexShrink: 0, lineHeight: 1 }}>{item.icon}</span>
              {!collapsed && item.label}
            </button>
          ))}
        </nav>

        {!collapsed && (
          <div
            onClick={() => router.push('/dashboard/evolucao')}
            style={{ margin: '0 .75rem 1rem', background: 'rgba(0,0,0,.25)', border: `1px solid ${nivel.cor}33`, borderRadius: 10, padding: '10px 12px', cursor: 'pointer', transition: 'border-color .2s' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 9, color: nivel.cor, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '.1em', fontFamily: tx.fontDisplay }}>{tx.xpIcone} {nomeNivel}</span>
              <span style={{ fontSize: 9, color: cores.sidebarTextFaint, fontVariantNumeric: 'tabular-nums' }}>Nv.{nivel.nivel}</span>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,.1)', borderRadius: 999, overflow: 'hidden', border: `1px solid ${nivel.cor}22` }}>
              <div style={{
                height: '100%', width: `${nivel.pct}%`, borderRadius: 999,
                background: m ? `linear-gradient(90deg, ${nivel.cor}88, ${nivel.cor}, #D4AF37)` : `linear-gradient(90deg, ${nivel.cor}88, ${nivel.cor})`,
                backgroundSize: '200% 100%',
                animation: 'xp-shimmer 3s linear infinite',
                transition: 'width .8s cubic-bezier(0.34,1.56,0.64,1)',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
              <span style={{ fontSize: 9, color: cores.sidebarTextFaint, fontVariantNumeric: 'tabular-nums' }}>{nivel.xpNoNivel.toLocaleString()} pts</span>
              {proxNomeNivel
                ? <span style={{ fontSize: 9, color: cores.sidebarTextFaint }}>falta {(nivel.xpParaProximo - nivel.xpNoNivel).toLocaleString()} p/ {proxNomeNivel}</span>
                : <span style={{ fontSize: 9, color: nivel.cor }}>{tx.xpIcone} {nomeNivel}</span>
              }
            </div>
          </div>
        )}

        {!collapsed && (
          <div style={{ padding: '0 .75rem .75rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontSize: 9, color: cores.sidebarTextFaint,
              background: 'rgba(255,255,255,.04)',
              border: `1px solid ${cores.sidebarBorder}`,
              borderRadius: 6, padding: '3px 8px',
              letterSpacing: '.04em', fontVariantNumeric: 'tabular-nums',
              userSelect: 'none' as const,
            }}>
              v{APP_VERSION} · {APP_BUILD}
            </span>
            <div style={{ display: 'flex', gap: 10 }}>
              <a href="/privacidade" target="_blank" style={{ fontSize: 9, color: cores.sidebarTextFaint, textDecoration: 'none', opacity: 0.6 }}>Privacidade</a>
              <span style={{ fontSize: 9, color: cores.sidebarTextFaint, opacity: 0.3 }}>·</span>
              <a href="/privacidade#termos" target="_blank" style={{ fontSize: 9, color: cores.sidebarTextFaint, textDecoration: 'none', opacity: 0.6 }}>Termos</a>
            </div>
          </div>
        )}

        <button onClick={sair} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: !collapsed ? '10px 1rem' : '10px 14px',
          background: 'transparent', border: 'none', borderTop: `1px solid ${cores.sidebarBorder}`,
          color: cores.sidebarTextFaint, cursor: 'pointer', fontSize: 12, width: '100%',
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 7h7M10 4l3 3-3 3M6 3H3a1 1 0 00-1 1v6a1 1 0 001 1h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {!collapsed && 'Sair'}
        </button>
      </aside>

      {/* ── Conteúdo principal ── */}
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        // Em mobile o main ocupa tudo (sidebar está por cima)
        marginLeft: isMobile ? 0 : undefined,
        minWidth: 0,
      }}>

        {/* Topbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.875rem 1rem', borderBottom: `1px solid ${cores.border}`, background: cores.topbarBg, gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => setSidebar(!sidebarAberta)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.4)', padding: 4, flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
            </button>
            <div>
              <span style={{ fontSize: 15, fontWeight: 600, color: m ? '#F5E6C8' : cores.text, fontFamily: tx.fontDisplay, letterSpacing: m ? '0.04em' : 0 }}>
                {{ inicio: tx.tituloInicio, evolucao: tx.tituloEvol }[paginaAtiva] || 'PoupaUp'}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {/* Badge webhook — oculto em telas muito pequenas */}
            {!isMobile && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(74,222,128,.1)', border: '1px solid rgba(74,222,128,.2)', borderRadius: 20, padding: '4px 10px' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80' }} />
                <span style={{ fontSize: 11, color: '#4ade80' }}>webhook ativo</span>
              </div>
            )}
            <SinoNotificacoes />
            <Avatar
              url={profile?.avatar_url}
              nome={profile?.nome || 'U'}
              size={30}
              nivel={nivel.nivel}
              onClick={() => router.push('/dashboard/perfil')}
            />
          </div>
        </div>

        {/* Conteúdo das páginas */}
        <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '.875rem' : '1.25rem 1.5rem' }}>

          {/* Banner upgrade Stripe */}
          <Suspense>
            <UpgradeBanner onDetect={setUpgradeBanner} />
          </Suspense>
          {upgradeBanner && (
            <div style={{
              marginBottom: 16,
              padding: '12px 16px',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              background: upgradeBanner === 'success' ? 'rgba(251,191,36,.12)' : 'rgba(239,68,68,.08)',
              border: `1px solid ${upgradeBanner === 'success' ? 'rgba(251,191,36,.35)' : 'rgba(239,68,68,.25)'}`,
            }}>
              <span style={{ fontSize: 13, color: upgradeBanner === 'success' ? '#fbbf24' : '#f87171' }}>
                {upgradeBanner === 'success'
                  ? '⭐ Upgrade realizado com sucesso! Bem-vindo ao plano Pro.'
                  : '❌ Upgrade cancelado. Seu plano não foi alterado.'}
              </span>
              <button onClick={() => setUpgradeBanner(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.4)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
            </div>
          )}

          {/* INÍCIO */}
          {paginaAtiva === 'inicio' && (
            <div>
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 600, color: m ? '#F5E6C8' : cores.text, marginBottom: 2, fontFamily: tx.fontDisplay, letterSpacing: m ? '0.03em' : 0 }}>
                  {tx.saudacao}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)' }}>
                  {new Intl.DateTimeFormat(idioma, { weekday: 'long', day: 'numeric', month: 'long', timeZone: timezone }).format(new Date())}
                </div>
              </div>

              {/* Cards métricas — 2 colunas em mobile, 4 em desktop */}
              <div data-tour="tour-metricas" style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,minmax(0,1fr))', gap: 8, marginBottom: '1rem' }}>
                {([
                  { label: tx.metLabels[0], val: formatBRL(saldo),    cor: saldo >= 0 ? tx.accentColor : '#c0392b', icone: tx.metIcones[0] },
                  { label: tx.metLabels[1], val: formatBRL(receitas), cor: m ? '#5A8A4A' : cores.accent,            icone: tx.metIcones[1] },
                  { label: tx.metLabels[2], val: formatBRL(despesas), cor: m ? '#8B0000' : '#f87171',               icone: tx.metIcones[2] },
                  { label: tx.metLabels[3], val: `${xpTotal.toLocaleString()} XP`, cor: tx.accentColor,           icone: tx.metIcones[3] },
                ] as const).map(card => (
                  <div key={card.label}
                    onClick={card.label === tx.metLabels[3] ? () => setExtratoXP(true) : undefined}
                    style={{
                      background: cores.cardBg,
                      border: `1px solid ${card.label === tx.metLabels[3] ? tx.accentColor + '44' : cores.cardBorder}`,
                      borderRadius: 10,
                      padding: '10px 12px',
                      boxShadow: cores.cardShadow,
                      cursor: card.label === tx.metLabels[3] ? 'pointer' : 'default',
                      transition: 'border-color .2s',
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 9, color: cores.textMuted, textTransform: 'uppercase' as const, letterSpacing: '.05em' }}>{card.label}</span>
                      <span style={{ fontSize: 12 }}>{card.icone}</span>
                    </div>
                    <div style={{ fontSize: isMobile ? 14 : 18, fontWeight: 600, color: card.cor, wordBreak: 'break-all' as const, fontVariantNumeric: 'tabular-nums' }}>{card.val}</div>
                    {card.label === tx.metLabels[3] && (
                      <div style={{ fontSize: 9, color: cores.textFaint, marginTop: 3 }}>Nv.{nivel.nivel} · {nivel.pct}% · <span style={{ color: tx.accentColor }}>ver extrato</span></div>
                    )}
                  </div>
                ))}
              </div>

              {/* Saldos por conta */}
              {contas.length > 0 && (
                <div style={{ background: cores.cardBg, border: `1px solid ${cores.cardBorder}`, borderRadius: 12, padding: '1rem', boxShadow: cores.cardShadow, marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 500, color: tx.accentMuted, textTransform: 'uppercase' as const, letterSpacing: '.08em', fontFamily: tx.fontDisplay }}>{tx.secContas}</span>
                    <button onClick={() => router.push('/dashboard/contas')} style={{ fontSize: 11, color: tx.accentColor, background: 'none', border: 'none', cursor: 'pointer' }}>{tx.btnContas}</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {contas.slice(0, 4).map(c => (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: c.bancos?.cor || '#4ade80', flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: 12, color: 'rgba(255,255,255,.7)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nome}</span>
                        <span style={{ fontSize: 12, fontWeight: 500, color: c.saldo >= 0 ? tx.accentColor : '#c0392b', flexShrink: 0 }}>
                          {c.mostrar_saldo ? `R$ ${c.saldo.toFixed(2).replace('.', ',')}` : '••••••'}
                        </span>
                      </div>
                    ))}
                    {contas.length > 4 && (
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', textAlign: 'center' }}>+{contas.length - 4} contas</div>
                    )}
                    <div style={{ borderTop: `1px solid ${cores.divider}`, paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>Total</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: tx.accentColor }}>
                        R$ {contas.reduce((a, c) => a + (c.mostrar_saldo ? c.saldo : 0), 0).toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Insights + Por categoria — coluna única em mobile */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 220px', gap: 10, marginBottom: 10 }}>
                <div style={{ background: cores.cardBg, border: `1px solid ${cores.cardBorder}`, borderRadius: 12, padding: '1rem', boxShadow: cores.cardShadow }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 500, color: tx.accentMuted, textTransform: 'uppercase' as const, letterSpacing: '.08em', fontFamily: tx.fontDisplay }}>{tx.secInsights}</span>
                    <span style={{ fontSize: 10, background: `${tx.accentColor}1a`, color: tx.accentColor, padding: '2px 8px', borderRadius: 2 }}>{insights.length} novos</span>
                  </div>
                  {insights.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', textAlign: 'center', padding: '1rem 0' }}>Lance transações para ver insights personalizados</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {insights.map((ins, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, background: 'rgba(255,255,255,.03)', border: '1px solid #1e2d1e', borderRadius: 8, padding: '8px 10px' }}>
                          <div style={{ width: 18, height: 18, borderRadius: 5, background: ins.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                            <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d={ins.icon} stroke={ins.cor} strokeWidth="1.3" strokeLinecap="round"/></svg>
                          </div>
                          <span style={{ fontSize: 12, color: 'rgba(255,255,255,.7)', lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: ins.texto }} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ background: cores.cardBg, border: `1px solid ${cores.cardBorder}`, borderRadius: 12, padding: '1rem', boxShadow: cores.cardShadow }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: tx.accentMuted, textTransform: 'uppercase' as const, letterSpacing: '.08em', marginBottom: 12, fontFamily: tx.fontDisplay }}>{tx.secCats}</div>
                  {Object.keys(porCategoria).length === 0 ? (
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', textAlign: 'center', paddingTop: '1rem' }}>Nenhum gasto ainda</div>
                  ) : (
                    Object.entries(porCategoria).sort((a,b) => b[1]-a[1]).slice(0,5).map(([cat, val]) => (
                      <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: CORES[cat] || '#6b7280', flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cat}</span>
                        <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,.06)', borderRadius: 2, overflow: 'hidden', flexShrink: 0 }}>
                          <div style={{ height: '100%', width: `${Math.round((val/maxCategoria)*100)}%`, background: CORES[cat] || '#6b7280', borderRadius: 2 }} />
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 500, color: '#fff', minWidth: 48, textAlign: 'right', flexShrink: 0 }}>{formatBRL(val)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Tarefas — missões, desafios e conquistas unificados */}
              <div style={{ marginBottom: 10 }}>
                <TarefasWidget />
              </div>

              {/* Últimas transações + Metas — coluna única em mobile */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
                <div style={{ background: cores.cardBg, border: `1px solid ${cores.cardBorder}`, borderRadius: 12, padding: '1rem', boxShadow: cores.cardShadow }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 500, color: tx.accentMuted, textTransform: 'uppercase' as const, letterSpacing: '.08em', fontFamily: tx.fontDisplay }}>{tx.secTx}</span>
                    <button onClick={() => router.push('/dashboard/gastos')} style={{ fontSize: 11, color: tx.accentColor, background: 'none', border: 'none', cursor: 'pointer' }}>{tx.btnTx}</button>
                  </div>
                  {transacoes.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', textAlign: 'center', padding: '1rem 0' }}>
                      {tx.emptyTx}{' '}
                      <span style={{ color: tx.accentColor, cursor: 'pointer' }} onClick={() => router.push('/dashboard/lancamento')}>{tx.emptyTxCta}</span>
                    </div>
                  ) : transacoes.slice(0, 5).map(t => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: `1px solid ${cores.divider}` }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: CORES[t.categoria] || '#6b7280', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.descricao}</div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)' }}>{t.categoria} · {fmtData(t.data_hora)}</div>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: t.tipo === 'credito' ? tx.accentColor : (m ? '#c0392b' : '#f87171'), whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {t.tipo === 'credito' ? '+' : '-'}{formatBRL(Math.abs(t.valor))}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ background: cores.cardBg, border: `1px solid ${cores.cardBorder}`, borderRadius: 12, padding: '1rem', boxShadow: cores.cardShadow }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 500, color: tx.accentMuted, textTransform: 'uppercase' as const, letterSpacing: '.08em', fontFamily: tx.fontDisplay }}>{tx.secMetas}</span>
                    <button onClick={() => router.push('/dashboard/metas')} style={{ fontSize: 11, color: tx.accentColor, background: 'none', border: 'none', cursor: 'pointer' }}>{tx.btnMetas}</button>
                  </div>
                  {metas.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', textAlign: 'center', padding: '1rem 0' }}>
                      {tx.emptyMeta}{' '}
                      <span style={{ color: tx.accentColor, cursor: 'pointer' }} onClick={() => router.push('/dashboard/metas')}>{tx.emptyMetaCta}</span>
                    </div>
                  ) : metas.map(m => {
                    const pct = Math.min(Math.round((m.valor_atual / m.valor_total) * 100), 100)
                    return (
                      <div key={m.id} style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 500, color: '#fff' }}>{m.nome}</span>
                          <span style={{ fontSize: 10, color: '#D4AF37' }}>{pct}%</span>
                        </div>
                        <div style={{ height: 5, background: 'rgba(255,255,255,.06)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: m ? 'linear-gradient(90deg, #8B6914, #D4AF37)' : `linear-gradient(90deg, ${cores.accent}88, ${cores.accent})`, borderRadius: 3 }} />
                        </div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', marginTop: 3 }}>{formatBRL(m.valor_atual)} de {formatBRL(m.valor_total)}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* EVOLUÇÃO */}
          {paginaAtiva === 'evolucao' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,minmax(0,1fr))', gap: 8, marginBottom: '1.25rem' }}>
                {[
                  { label: tx.evolTitulo, val: `Nv.${nivel.nivel}`,      cor: tx.accentColor },
                  { label: tx.evolXP,     val: String(xpTotal) + ' pts', cor: m ? '#F0C040' : cores.accent },
                  { label: 'Ranking',     val: 'top 30%',                cor: '#a78bfa' },
                  { label: nomeNivel,     val: `${nivel.pct}%`,          cor: nivel.cor },
                ].map(card => (
                  <div key={card.label} style={{ background: cores.surface, border: `1px solid ${cores.border}`, borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ fontSize: 10, color: cores.textMuted, marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: '.05em' }}>{card.label}</div>
                    <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 500, color: card.cor }}>{card.val}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: cores.cardBg, border: `1px solid ${cores.cardBorder}`, borderRadius: 12, padding: '1rem', boxShadow: cores.cardShadow }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: tx.accentMuted, textTransform: 'uppercase' as const, letterSpacing: '.08em', marginBottom: 14, fontFamily: tx.fontDisplay }}>{tx.secConq}</div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(5,minmax(0,1fr))', gap: 10 }}>
                  {[
                    { nome: 'Primeira conta', desc: 'Cadastrou-se',        conquistado: true,                   cor: '#D4AF37', bg: 'rgba(212,175,55,.15)' },
                    { nome: 'Primeiro gasto', desc: 'Registrou transação', conquistado: transacoes.length > 0,  cor: '#fbbf24', bg: 'rgba(251,191,36,.15)' },
                    { nome: 'Tesoureiro',      desc: 'Saldo positivo',      conquistado: saldo > 0,              cor: '#5A8A4A', bg: 'rgba(90,138,74,.15)' },
                    { nome: '5 transações',   desc: '5 registros',         conquistado: transacoes.length >= 5, cor: '#22d3ee', bg: 'rgba(34,211,238,.15)' },
                    { nome: 'Meta criada',    desc: 'Criou 1 meta',        conquistado: metas.length > 0,       cor: '#a78bfa', bg: 'rgba(167,139,250,.15)' },
                  ].map(c => (
                    <div key={c.nome} style={{ background: c.conquistado ? c.bg : 'rgba(255,255,255,.03)', border: `1px solid ${c.conquistado ? c.cor+'44' : '#1a3a1a'}`, borderRadius: 10, padding: 12, textAlign: 'center', opacity: c.conquistado ? 1 : 0.4 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: c.conquistado ? c.bg : 'rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2l1.5 4.5H14L10 9l1.5 4.5L8 11l-3.5 2.5L6 9 2 6.5h4.5L8 2z" stroke={c.conquistado ? c.cor : '#6b7280'} strokeWidth="1.2" strokeLinejoin="round"/></svg>
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 500, color: c.conquistado ? '#fff' : 'rgba(255,255,255,.3)' }}>{c.nome}</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', marginTop: 2 }}>{c.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Widget de prioridades — flutua sobre tudo */}
      {profile?.prioridades && profile.prioridades.length > 0 && (() => {
        const mediaMensal = receitas > 0
          ? Math.max(0, (receitas - despesas) / Math.max(1, new Set(transacoes.map(t => t.data_hora.slice(0, 7))).size))
          : 0
        return <PrioridadeWidget prioridades={profile.prioridades!} mediaMensalPoupada={mediaMensal} />
      })()}
    </div>
  )
}

function formatBRL(val: number) {
  return 'R$ ' + Math.abs(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function gerarInsights(transacoes: Transacao[], saldo: number) {
  const insights: { texto: string; icon: string; cor: string; bg: string }[] = []
  if (transacoes.length === 0) return insights

  const despesas = transacoes.filter(t => t.tipo === 'debito')
  const porCat   = despesas.reduce((acc, t) => { acc[t.categoria] = (acc[t.categoria] || 0) + Math.abs(t.valor); return acc }, {} as Record<string,number>)
  const topCat   = Object.entries(porCat).sort((a,b) => b[1]-a[1])[0]

  if (topCat)               insights.push({ texto: `Maior batalha: <strong>${topCat[0]}</strong> — ${formatBRL(topCat[1])} gastos.`, icon: 'M4.5 7.5l4 4', cor: '#c0392b', bg: 'rgba(139,0,0,.15)' })
  if (saldo > 0)            insights.push({ texto: `Tesouro positivo de <strong>${formatBRL(saldo)}</strong>. O reino prospera!`, icon: 'M1 7.5l3 3 6-6', cor: '#5A8A4A', bg: 'rgba(90,138,74,.15)' })
  if (despesas.length >= 3) insights.push({ texto: `<strong>${despesas.length} batalhas</strong> registradas nas crônicas do reino.`, icon: 'M1 4h8M1 7h5', cor: '#8B6914', bg: 'rgba(139,105,20,.15)' })

  return insights
}