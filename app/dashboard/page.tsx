'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import PoupaUpLogo from '@/components/PoupaUpLogo'
import SinoNotificacoes from '@/components/SinoNotificacoes'
import Avatar from '@/components/Avatar'
import MissoesWidget from '@/components/MissoesWidget'
import { usePerfil } from '@/hooks/usePerfil'
import { calcularXP, calcularNivel } from '@/lib/calcularXP'

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

export default function Dashboard() {
  const router = useRouter()
  const supabase = createClient()
  const { fmtData, timezone, idioma } = usePerfil()
  const isMobile = useIsMobile()

  const [profile, setProfile]       = useState<Profile | null>(null)
  const [transacoes, setTransacoes] = useState<Transacao[]>([])
  const [metas, setMetas]           = useState<Meta[]>([])
  const [contas, setContas]         = useState<Conta[]>([])
  const [loading, setLoading]       = useState(true)
  const [paginaAtiva, setPagina]    = useState('inicio')

  // Em mobile sidebar começa fechada, em desktop aberta
  const [sidebarAberta, setSidebar] = useState(true)

useEffect(() => {
  setSidebar(!isMobile) // eslint-disable-line react-hooks/set-state-in-effect
}, [isMobile])

  const xp           = calcularXP({ transacoes, metas })
  const { receitas, despesas, saldo } = xp
  const xpTotal      = xp.xpTotal
  const nivel        = calcularNivel(xpTotal)

  const porCategoria = transacoes.filter(t => t.tipo === 'debito').reduce((acc, t) => {
    acc[t.categoria] = (acc[t.categoria] || 0) + Math.abs(t.valor); return acc
  }, {} as Record<string, number>)
  const maxCategoria = Math.max(...Object.values(porCategoria), 1)
  const insights     = gerarInsights(transacoes, saldo)

  const carregarDados = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const [{ data: prof }, { data: tx }, { data: mt }] = await Promise.all([
      supabase.from('profiles').select('nome, plano, avatar_url').eq('id', user.id).single(),
      supabase.from('transactions').select('*').eq('user_id', user.id).order('data_hora', { ascending: false }),
      supabase.from('goals').select('*').eq('user_id', user.id).eq('ativo', true).limit(4),
    ])

    if (prof) setProfile(prof)
    if (tx)   setTransacoes(tx)
    if (mt)   setMetas(mt)

    const contasRes   = await fetch('/api/contas')
    const contasDados = await contasRes.json()
    setContas(contasDados.contas || [])
    setLoading(false)
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
    <div style={{ minHeight: '100vh', background: '#080b0f', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, fontFamily: 'system-ui, sans-serif' }}>
      <PoupaUpLogo mode="compact" />
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)' }}>Carregando...</div>
    </div>
  )

  const NAV_ITEMS = [
    { id: 'inicio',       label: 'Início',       icon: 'M3 9l4-4 4 4 4-4' },
    { id: 'lancamento',   label: 'Lançamento',   icon: 'M6 1v12M1 6h10',                href: '/dashboard/lancamento' },
    { id: 'gastos',       label: 'Gastos',       icon: 'M2 4h10M2 7h7M2 10h5',         href: '/dashboard/gastos' },
    { id: 'metas',        label: 'Metas',        icon: 'M7 1l1.5 4H13l-4 3 1.5 4L7 10l-4 2.5L4.5 8 .5 5H5z', href: '/dashboard/metas' },
    { id: 'ia',           label: 'Assistente IA',icon: 'M2 7a5 5 0 0 1 10 0',          href: '/dashboard/ia' },
    { id: 'notificacoes', label: 'Notificações', icon: 'M7 2a4 4 0 00-4 4v2l-1 1v1h10v-1l-1-1V6a4 4 0 00-4-4zM5.5 12a1.5 1.5 0 003 0', href: '/dashboard/notificacoes' },
    { id: 'evolucao',     label: 'Evolução',     icon: 'M2 10l3-3 3 3 4-6',            href: '/dashboard/evolucao' },
    { id: 'contas',       label: 'Contas',       icon: 'M2 4h10a1 1 0 011 1v7a1 1 0 01-1 1H2a1 1 0 01-1-1V5a1 1 0 011-1zM1 7h12', href: '/dashboard/contas' },
  ]

  // largura do sidebar — em mobile sempre 200 quando aberto (drawer), em desktop colapsa para 56
  const sidebarWidth = isMobile ? 200 : (sidebarAberta ? 200 : 56)
  const collapsed    = !isMobile && !sidebarAberta

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#080b0f', fontFamily: 'system-ui, sans-serif', fontSize: 13, position: 'relative' }}>

      {/* Overlay escuro em mobile quando sidebar aberta */}
      {isMobile && sidebarAberta && (
        <div
          onClick={() => setSidebar(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 40 }}
        />
      )}

      {/* ── Sidebar ── */}
      <aside style={{
        width: sidebarWidth,
        background: 'linear-gradient(180deg, #0a1205 0%, #080b0f 100%)',
        borderRight: '1px solid #1e2d1e',
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
        <div style={{ padding: '1rem', borderBottom: '1px solid #1e2d1e', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start' }}>
          <LogoPoupaUp collapsed={collapsed} />
        </div>

        {/* Perfil resumido */}
        {!collapsed && profile && (
          <div
            onClick={() => router.push('/dashboard/perfil')}
            style={{ padding: '10px 1rem', borderBottom: '1px solid #1e2d1e', display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}
          >
            <Avatar url={profile.avatar_url} nome={profile.nome || 'U'} size={30} nivel={nivel.nivel} onClick={undefined} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile.nome}</div>
              <div style={{ fontSize: 9, color: nivel.cor, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em' }}>⚔ {nivel.nome}</div>
            </div>
          </div>
        )}

        <nav style={{ flex: 1, padding: '0.5rem 0', overflowY: 'auto' }}>
          {/* Separador "Câmara Real" */}
          {!collapsed && (
            <div style={{ padding: '6px 1rem 4px', fontSize: 9, color: 'rgba(212,160,23,.4)', textTransform: 'uppercase', letterSpacing: '.15em', fontFamily: 'var(--font-cinzel, Georgia, serif)' }}>
              Câmara Real
            </div>
          )}

          {NAV_ITEMS.slice(0, 4).map(item => (
            <button key={item.id}
              onClick={() => {
                if ('href' in item && item.href) router.push(item.href)
                else setPagina(item.id)
                if (isMobile) setSidebar(false)
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: !collapsed ? '7px 1rem' : '7px 14px',
                width: '100%',
                background: paginaAtiva === item.id ? 'rgba(74,222,128,.1)' : 'transparent',
                border: 'none',
                borderLeft: paginaAtiva === item.id ? '2px solid #4ade80' : '2px solid transparent',
                cursor: 'pointer',
                color: paginaAtiva === item.id ? '#4ade80' : 'rgba(255,255,255,.45)',
                fontSize: 12, fontWeight: paginaAtiva === item.id ? 500 : 400,
                transition: 'all .15s', textAlign: 'left', whiteSpace: 'nowrap',
              }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                <path d={item.icon} stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {!collapsed && item.label}
            </button>
          ))}

          {/* Separador "Salão do Herói" */}
          {!collapsed && (
            <div style={{ padding: '10px 1rem 4px', fontSize: 9, color: 'rgba(212,160,23,.4)', textTransform: 'uppercase', letterSpacing: '.15em', fontFamily: 'var(--font-cinzel, Georgia, serif)' }}>
              Salão do Herói
            </div>
          )}
          {collapsed && <div style={{ height: 1, background: '#1e2d1e', margin: '6px 10px' }} />}

          {NAV_ITEMS.slice(4).map(item => (
            <button key={item.id}
              onClick={() => {
                if ('href' in item && item.href) router.push(item.href)
                else setPagina(item.id)
                if (isMobile) setSidebar(false)
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: !collapsed ? '7px 1rem' : '7px 14px',
                width: '100%',
                background: paginaAtiva === item.id ? 'rgba(74,222,128,.1)' : 'transparent',
                border: 'none',
                borderLeft: paginaAtiva === item.id ? '2px solid #4ade80' : '2px solid transparent',
                cursor: 'pointer',
                color: paginaAtiva === item.id ? '#4ade80' : 'rgba(255,255,255,.45)',
                fontSize: 12, fontWeight: paginaAtiva === item.id ? 500 : 400,
                transition: 'all .15s', textAlign: 'left', whiteSpace: 'nowrap',
              }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                <path d={item.icon} stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {!collapsed && item.label}
            </button>
          ))}
        </nav>

        {!collapsed && (
          <div
            onClick={() => router.push('/dashboard/evolucao')}
            style={{ margin: '0 .75rem 1rem', background: 'rgba(0,0,0,.3)', border: `1px solid ${nivel.cor}33`, borderRadius: 10, padding: '10px 12px', cursor: 'pointer', transition: 'border-color .2s' }}
          >
            {/* Título do nível */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 9, color: nivel.cor, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em' }}>⚔ {nivel.nome}</span>
              </div>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,.3)', fontVariantNumeric: 'tabular-nums' }}>Lv.{nivel.nivel}</span>
            </div>
            {/* Barra shimmer */}
            <div style={{ height: 6, background: 'rgba(255,255,255,.06)', borderRadius: 999, overflow: 'hidden', border: `1px solid ${nivel.cor}22` }}>
              <div style={{
                height: '100%',
                width: `${nivel.pct}%`,
                borderRadius: 999,
                background: `linear-gradient(90deg, ${nivel.cor}88, ${nivel.cor}, #d4a017)`,
                backgroundSize: '200% 100%',
                animation: 'xp-shimmer 3s linear infinite',
                transition: 'width .8s cubic-bezier(0.34,1.56,0.64,1)',
              }} />
            </div>
            {/* XP */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,.3)', fontVariantNumeric: 'tabular-nums' }}>{nivel.xpNoNivel.toLocaleString()} XP</span>
              {nivel.proximoNivel
                ? <span style={{ fontSize: 9, color: 'rgba(255,255,255,.2)' }}>falta {(nivel.xpParaProximo - nivel.xpNoNivel).toLocaleString()} p/ {nivel.proximoNivel.nome}</span>
                : <span style={{ fontSize: 9, color: '#d4a017' }}>👑 Rei</span>
              }
            </div>
          </div>
        )}

        <button onClick={sair} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: !collapsed ? '10px 1rem' : '10px 14px',
          background: 'transparent', border: 'none', borderTop: '1px solid #1a3a1a',
          color: 'rgba(255,255,255,.3)', cursor: 'pointer', fontSize: 12, width: '100%',
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.875rem 1rem', borderBottom: '1px solid #1e2d1e', background: 'linear-gradient(90deg, #0a1205, #080b0f)', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => setSidebar(!sidebarAberta)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.4)', padding: 4, flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
            </button>
            <div>
              <span style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>
                {{ inicio: 'Início', evolucao: 'Evolução' }[paginaAtiva] || 'PoupaUp'}
              </span>
              {paginaAtiva === 'inicio' && !isMobile && (
                <span style={{ marginLeft: 8, fontSize: 10, color: nivel.cor, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'var(--font-cinzel, Georgia, serif)' }}>
                  ⚔ {nivel.nome}
                </span>
              )}
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

          {/* INÍCIO */}
          {paginaAtiva === 'inicio' && (
            <div>
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 500, color: '#fff', marginBottom: 2 }}>
                  Olá, {profile?.nome || 'usuário'} 👋
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)' }}>
                  {new Intl.DateTimeFormat(idioma, { weekday: 'long', day: 'numeric', month: 'long', timeZone: timezone }).format(new Date())}
                </div>
              </div>

              {/* Cards métricas — 2 colunas em mobile, 4 em desktop */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,minmax(0,1fr))', gap: 8, marginBottom: '1rem' }}>
                {[
                  { label: 'Saldo',    val: formatBRL(saldo),    cor: saldo >= 0 ? '#4ade80' : '#f87171', icone: saldo >= 0 ? '💰' : '⚠️' },
                  { label: 'Receitas', val: formatBRL(receitas), cor: '#4ade80',  icone: '📈' },
                  { label: 'Gastos',   val: formatBRL(despesas), cor: '#f87171',  icone: '📉' },
                  { label: 'XP total', val: `${xpTotal} XP`,    cor: '#d4a017',  icone: '⚔' },
                ].map(m => (
                  <div key={m.label} style={{
                    background: 'linear-gradient(145deg, #0d1117, #111820)',
                    border: '1px solid #1e2d1e',
                    borderRadius: 10,
                    padding: '10px 12px',
                    boxShadow: 'inset 0 1px 0 rgba(212,160,23,.04)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 9, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{m.label}</span>
                      <span style={{ fontSize: 12 }}>{m.icone}</span>
                    </div>
                    <div style={{ fontSize: isMobile ? 14 : 18, fontWeight: 600, color: m.cor, wordBreak: 'break-all', fontVariantNumeric: 'tabular-nums' }}>{m.val}</div>
                  </div>
                ))}
              </div>

              {/* Saldos por conta */}
              {contas.length > 0 && (
                <div style={{ background: 'linear-gradient(145deg, #0d1117, #111820)', border: '1px solid #1e2d1e', borderRadius: 12, padding: '1rem', boxShadow: 'inset 0 1px 0 rgba(212,160,23,.04)', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,.5)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Saldos por conta</span>
                    <button onClick={() => router.push('/dashboard/contas')} style={{ fontSize: 11, color: '#4ade80', background: 'none', border: 'none', cursor: 'pointer' }}>ver detalhes →</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {contas.slice(0, 4).map(c => (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: c.bancos?.cor || '#4ade80', flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: 12, color: 'rgba(255,255,255,.7)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nome}</span>
                        <span style={{ fontSize: 12, fontWeight: 500, color: c.saldo >= 0 ? '#4ade80' : '#f87171', flexShrink: 0 }}>
                          {c.mostrar_saldo ? `R$ ${c.saldo.toFixed(2).replace('.', ',')}` : '••••••'}
                        </span>
                      </div>
                    ))}
                    {contas.length > 4 && (
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', textAlign: 'center' }}>+{contas.length - 4} contas</div>
                    )}
                    <div style={{ borderTop: '1px solid #1a3a1a', paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>Total</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#4ade80' }}>
                        R$ {contas.reduce((a, c) => a + (c.mostrar_saldo ? c.saldo : 0), 0).toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Insights + Por categoria — coluna única em mobile */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 220px', gap: 10, marginBottom: 10 }}>
                <div style={{ background: 'linear-gradient(145deg, #0d1117, #111820)', border: '1px solid #1e2d1e', borderRadius: 12, padding: '1rem', boxShadow: 'inset 0 1px 0 rgba(212,160,23,.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,.5)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Insights</span>
                    <span style={{ fontSize: 10, background: 'rgba(74,222,128,.15)', color: '#4ade80', padding: '2px 8px', borderRadius: 4 }}>{insights.length} novos</span>
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

                <div style={{ background: 'linear-gradient(145deg, #0d1117, #111820)', border: '1px solid #1e2d1e', borderRadius: 12, padding: '1rem', boxShadow: 'inset 0 1px 0 rgba(212,160,23,.04)' }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,.5)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>Por categoria</div>
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

              {/* Missões */}
              <div style={{ marginBottom: 10 }}>
                <MissoesWidget />
              </div>

              {/* Últimas transações + Metas — coluna única em mobile */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
                <div style={{ background: 'linear-gradient(145deg, #0d1117, #111820)', border: '1px solid #1e2d1e', borderRadius: 12, padding: '1rem', boxShadow: 'inset 0 1px 0 rgba(212,160,23,.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,.5)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Últimas transações</span>
                    <button onClick={() => router.push('/dashboard/gastos')} style={{ fontSize: 11, color: '#4ade80', background: 'none', border: 'none', cursor: 'pointer' }}>ver todas</button>
                  </div>
                  {transacoes.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', textAlign: 'center', padding: '1rem 0' }}>
                      Nenhuma transação ainda.{' '}
                      <span style={{ color: '#4ade80', cursor: 'pointer' }} onClick={() => router.push('/dashboard/lancamento')}>Lançar agora →</span>
                    </div>
                  ) : transacoes.slice(0, 5).map(t => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid #1a2a1a' }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: CORES[t.categoria] || '#6b7280', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.descricao}</div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)' }}>{t.categoria} · {fmtData(t.data_hora)}</div>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: t.tipo === 'credito' ? '#4ade80' : '#f87171', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {t.tipo === 'credito' ? '+' : '-'}{formatBRL(Math.abs(t.valor))}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ background: 'linear-gradient(145deg, #0d1117, #111820)', border: '1px solid #1e2d1e', borderRadius: 12, padding: '1rem', boxShadow: 'inset 0 1px 0 rgba(212,160,23,.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,.5)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Metas</span>
                    <button onClick={() => router.push('/dashboard/metas')} style={{ fontSize: 11, color: '#4ade80', background: 'none', border: 'none', cursor: 'pointer' }}>ver todas</button>
                  </div>
                  {metas.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', textAlign: 'center', padding: '1rem 0' }}>
                      Nenhuma meta.{' '}
                      <span style={{ color: '#4ade80', cursor: 'pointer' }} onClick={() => router.push('/dashboard/metas')}>Criar agora →</span>
                    </div>
                  ) : metas.map(m => {
                    const pct = Math.min(Math.round((m.valor_atual / m.valor_total) * 100), 100)
                    return (
                      <div key={m.id} style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 500, color: '#fff' }}>{m.nome}</span>
                          <span style={{ fontSize: 10, color: '#4ade80' }}>{pct}%</span>
                        </div>
                        <div style={{ height: 5, background: 'rgba(255,255,255,.06)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: '#16a34a', borderRadius: 3 }} />
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
                  { label: 'Nível',    val: `Lv.${nivel.nivel}`, cor: '#4ade80' },
                  { label: 'XP total', val: String(xpTotal),     cor: '#fbbf24' },
                  { label: 'Ranking',  val: 'top 30%',           cor: '#a78bfa' },
                  { label: nivel.nome, val: `${nivel.pct}%`,     cor: '#22d3ee' },
                ].map(m => (
                  <div key={m.label} style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>{m.label}</div>
                    <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 500, color: m.cor }}>{m.val}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: 'linear-gradient(145deg, #0d1117, #111820)', border: '1px solid #1e2d1e', borderRadius: 12, padding: '1rem', boxShadow: 'inset 0 1px 0 rgba(212,160,23,.04)' }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,.5)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 14 }}>Conquistas</div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(5,minmax(0,1fr))', gap: 10 }}>
                  {[
                    { nome: 'Primeira conta', desc: 'Cadastrou-se',        conquistado: true,                   cor: '#4ade80', bg: 'rgba(74,222,128,.15)' },
                    { nome: 'Primeiro gasto', desc: 'Registrou transação', conquistado: transacoes.length > 0,  cor: '#fbbf24', bg: 'rgba(251,191,36,.15)' },
                    { nome: 'Poupador',       desc: 'Saldo positivo',      conquistado: saldo > 0,              cor: '#4ade80', bg: 'rgba(74,222,128,.15)' },
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

  if (topCat)               insights.push({ texto: `Maior categoria: <strong>${topCat[0]}</strong> com ${formatBRL(topCat[1])}.`, icon: 'M4.5 7.5l4 4', cor: '#f97316', bg: 'rgba(249,115,22,.15)' })
  if (saldo > 0)            insights.push({ texto: `Saldo positivo de <strong>${formatBRL(saldo)}</strong>. Ótimo caminho!`, icon: 'M1 7.5l3 3 6-6', cor: '#4ade80', bg: 'rgba(74,222,128,.15)' })
  if (despesas.length >= 3) insights.push({ texto: `<strong>${despesas.length} transações</strong> registradas este período.`, icon: 'M1 4h8M1 7h5', cor: '#22d3ee', bg: 'rgba(34,211,238,.15)' })

  return insights
}