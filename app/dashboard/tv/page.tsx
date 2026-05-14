'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import PoupaUpLogo from '@/components/PoupaUpLogo'

interface Transacao { id: string; descricao: string; valor: number; tipo: 'debito' | 'credito'; categoria: string; data_hora: string }
interface Meta      { id: string; nome: string; valor_total: number; valor_atual: number; prazo: string }
interface Conta     { id: string; nome: string; saldo: number; mostrar_saldo: boolean; bancos?: { nome_curto: string; cor: string } | null }

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function useRelogio() {
  const [agora, setAgora] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return agora
}

export default function TVPage() {
  const router   = useRouter()
  const supabase = createClient()
  const agora    = useRelogio()

  const [transacoes, setTransacoes] = useState<Transacao[]>([])
  const [metas,      setMetas]      = useState<Meta[]>([])
  const [contas,     setContas]     = useState<Conta[]>([])
  const [nomeUser,   setNomeUser]   = useState('')
  const [loading,    setLoading]    = useState(true)
  const [ultimaSync, setUltimaSync] = useState<Date | null>(null)

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const [{ data: prof }, { data: tx }, { data: mt }] = await Promise.all([
      supabase.from('profiles').select('nome').eq('id', user.id).single(),
      supabase.from('transactions').select('*').eq('user_id', user.id).order('data_hora', { ascending: false }).limit(200),
      supabase.from('goals').select('*').eq('user_id', user.id).eq('ativo', true).limit(6),
    ])

    if (prof)  setNomeUser(prof.nome || '')
    if (tx)    setTransacoes(tx)
    if (mt)    setMetas(mt)

    const res = await fetch('/api/contas')
    const d   = await res.json()
    setContas(d.contas || [])
    setLoading(false)
    setUltimaSync(new Date())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar()
    const t = setInterval(carregar, 60_000)
    return () => clearInterval(t)
  }, [carregar])

  // Fullscreen ao entrar
  useEffect(() => {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {})
    }
    return () => {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {})
      }
    }
  }, [])

  // ESC / F sai do modo TV
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' || e.key === 'F' || e.key === 'f') {
        router.push('/dashboard')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [router])

  // Métricas do mês atual
  const mesAtual = agora.toISOString().slice(0, 7)
  const txMes    = transacoes.filter(t => t.data_hora.startsWith(mesAtual))
  const receitas = txMes.filter(t => t.tipo === 'credito').reduce((a, t) => a + t.valor, 0)
  const despesas = txMes.filter(t => t.tipo === 'debito').reduce((a, t) => a + Math.abs(t.valor), 0)
  const resultado = receitas - despesas
  const saldoTotal = contas.filter(c => c.mostrar_saldo).reduce((a, c) => a + c.saldo, 0)

  const porCategoria: Record<string, number> = {}
  txMes.filter(t => t.tipo === 'debito').forEach(t => {
    porCategoria[t.categoria] = (porCategoria[t.categoria] || 0) + Math.abs(t.valor)
  })
  const topCats = Object.entries(porCategoria).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const maxCat  = Math.max(...topCats.map(c => c[1]), 1)

  const ultimasTx = transacoes.slice(0, 6)

  const nomeMes = agora.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const horaStr = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const dataStr = agora.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#050a05', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' }}>
        <div style={{ color: 'rgba(255,255,255,.3)', fontSize: 16 }}>Carregando...</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#050a05', color: '#fff', fontFamily: 'system-ui, sans-serif', padding: '2rem', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* ── Topbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <PoupaUpLogo mode="compact" />
          <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,.1)' }} />
          <div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', textTransform: 'capitalize' }}>{dataStr}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.25)', marginTop: 1 }}>
              {nomeUser && `Bem-vindo, ${nomeUser} · `}Pressione F para sair do modo TV
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 52, fontWeight: 700, letterSpacing: '-2px', lineHeight: 1, color: '#4ade80', fontVariantNumeric: 'tabular-nums' }}>{horaStr}</div>
          {ultimaSync && <div style={{ fontSize: 10, color: 'rgba(255,255,255,.2)', marginTop: 4 }}>sync {ultimaSync.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>}
        </div>
      </div>

      {/* ── Métricas principais ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
        {[
          { label: 'Saldo Total',       valor: saldoTotal,  cor: '#4ade80' },
          { label: `Receitas — ${nomeMes}`, valor: receitas,    cor: '#34d399' },
          { label: `Gastos — ${nomeMes}`,   valor: -despesas,   cor: '#f87171' },
          { label: 'Resultado do mês',  valor: resultado,   cor: resultado >= 0 ? '#a3e635' : '#fb923c' },
        ].map((m, i) => (
          <div key={i} style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 16, padding: '1.5rem' }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.08em' }}>{m.label}</div>
            <div style={{ fontSize: 36, fontWeight: 700, color: m.cor, letterSpacing: '-1px', fontVariantNumeric: 'tabular-nums' }}>
              {fmt(Math.abs(m.valor))}
            </div>
            {i === 3 && (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', marginTop: 6 }}>
                {receitas > 0 ? `${Math.round((resultado / receitas) * 100)}% de sobra` : '—'}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Linha 2: contas + categorias + metas ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', flex: 1 }}>

        {/* Contas */}
        <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 16, padding: '1.5rem' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 16 }}>Contas</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {contas.filter(c => c.mostrar_saldo).map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: c.bancos?.cor || '#4ade80', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{c.nome}</div>
                    {c.bancos && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>{c.bancos.nome_curto}</div>}
                  </div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: c.saldo >= 0 ? '#4ade80' : '#f87171', fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(c.saldo)}
                </div>
              </div>
            ))}
            {contas.filter(c => c.mostrar_saldo).length === 0 && (
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,.2)' }}>Nenhuma conta configurada</div>
            )}
          </div>
        </div>

        {/* Top categorias */}
        <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 16, padding: '1.5rem' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 16 }}>Top categorias — {nomeMes}</div>
          {topCats.length === 0 ? (
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.2)' }}>Nenhum gasto este mês</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {topCats.map(([cat, val]) => (
                <div key={cat}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,.7)' }}>{cat}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#f87171', fontVariantNumeric: 'tabular-nums' }}>{fmt(val)}</span>
                  </div>
                  <div style={{ height: 6, background: 'rgba(255,255,255,.07)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(val / maxCat) * 100}%`, background: '#ef4444', borderRadius: 3, transition: 'width 1s ease' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Metas */}
        <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 16, padding: '1.5rem' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 16 }}>Metas</div>
          {metas.length === 0 ? (
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.2)' }}>Nenhuma meta ativa</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {metas.map(mt => {
                const pct   = Math.min(100, Math.round((mt.valor_atual / mt.valor_total) * 100))
                const prazo = new Date(mt.prazo)
                const dias  = Math.ceil((prazo.getTime() - agora.getTime()) / 86400000)
                return (
                  <div key={mt.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,.7)', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mt.nome}</span>
                      <span style={{ fontSize: 12, color: pct >= 100 ? '#4ade80' : 'rgba(255,255,255,.4)' }}>{pct}%</span>
                    </div>
                    <div style={{ height: 6, background: 'rgba(255,255,255,.07)', borderRadius: 3, overflow: 'hidden', marginBottom: 3 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? '#4ade80' : '#16a34a', borderRadius: 3, transition: 'width 1s ease' }} />
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,.25)' }}>
                      {fmt(mt.valor_atual)} de {fmt(mt.valor_total)} · {dias > 0 ? `${dias}d restantes` : 'vencida'}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Últimas transações ── */}
      <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 16, padding: '1.25rem 1.5rem' }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 12 }}>Últimas transações</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
          {ultimasTx.map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: t.tipo === 'credito' ? 'rgba(74,222,128,.12)' : 'rgba(239,68,68,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                {t.tipo === 'credito' ? '↑' : '↓'}
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.descricao}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>{t.categoria} · {new Date(t.data_hora).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: t.tipo === 'credito' ? '#4ade80' : '#f87171', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                {t.tipo === 'credito' ? '+' : '-'}{fmt(Math.abs(t.valor))}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
