'use client'

import { useCallback, useEffect, useState } from 'react'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { calcularXP, calcularNivel, NIVEIS } from '@/lib/calcularXP'
import { CONQUISTAS } from '@/lib/conquistas'
import ExtratoXP from '@/components/ExtratoXP'

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
  ativo: boolean
}

interface MembroRanking {
  nome: string
  avatar_url?: string | null
  xp: number
  nivel: number
  nomeNivel: string
  cor: string
}

function Avatar({ nome, url, size = 32, cor }: { nome: string; url?: string | null; size?: number; cor: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  if (url) return <img src={url} alt={nome} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${cor}` }} />
  const initials = nome.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: `${cor}22`, border: `2px solid ${cor}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35, fontWeight: 700, color: cor, flexShrink: 0 }}>
      {initials}
    </div>
  )
}

const MEDALHAS = ['👑', '⚔️', '🛡️', '🗡️', '🏹']

export default function EvolucaoPage() {
  const router = useRouter()
  const supabase = createClient()

  const [transacoes, setTransacoes] = useState<Transacao[]>([])
  const [metas, setMetas]           = useState<Meta[]>([])
  const [nome, setNome]             = useState('')
  const [loading, setLoading]       = useState(true)
  const isMobile = useIsMobile(640)
  const [abaSel, setAbaSel]         = useState<'visao' | 'conquistas' | 'ranking'>('visao')
  const [ranking, setRanking]       = useState<MembroRanking[]>([])
  const [rankingLoading, setRankingLoading] = useState(false)
  const [extratoAberto, setExtrato] = useState(false)

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const [{ data: tx }, { data: mt }, { data: prof }] = await Promise.all([
      supabase.from('transactions').select('*').eq('user_id', user.id).order('data_hora', { ascending: false }),
      supabase.from('goals').select('*').eq('user_id', user.id),
      supabase.from('profiles').select('nome').eq('id', user.id).single(),
    ])

    if (tx) setTransacoes(tx)
    if (mt) setMetas(mt)
    if (prof) setNome(prof.nome)
    setLoading(false)
  }, [supabase, router])

  const carregarRanking = useCallback(async () => {
    setRankingLoading(true)
    try {
      const res = await fetch('/api/grupo/ranking')
      if (res.ok) {
        const data = await res.json()
        setRanking(data.ranking || [])
      }
    } finally {
      setRankingLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar()
  }, [carregar])

  useEffect(() => {
    if (abaSel === 'ranking') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      carregarRanking()
    }
  }, [abaSel, carregarRanking])

  const xp         = calcularXP({ transacoes, metas })
  const { saldo, xpTotal, xpTransacoes, xpSaldo, xpMetas: xpMetasTotal } = xp
  const nivel      = calcularNivel(xpTotal)

  // Mapear conquistas com estado desbloqueado
  const conquistasComEstado = CONQUISTAS.map(c => {
    let conquistado = false
    let progresso: number | undefined
    let total: number | undefined

    switch (c.id) {
      case 'welcome':          conquistado = true; break
      case 'first_tx':         conquistado = transacoes.length >= 1;   progresso = Math.min(transacoes.length, 1);   total = 1;   break
      case 'streak_7':         conquistado = false; break
      case 'streak_30':        conquistado = false; break
      case 'tx_50':            conquistado = transacoes.length >= 50;  progresso = Math.min(transacoes.length, 50);  total = 50;  break
      case 'tx_100':           conquistado = transacoes.length >= 100; progresso = Math.min(transacoes.length, 100); total = 100; break
      case 'leveled':          conquistado = nivel.nivel >= 2; break
      case 'positive_bal':     conquistado = saldo > 0; break
      case 'budget_week':      conquistado = false; break
      case 'perfect_month':    conquistado = false; break
      case 'no_debt':          conquistado = false; break
      case 'first_goal':       conquistado = metas.length >= 1; progresso = Math.min(metas.length, 1); total = 1; break
      case 'goal_done':        conquistado = metas.filter(m => m.valor_atual >= m.valor_total).length >= 1; break
      case 'multi_goals':      conquistado = metas.filter(m => m.ativo).length >= 3; progresso = Math.min(metas.filter(m => m.ativo).length, 3); total = 3; break
      case 'big_saver':        conquistado = saldo >= 1000; break
      case 'investor':         conquistado = saldo >= 5000; break
      case 'group_invite':     conquistado = false; break
      case 'upload_1':         conquistado = false; break
      case 'dedicated':        conquistado = false; break
      case 'profile_complete': conquistado = false; break
    }

    return { ...c, conquistado, progresso, total }
  })

  const conquistadas    = conquistasComEstado.filter(c => c.conquistado)
  const naoConquistadas = conquistasComEstado.filter(c => !c.conquistado)
  const xpConquistas    = conquistadas.reduce((a, c) => a + c.xp, 0)

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#080b0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', fontFamily: 'system-ui, sans-serif' }}>Carregando o reino...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#080b0f', fontFamily: 'system-ui, sans-serif', fontSize: 13, color: '#fff' }}>

      {extratoAberto && (
        <ExtratoXP
          xpTotal={xpTotal}
          xpSaldo={xp.xpSaldo}
          xpBonus={0}
          saldo={saldo}
          transacoes={transacoes}
          metas={metas}
          onFechar={() => setExtrato(false)}
        />
      )}

      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.875rem 1.5rem', borderBottom: '1px solid #1e2d1e', background: '#0a1205' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.4)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Dashboard
          </button>
          <span style={{ color: 'rgba(255,255,255,.2)' }}>/</span>
          <span style={{ fontSize: 15, fontWeight: 600, fontFamily: 'var(--font-cinzel, Georgia, serif)', letterSpacing: '.03em' }}>Evolução</span>
        </div>
        {/* Total XP badge — clicável para abrir extrato */}
        <button
          onClick={() => setExtrato(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(212,160,23,.1)', border: '1px solid rgba(212,160,23,.25)', borderRadius: 20, padding: '4px 12px', cursor: 'pointer', transition: 'all .15s' }}
          title="Ver extrato de XP"
        >
          <span style={{ fontSize: 12 }}>⚔</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#d4a017' }}>{xpTotal.toLocaleString()} XP</span>
          <span style={{ fontSize: 10, color: 'rgba(212,160,23,.6)' }}>↗</span>
        </button>
      </div>

      <div style={{ maxWidth: 880, margin: '0 auto', padding: '1.5rem' }}>

        {/* ── Card herói — nível atual ── */}
        <div style={{
          background: `linear-gradient(135deg, #0d1117 0%, ${nivel.cor}14 60%, ${nivel.cor}08 100%)`,
          border: `1px solid ${nivel.cor}33`,
          borderRadius: 16,
          padding: '1.75rem',
          marginBottom: '1.5rem',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: `inset 0 1px 0 rgba(212,160,23,.06), 0 4px 32px rgba(0,0,0,.6)`,
        }}>
          {/* Orbe decorativo */}
          <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: `radial-gradient(circle, ${nivel.cor}10 0%, transparent 70%)`, pointerEvents: 'none' }} />

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 6, fontFamily: 'var(--font-cinzel, Georgia, serif)' }}>
                ⚔ Sua Posição no Reino
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <span style={{ fontSize: 42, fontWeight: 900, color: nivel.cor, lineHeight: 1, fontFamily: 'var(--font-cinzel, Georgia, serif)' }}>
                  {nivel.nome}
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginTop: 6, fontStyle: 'italic' }}>
                &ldquo;{nivel.titulo}&rdquo;
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', marginTop: 8 }}>
                Olá, <strong style={{ color: '#fff' }}>{nome}</strong> — Lv.{nivel.nivel} conquistado.
              </div>
            </div>
            <button
              onClick={() => setExtrato(true)}
              style={{ textAlign: 'right', flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              title="Ver extrato de XP"
            >
              <div style={{ fontSize: 32, fontWeight: 800, color: '#d4a017', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{xpTotal.toLocaleString()}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 3 }}>XP total · ver extrato ↗</div>
            </button>
          </div>

          {/* Barra de XP RPG */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', fontVariantNumeric: 'tabular-nums' }}>
                {nivel.xpNoNivel.toLocaleString()} / {nivel.xpParaProximo.toLocaleString()} XP
              </span>
              {nivel.proximoNivel ? (
                <span style={{ fontSize: 11, color: nivel.cor }}>
                  Próximo: <strong>{nivel.proximoNivel.nome}</strong>
                </span>
              ) : (
                <span style={{ fontSize: 11, color: '#d4a017' }}>👑 Nível máximo!</span>
              )}
            </div>
            <div style={{ height: 12, background: 'rgba(255,255,255,.05)', borderRadius: 999, overflow: 'hidden', border: `1px solid ${nivel.cor}22` }}>
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
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.25)', marginTop: 5 }}>
              {nivel.proximoNivel
                ? `✦ Faltam ${(nivel.xpParaProximo - nivel.xpNoNivel).toLocaleString()} XP para ascender a ${nivel.proximoNivel.nome}`
                : '✦ Você chegou ao topo do reino!'
              }
            </div>
          </div>
        </div>

        {/* ── Cards de fontes XP ── */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,minmax(0,1fr))' : 'repeat(4,minmax(0,1fr))', gap: 10, marginBottom: '1.5rem' }}>
          {[
            { label: 'Transações',  val: xpTransacoes, desc: `${transacoes.length} registros × 10`, cor: '#4ade80',  icone: '📝' },
            { label: 'Saldo',       val: xpSaldo,      desc: `R$ ${Math.abs(saldo).toFixed(0)} ÷ 10`, cor: saldo >= 0 ? '#22d3ee' : '#f87171', icone: saldo >= 0 ? '💎' : '⚠️' },
            { label: 'Metas',       val: xpMetasTotal, desc: `${metas.filter(m => m.ativo).length} ativas + ${metas.filter(m => m.valor_atual >= m.valor_total).length} concl.`, cor: '#a78bfa', icone: '🎯' },
            { label: 'Conquistas',  val: xpConquistas, desc: `${conquistadas.length}/${CONQUISTAS.length} desbloq.`, cor: '#d4a017', icone: '🏆' },
          ].map(m => (
            <div key={m.label} style={{ background: 'linear-gradient(145deg, #0d1117, #111820)', border: '1px solid #1e2d1e', borderRadius: 10, padding: '12px 14px', boxShadow: 'inset 0 1px 0 rgba(212,160,23,.04)' }}>
              <div style={{ fontSize: 16, marginBottom: 4 }}>{m.icone}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '.04em' }}>{m.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: m.cor, marginBottom: 2, fontVariantNumeric: 'tabular-nums' }}>+{m.val.toLocaleString()}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.25)' }}>{m.desc}</div>
            </div>
          ))}
        </div>

        {/* ── Abas ── */}
        <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,.4)', border: '1px solid #1e2d1e', borderRadius: 8, padding: 3, marginBottom: '1.25rem', width: 'fit-content' }}>
          {([
            { id: 'visao',      label: '⚔ Jornada' },
            { id: 'conquistas', label: `🏆 Brasões (${conquistadas.length}/${CONQUISTAS.length})` },
            { id: 'ranking',    label: '👑 Ranking do Clã' },
          ] as const).map(a => (
            <button key={a.id} onClick={() => setAbaSel(a.id)} style={{
              padding: '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
              background: abaSel === a.id ? '#16a34a' : 'transparent',
              color: abaSel === a.id ? '#fff' : 'rgba(255,255,255,.4)',
              transition: 'all .15s',
            }}>{a.label}</button>
          ))}
        </div>

        {/* ── JORNADA (visão geral) ── */}
        {abaSel === 'visao' && (
          <div style={{ display: 'grid', gap: 12 }}>
            {/* Mapa de níveis */}
            <div style={{ background: 'linear-gradient(145deg, #0d1117, #111820)', border: '1px solid #1e2d1e', borderRadius: 12, padding: '1.25rem', boxShadow: 'inset 0 1px 0 rgba(212,160,23,.04)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 16, fontFamily: 'var(--font-cinzel, Georgia, serif)' }}>
                ✦ Mapa do Reino ✦
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {NIVEIS.map((n, i) => {
                  const atingido = xpTotal >= n.min
                  const atual    = nivel.nivel === n.nivel
                  return (
                    <div key={n.nivel} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                        background: atingido ? `${n.cor}18` : 'rgba(255,255,255,.03)',
                        border: `2px solid ${atual ? n.cor : atingido ? n.cor + '55' : '#1e2d1e'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 800, color: atingido ? n.cor : 'rgba(255,255,255,.15)',
                        fontFamily: 'var(--font-cinzel, Georgia, serif)',
                        boxShadow: atual ? `0 0 16px ${n.cor}44` : 'none',
                        transition: 'box-shadow .3s',
                      }}>
                        {n.nivel}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13, fontWeight: atual ? 700 : 400, color: atingido ? '#fff' : 'rgba(255,255,255,.25)', fontFamily: atual ? 'var(--font-cinzel, Georgia, serif)' : 'inherit' }}>{n.nome}</span>
                          {atual && <span style={{ fontSize: 9, background: `${n.cor}22`, color: n.cor, padding: '2px 8px', borderRadius: 8, fontWeight: 700, border: `1px solid ${n.cor}33` }}>ATUAL</span>}
                          {atingido && !atual && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><polyline points="1.5,6 4.5,9 10.5,3" stroke={n.cor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,.25)', fontStyle: 'italic', marginTop: 1 }}>{n.titulo}</div>
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,.2)', marginTop: 1 }}>
                          {n.min.toLocaleString()} XP{NIVEIS[i + 1] ? ` — ${(NIVEIS[i + 1].min - 1).toLocaleString()} XP` : '+'}
                        </div>
                      </div>
                      {atual && (
                        <div style={{ fontSize: 12, color: n.cor, fontWeight: 700, flexShrink: 0 }}>{nivel.pct}%</div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Como ganhar XP */}
            <div style={{ background: 'linear-gradient(145deg, #0d1117, #111820)', border: '1px solid #1e2d1e', borderRadius: 12, padding: '1.25rem', boxShadow: 'inset 0 1px 0 rgba(212,160,23,.04)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 14, fontFamily: 'var(--font-cinzel, Georgia, serif)' }}>
                ✦ Fontes de Poder ✦
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { icone: '📝', acao: 'Registrar transação',      xp: '+10 XP' },
                  { icone: '💎', acao: 'Manter saldo positivo',     xp: 'saldo ÷ 10' },
                  { icone: '🎯', acao: 'Criar uma meta',            xp: '+50 XP' },
                  { icone: '⭐', acao: 'Concluir uma meta',         xp: '+200 XP' },
                  { icone: '📄', acao: 'Upload de extrato',         xp: '+50 XP' },
                  { icone: '🏆', acao: 'Desbloquear brasão',        xp: '+20–500 XP' },
                ].map(item => (
                  <div key={item.acao} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'rgba(255,255,255,.03)', borderRadius: 8, border: '1px solid #1e2d1e' }}>
                    <span style={{ fontSize: 18 }}>{item.icone}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,.65)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.acao}</div>
                      <div style={{ fontSize: 11, color: '#4ade80', fontWeight: 600 }}>{item.xp}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── BRASÕES (conquistas) ── */}
        {abaSel === 'conquistas' && (
          <div>
            {conquistadas.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12, fontFamily: 'var(--font-cinzel, Georgia, serif)' }}>
                  ✦ Brasões Conquistados ({conquistadas.length})
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                  {conquistadas.map(c => (
                    <div key={c.id} style={{
                      background: 'linear-gradient(145deg, rgba(74,222,128,.07), rgba(74,222,128,.03))',
                      border: '1px solid rgba(74,222,128,.2)',
                      borderRadius: 12,
                      padding: '14px',
                      display: 'flex',
                      gap: 12,
                      alignItems: 'flex-start',
                      boxShadow: 'inset 0 1px 0 rgba(74,222,128,.08)',
                    }}>
                      <div style={{ fontSize: 30, flexShrink: 0, lineHeight: 1 }}>{c.icone}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 2, fontFamily: 'var(--font-cinzel, Georgia, serif)', letterSpacing: '.02em' }}>{c.nome}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.45)', marginBottom: 6, lineHeight: 1.4 }}>{c.descricao}</div>
                        <div style={{ fontSize: 11, color: '#4ade80', fontWeight: 600 }}>+{c.xp} XP</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {naoConquistadas.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12, fontFamily: 'var(--font-cinzel, Georgia, serif)' }}>
                  🔒 Brasões Bloqueados ({naoConquistadas.length})
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                  {naoConquistadas.map(c => (
                    <div key={c.id} style={{
                      background: 'rgba(255,255,255,.02)',
                      border: '1px solid #1e2d1e',
                      borderRadius: 12,
                      padding: '14px',
                      display: 'flex',
                      gap: 12,
                      alignItems: 'flex-start',
                      opacity: 0.55,
                    }}>
                      <div style={{ fontSize: 30, flexShrink: 0, lineHeight: 1, filter: 'grayscale(1) brightness(.5)' }}>{c.icone}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.4)', marginBottom: 2, fontFamily: 'var(--font-cinzel, Georgia, serif)' }}>{c.nome}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.25)', marginBottom: 6, lineHeight: 1.4 }}>{c.descricao}</div>
                        {c.progresso !== undefined && c.total !== undefined && (
                          <>
                            <div style={{ height: 4, background: 'rgba(255,255,255,.06)', borderRadius: 2, overflow: 'hidden', marginBottom: 3 }}>
                              <div style={{ height: '100%', width: `${Math.round((c.progresso / c.total) * 100)}%`, background: '#4ade80', borderRadius: 2 }} />
                            </div>
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.25)', marginBottom: 4 }}>{c.progresso}/{c.total}</div>
                          </>
                        )}
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.25)' }}>+{c.xp} XP</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── RANKING DO CLÃ ── */}
        {abaSel === 'ranking' && (
          <div style={{ background: 'linear-gradient(145deg, #0d1117, #111820)', border: '1px solid #1e2d1e', borderRadius: 12, padding: '1.25rem', boxShadow: 'inset 0 1px 0 rgba(212,160,23,.04)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 16, fontFamily: 'var(--font-cinzel, Georgia, serif)' }}>
              ✦ Ranking do Clã ✦
            </div>

            {rankingLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'rgba(255,255,255,.3)', fontSize: 13 }}>
                Convocando guerreiros...
              </div>
            ) : ranking.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>⚔️</div>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,.5)', marginBottom: 6 }}>Seu clã está vazio</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)' }}>Convide membros da família em <strong style={{ color: '#4ade80' }}>Perfil → Grupo</strong> para disputar o ranking</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ranking.map((membro, i) => {
                  const isFirst = i === 0
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 14px',
                      background: isFirst ? `rgba(212,160,23,.08)` : 'rgba(255,255,255,.02)',
                      border: `1px solid ${isFirst ? 'rgba(212,160,23,.25)' : '#1e2d1e'}`,
                      borderRadius: 10,
                    }}>
                      <div style={{ width: 28, fontSize: isFirst ? 20 : 13, textAlign: 'center', flexShrink: 0, color: isFirst ? '#d4a017' : 'rgba(255,255,255,.3)', fontWeight: 700 }}>
                        {MEDALHAS[i] || `#${i + 1}`}
                      </div>
                      <Avatar nome={membro.nome} url={membro.avatar_url} size={36} cor={membro.cor} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{membro.nome}</div>
                        <div style={{ fontSize: 10, color: membro.cor, fontWeight: 600 }}>⚔ {membro.nomeNivel} — Lv.{membro.nivel}</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: isFirst ? '#d4a017' : '#4ade80', fontVariantNumeric: 'tabular-nums' }}>{membro.xp.toLocaleString()}</div>
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,.3)' }}>XP</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
