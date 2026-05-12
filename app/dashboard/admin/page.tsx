'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import PoupaUpLogo from '@/components/PoupaUpLogo'
import { LIMITES_TOKENS } from '@/lib/iaUsage'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Stats {
  resumo: {
    total_usuarios: number
    total_transacoes: number
    ativos_7d: number
    tokens_30d: number
    calls_ia_30d: number
  }
  planos: Record<string, number>
  ia_por_endpoint: Record<string, { total: number; calls: number }>
  ia_tokens_por_dia: Record<string, number>
  top_users_ia: Array<{ user_id: string; nome: string; plano: string; total: number }>
  tx_por_dia: Record<string, number>
  cad_por_dia: Record<string, number>
  referral: {
    total_indicacoes: number
    top_indicadores: Array<{ user_id: string; nome: string; plano: string; total: number }>
  }
}

interface Usuario {
  id: string
  nome: string
  plano: string
  created_at: string
  xp_bonus: number
  referido_por: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
}

interface AuditLog {
  id: number
  user_id: string
  action: string
  resource_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  nome_usuario: string
}

type Aba = 'overview' | 'users' | 'audit'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'k'
  return String(n)
}

function fmtData(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function fmtDataHora(d: string) {
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function MiniBar({ data, cor = '#4ade80', max: maxOverride }: { data: Record<string, number>; cor?: string; max?: number }) {
  const entries = Object.entries(data).sort((a, b) => a[0].localeCompare(b[0])).slice(-30)
  const max = maxOverride || Math.max(...entries.map(([, v]) => v), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 40 }}>
      {entries.map(([d, v]) => (
        <div key={d} title={`${fmtData(d)}: ${v}`} style={{
          flex: 1, minWidth: 3, background: cor, borderRadius: '2px 2px 0 0',
          height: `${Math.max(4, (v / max) * 100)}%`, opacity: .8, cursor: 'default',
        }} />
      ))}
    </div>
  )
}

const COR_PLANO: Record<string, string> = {
  free: '#6b7280', pro: '#4ade80', familia: '#a78bfa',
}

const LABEL_ENDPOINT: Record<string, string> = {
  'anthropic:/api/ia':              'Chat (Anthropic)',
  'openai:/api/ia':                 'Chat (OpenAI)',
  'anthropic:/api/notificacoes/ia': 'Notificações (Anthropic)',
  'openai:/api/notificacoes/ia':    'Notificações (OpenAI)',
  'anthropic:/api/orcamento/ia':    'Orçamento (Anthropic)',
  'openai:/api/orcamento/ia':       'Orçamento (OpenAI)',
  'openai:/api/lancamento/upload':  'Upload PDF (OpenAI)',
}

const LABEL_ACTION: Record<string, string> = {
  'transaction.create':   'Transação criada',
  'transaction.update':   'Transação editada',
  'transaction.delete':   'Transação excluída',
  'profile.update':       'Perfil atualizado',
  'desafio.aceito':       'Desafio aceito',
  'desafio.concluido':    'Desafio concluído',
  'desafio.abandonado':   'Desafio abandonado',
}

const COR_ACTION: Record<string, string> = {
  'transaction.create':  '#4ade80',
  'transaction.update':  '#fbbf24',
  'transaction.delete':  '#f87171',
  'profile.update':      '#60a5fa',
  'desafio.aceito':      '#a78bfa',
  'desafio.concluido':   '#4ade80',
  'desafio.abandonado':  '#f97316',
}

// ─── Componentes das abas ─────────────────────────────────────────────────────

function AbaOverview({ stats, carregar }: { stats: Stats; carregar: () => void }) {
  const [reconfigurando, setReconf] = useState(false)
  const [reconfMsg, setReconfMsg]   = useState('')

  const { resumo, planos, ia_por_endpoint, ia_tokens_por_dia, top_users_ia, tx_por_dia, cad_por_dia, referral } = stats
  const totalIA = Object.values(ia_por_endpoint).reduce((s, v) => s + v.total, 0)
  const maxIAEndpoint = Math.max(...Object.values(ia_por_endpoint).map(v => v.total), 1)

  return (
    <>
      {/* ── Cards de resumo ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: '1.5rem' }}>
        {[
          { label: 'Usuários',        val: fmtNum(resumo.total_usuarios),   cor: '#a78bfa', icon: '👥' },
          { label: 'Transações',      val: fmtNum(resumo.total_transacoes), cor: '#4ade80', icon: '📊' },
          { label: 'Ativos (7d)',     val: fmtNum(resumo.ativos_7d),        cor: '#22d3ee', icon: '⚡' },
          { label: 'Tokens IA (30d)', val: fmtNum(resumo.tokens_30d),       cor: '#fbbf24', icon: '🧠' },
          { label: 'Indicações total',val: fmtNum(referral.total_indicacoes), cor: '#f97316', icon: '🔗' },
        ].map(m => (
          <div key={m.label} style={{ background: '#111', border: '1px solid #1a1a3a', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>
              {m.icon} {m.label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 600, color: m.cor }}>{m.val}</div>
          </div>
        ))}
      </div>

      {/* ── Gráficos ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: '1.5rem' }}>
        <div style={{ background: '#111', border: '1px solid #1a1a3a', borderRadius: 12, padding: '1rem' }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>
            Transações por dia (30d)
          </div>
          <MiniBar data={tx_por_dia} cor="#4ade80" />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,.25)' }}>
              {Object.keys(tx_por_dia).sort()[0] ? fmtData(Object.keys(tx_por_dia).sort()[0]) : '—'}
            </span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,.25)' }}>hoje</span>
          </div>
        </div>

        <div style={{ background: '#111', border: '1px solid #1a1a3a', borderRadius: 12, padding: '1rem' }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>
            Tokens IA por dia (30d)
          </div>
          <MiniBar data={ia_tokens_por_dia} cor="#fbbf24" />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,.25)' }}>
              {Object.keys(ia_tokens_por_dia).sort()[0] ? fmtData(Object.keys(ia_tokens_por_dia).sort()[0]) : '—'}
            </span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,.25)' }}>hoje</span>
          </div>
        </div>
      </div>

      {/* ── Linha 2: Planos + IA por endpoint + Cadastros ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 12, marginBottom: '1.5rem' }}>
        <div style={{ background: '#111', border: '1px solid #1a1a3a', borderRadius: 12, padding: '1rem' }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>
            Usuários por plano
          </div>
          {Object.entries(planos).sort((a, b) => b[1] - a[1]).map(([p, n]) => {
            const pct = resumo.total_usuarios > 0 ? Math.round((n / resumo.total_usuarios) * 100) : 0
            return (
              <div key={p} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: COR_PLANO[p] || '#6b7280', fontWeight: 600, textTransform: 'capitalize' }}>{p}</span>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{n} <span style={{ fontSize: 10, color: 'rgba(255,255,255,.35)' }}>({pct}%)</span></span>
                </div>
                <div style={{ height: 5, background: 'rgba(255,255,255,.07)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: COR_PLANO[p] || '#6b7280', borderRadius: 3 }} />
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ background: '#111', border: '1px solid #1a1a3a', borderRadius: 12, padding: '1rem' }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>
            Tokens IA por endpoint (30d) · total: {fmtNum(totalIA)}
          </div>
          {Object.entries(ia_por_endpoint).sort((a, b) => b[1].total - a[1].total).map(([k, v]) => (
            <div key={k} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,.6)' }}>{LABEL_ENDPOINT[k] || k}</span>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: '#fbbf24' }}>{fmtNum(v.total)}</span>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', marginLeft: 6 }}>{v.calls} calls</span>
                </div>
              </div>
              <div style={{ height: 4, background: 'rgba(255,255,255,.07)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(v.total / maxIAEndpoint) * 100}%`, background: k.startsWith('anthropic') ? '#a78bfa' : '#60a5fa', borderRadius: 2 }} />
              </div>
            </div>
          ))}
          {Object.keys(ia_por_endpoint).length === 0 && (
            <div style={{ textAlign: 'center', padding: '1rem', color: 'rgba(255,255,255,.25)', fontSize: 12 }}>
              Nenhum consumo registrado ainda
            </div>
          )}
        </div>

        <div style={{ background: '#111', border: '1px solid #1a1a3a', borderRadius: 12, padding: '1rem' }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>
            Novos cadastros (30d)
          </div>
          <MiniBar data={cad_por_dia} cor="#a78bfa" />
          <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: '#a78bfa' }}>
            +{Object.values(cad_por_dia).reduce((s, v) => s + v, 0)} novos usuários
          </div>
        </div>
      </div>

      {/* ── Top usuários IA + Top indicadores ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: '1.5rem' }}>

        {/* Top usuários IA */}
        <div style={{ background: '#111', border: '1px solid #1a1a3a', borderRadius: 12, padding: '1rem' }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>
            🧠 Top usuários por tokens IA (mês)
          </div>
          {top_users_ia.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1rem', color: 'rgba(255,255,255,.25)', fontSize: 12 }}>
              Nenhum consumo registrado este mês
            </div>
          ) : (
            top_users_ia.map((u, i) => {
              const limite = LIMITES_TOKENS[u.plano] ?? LIMITES_TOKENS.free
              const pct = Math.min(100, Math.round((u.total / limite) * 100))
              const corPct = pct > 90 ? '#f87171' : pct > 70 ? '#fbbf24' : '#4ade80'
              return (
                <div key={u.user_id} style={{ display: 'grid', gridTemplateColumns: '20px 1fr 60px 120px', gap: 8, padding: '7px 4px', borderBottom: '1px solid rgba(255,255,255,.04)', alignItems: 'center' }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,.25)', fontWeight: 700 }}>#{i + 1}</div>
                  <div style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.nome}</div>
                  <div style={{ fontSize: 11, color: COR_PLANO[u.plano] || '#6b7280', textTransform: 'capitalize' }}>{u.plano}</div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ fontSize: 11, color: corPct, fontWeight: 600 }}>{fmtNum(u.total)}</span>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,.3)' }}>{pct}%</span>
                    </div>
                    <div style={{ height: 3, background: 'rgba(255,255,255,.07)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: corPct, borderRadius: 2 }} />
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Top indicadores referral */}
        <div style={{ background: '#111', border: '1px solid #1a1a3a', borderRadius: 12, padding: '1rem' }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>
            🔗 Top indicadores (referral)
          </div>
          {referral.top_indicadores.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1rem', color: 'rgba(255,255,255,.25)', fontSize: 12 }}>
              Nenhuma indicação registrada ainda
            </div>
          ) : (
            referral.top_indicadores.map((u, i) => (
              <div key={u.user_id} style={{ display: 'grid', gridTemplateColumns: '20px 1fr 60px 50px', gap: 8, padding: '7px 4px', borderBottom: '1px solid rgba(255,255,255,.04)', alignItems: 'center' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.25)', fontWeight: 700 }}>#{i + 1}</div>
                <div style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.nome}</div>
                <div style={{ fontSize: 11, color: COR_PLANO[u.plano] || '#6b7280', textTransform: 'capitalize' }}>{u.plano}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#f97316', textAlign: 'right' }}>{u.total}</div>
              </div>
            ))
          )}
          {referral.total_indicacoes > 0 && (
            <div style={{ marginTop: 10, fontSize: 11, color: 'rgba(255,255,255,.3)' }}>
              Total: {referral.total_indicacoes} indicações convertidas
            </div>
          )}
        </div>
      </div>

      {/* ── Limites por plano + ações ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'start' }}>
        <div style={{ background: '#111', border: '1px solid #1a1a3a', borderRadius: 12, padding: '1rem' }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>
            Limites mensais de tokens por plano
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {Object.entries(LIMITES_TOKENS).map(([plano, limite]) => (
              <div key={plano} style={{ background: 'rgba(255,255,255,.03)', border: `1px solid ${COR_PLANO[plano] || '#6b7280'}33`, borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: COR_PLANO[plano] || '#6b7280', textTransform: 'capitalize', marginBottom: 4 }}>{plano}</div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{fmtNum(limite)}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)' }}>tokens / mês</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: '#111', border: '1px solid #1a1a3a', borderRadius: 12, padding: '1rem', minWidth: 200 }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>
            Ações rápidas
          </div>
          {reconfMsg && <div style={{ marginBottom: 8, fontSize: 11, color: reconfMsg.startsWith('✓') ? '#4ade80' : '#f87171' }}>{reconfMsg}</div>}
          <button
            onClick={async () => {
              setReconf(true); setReconfMsg('')
              const r = await fetch('/api/admin/reconfigurar-webhooks', { method: 'POST' })
              const d = await r.json()
              setReconfMsg(r.ok ? `✓ ${d.sucesso}/${d.total} instâncias atualizadas` : `✗ ${d.error}`)
              setReconf(false)
            }}
            disabled={reconfigurando}
            style={{ display: 'block', width: '100%', padding: '8px 12px', background: 'rgba(251,191,36,.1)', border: '1px solid rgba(251,191,36,.3)', borderRadius: 7, color: '#fbbf24', fontSize: 11, cursor: 'pointer', marginBottom: 8, textAlign: 'left' }}
          >
            {reconfigurando ? 'Atualizando...' : '🔧 Reconfigurar webhooks'}
          </button>
          <button
            onClick={carregar}
            style={{ display: 'block', width: '100%', padding: '8px 12px', background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.3)', borderRadius: 7, color: '#818cf8', fontSize: 11, cursor: 'pointer', textAlign: 'left' }}
          >
            ↻ Atualizar dados
          </button>
        </div>
      </div>
    </>
  )
}

function AbaUsers() {
  const [users, setUsers]       = useState<Usuario[]>([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(0)
  const [q, setQ]               = useState('')
  const [planoFiltro, setPlano] = useState('')
  const [loading, setLoading]   = useState(false)
  const [alterando, setAlt]     = useState<string | null>(null)

  const carregar = useCallback(async (pg = page, busca = q, plano = planoFiltro) => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(pg) })
    if (busca) params.set('q', busca)
    if (plano) params.set('plano', plano)
    const r = await fetch(`/api/admin/users?${params}`)
    const d = await r.json()
    setUsers(d.users || [])
    setTotal(d.total || 0)
    setLoading(false)
  }, [page, q, planoFiltro])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { carregar(0, q, planoFiltro) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function alterarPlano(userId: string, novoPlano: string) {
    setAlt(userId)
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, plano: novoPlano }),
    })
    setAlt(null)
    carregar(page, q, planoFiltro)
  }

  const size = 20
  const totalPages = Math.ceil(total / size)

  return (
    <div>
      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (setPage(0), carregar(0, q, planoFiltro))}
          placeholder="Buscar por nome ou e-mail…"
          style={{ flex: 1, padding: '7px 12px', background: '#111', border: '1px solid #1a1a3a', borderRadius: 8, color: '#fff', fontSize: 12, outline: 'none' }}
        />
        <select
          value={planoFiltro}
          onChange={e => { setPlano(e.target.value); setPage(0); carregar(0, q, e.target.value) }}
          style={{ padding: '7px 10px', background: '#111', border: '1px solid #1a1a3a', borderRadius: 8, color: '#fff', fontSize: 12 }}
        >
          <option value="">Todos os planos</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="familia">Família</option>
        </select>
        <button
          onClick={() => { setPage(0); carregar(0, q, planoFiltro) }}
          style={{ padding: '7px 14px', background: 'rgba(99,102,241,.15)', border: '1px solid rgba(99,102,241,.3)', borderRadius: 8, color: '#818cf8', fontSize: 12, cursor: 'pointer' }}
        >
          Buscar
        </button>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>{total} usuário{total !== 1 ? 's' : ''}</span>
      </div>

      {/* Tabela */}
      <div style={{ background: '#111', border: '1px solid #1a1a3a', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 70px 120px 60px 90px', gap: 8, padding: '8px 14px', borderBottom: '1px solid #1a1a3a' }}>
          {['Nome', 'Plano', 'XP', 'Cadastro', 'Referral', 'Alterar plano'].map(h => (
            <div key={h} style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</div>
          ))}
        </div>
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(255,255,255,.3)', fontSize: 12 }}>Carregando...</div>
        ) : users.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(255,255,255,.25)', fontSize: 12 }}>Nenhum usuário encontrado</div>
        ) : (
          users.map(u => (
            <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 70px 120px 60px 90px', gap: 8, padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,.04)', alignItems: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.nome || '—'}</div>
              <div style={{ fontSize: 11, color: COR_PLANO[u.plano] || '#6b7280', fontWeight: 600, textTransform: 'capitalize' }}>{u.plano}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.6)' }}>{fmtNum(u.xp_bonus || 0)}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>{fmtData(u.created_at)}</div>
              <div style={{ fontSize: 11, color: u.referido_por ? '#f97316' : 'rgba(255,255,255,.2)' }}>{u.referido_por ? '✓' : '—'}</div>
              <select
                value={u.plano}
                disabled={alterando === u.id}
                onChange={e => alterarPlano(u.id, e.target.value)}
                style={{ padding: '4px 6px', background: '#0a0a0a', border: `1px solid ${COR_PLANO[u.plano] || '#1a1a3a'}55`, borderRadius: 6, color: COR_PLANO[u.plano] || '#fff', fontSize: 11, cursor: 'pointer' }}
              >
                <option value="free">Free</option>
                <option value="pro">Pro</option>
                <option value="familia">Família</option>
              </select>
            </div>
          ))
        )}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 12, justifyContent: 'center', alignItems: 'center' }}>
          <button
            disabled={page === 0}
            onClick={() => { const p = page - 1; setPage(p); carregar(p, q, planoFiltro) }}
            style={{ padding: '5px 12px', background: 'rgba(255,255,255,.06)', border: '1px solid #1a1a3a', borderRadius: 6, color: '#fff', fontSize: 11, cursor: page === 0 ? 'not-allowed' : 'pointer', opacity: page === 0 ? .4 : 1 }}
          >← Anterior</button>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>pág. {page + 1} / {totalPages}</span>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => { const p = page + 1; setPage(p); carregar(p, q, planoFiltro) }}
            style={{ padding: '5px 12px', background: 'rgba(255,255,255,.06)', border: '1px solid #1a1a3a', borderRadius: 6, color: '#fff', fontSize: 11, cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer', opacity: page >= totalPages - 1 ? .4 : 1 }}
          >Próxima →</button>
        </div>
      )}
    </div>
  )
}

function AbaAudit() {
  const [logs, setLogs]       = useState<AuditLog[]>([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(0)
  const [actionFiltro, setAF] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro]       = useState('')

  const carregar = useCallback(async (pg = 0, action = '') => {
    setLoading(true)
    setErro('')
    const params = new URLSearchParams({ page: String(pg) })
    if (action) params.set('action', action)
    const r = await fetch(`/api/admin/audit?${params}`)
    const d = await r.json()
    if (d.error) { setErro(d.error); setLoading(false); return }
    setLogs(d.logs || [])
    setTotal(d.total || 0)
    setLoading(false)
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { carregar() }, [carregar])

  const size = 50
  const totalPages = Math.ceil(total / size)

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <select
          value={actionFiltro}
          onChange={e => { setAF(e.target.value); setPage(0); carregar(0, e.target.value) }}
          style={{ padding: '7px 10px', background: '#111', border: '1px solid #1a1a3a', borderRadius: 8, color: '#fff', fontSize: 12 }}
        >
          <option value="">Todas as ações</option>
          {Object.keys(LABEL_ACTION).map(a => (
            <option key={a} value={a}>{LABEL_ACTION[a]}</option>
          ))}
        </select>
        <button
          onClick={() => { setPage(0); carregar(0, actionFiltro) }}
          style={{ padding: '7px 14px', background: 'rgba(99,102,241,.15)', border: '1px solid rgba(99,102,241,.3)', borderRadius: 8, color: '#818cf8', fontSize: 12, cursor: 'pointer' }}
        >
          ↻ Atualizar
        </button>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>{total} registros</span>
      </div>

      {erro && <div style={{ marginBottom: 12, padding: '10px 14px', background: 'rgba(248,113,113,.1)', border: '1px solid rgba(248,113,113,.3)', borderRadius: 8, color: '#f87171', fontSize: 12 }}>{erro}</div>}

      <div style={{ background: '#111', border: '1px solid #1a1a3a', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 1fr 1fr', gap: 8, padding: '8px 14px', borderBottom: '1px solid #1a1a3a' }}>
          {['Data / Hora', 'Usuário', 'Ação', 'Recurso'].map(h => (
            <div key={h} style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</div>
          ))}
        </div>
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(255,255,255,.3)', fontSize: 12 }}>Carregando...</div>
        ) : logs.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(255,255,255,.25)', fontSize: 12 }}>Nenhum registro encontrado</div>
        ) : (
          logs.map(log => (
            <div key={log.id} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 1fr 1fr', gap: 8, padding: '9px 14px', borderBottom: '1px solid rgba(255,255,255,.04)', alignItems: 'center' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', fontVariantNumeric: 'tabular-nums' }}>{fmtDataHora(log.created_at)}</div>
              <div style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.nome_usuario}</div>
              <div style={{ fontSize: 11, color: COR_ACTION[log.action] || 'rgba(255,255,255,.6)', fontWeight: 500 }}>
                {LABEL_ACTION[log.action] || log.action}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {log.resource_id || '—'}
              </div>
            </div>
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 12, justifyContent: 'center', alignItems: 'center' }}>
          <button
            disabled={page === 0}
            onClick={() => { const p = page - 1; setPage(p); carregar(p, actionFiltro) }}
            style={{ padding: '5px 12px', background: 'rgba(255,255,255,.06)', border: '1px solid #1a1a3a', borderRadius: 6, color: '#fff', fontSize: 11, cursor: page === 0 ? 'not-allowed' : 'pointer', opacity: page === 0 ? .4 : 1 }}
          >← Anterior</button>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>pág. {page + 1} / {totalPages}</span>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => { const p = page + 1; setPage(p); carregar(p, actionFiltro) }}
            style={{ padding: '5px 12px', background: 'rgba(255,255,255,.06)', border: '1px solid #1a1a3a', borderRadius: 6, color: '#fff', fontSize: 11, cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer', opacity: page >= totalPages - 1 ? .4 : 1 }}
          >Próxima →</button>
        </div>
      )}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter()
  const [stats, setStats]   = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro]       = useState('')
  const [aba, setAba]         = useState<Aba>('overview')

  const carregar = useCallback(async () => {
    setLoading(true)
    const r = await fetch('/api/admin/stats')
    if (r.status === 401) { router.push('/login'); return }
    if (r.status === 403) { setErro('Acesso restrito a administradores.'); setLoading(false); return }
    const d = await r.json()
    setStats(d)
    setLoading(false)
  }, [router])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar()
  }, [carregar])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <PoupaUpLogo mode="compact" />
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)' }}>Carregando painel admin...</div>
    </div>
  )

  if (erro) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 32 }}>🔒</div>
      <div style={{ fontSize: 14, color: '#f87171' }}>{erro}</div>
      <button onClick={() => router.push('/dashboard')} style={{ marginTop: 8, padding: '8px 20px', background: '#16a34a', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, cursor: 'pointer' }}>
        Voltar ao Dashboard
      </button>
    </div>
  )

  if (!stats) return null

  const ABAS: { id: Aba; label: string; icon: string }[] = [
    { id: 'overview', label: 'Visão geral',    icon: '📊' },
    { id: 'users',    label: 'Usuários',        icon: '👥' },
    { id: 'audit',    label: 'Log de auditoria', icon: '📋' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: 'system-ui, sans-serif', fontSize: 13, color: '#fff' }}>

      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.875rem 1.5rem', borderBottom: '1px solid #1a1a3a', background: '#0a0a1a' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.4)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Dashboard
          </button>
          <span style={{ color: 'rgba(255,255,255,.2)' }}>/</span>
          <span style={{ fontSize: 15, fontWeight: 500 }}>🛠️ Painel Admin</span>
        </div>
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: 2, padding: '0 1.5rem', borderBottom: '1px solid #1a1a3a', background: '#0a0a1a' }}>
        {ABAS.map(a => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            style={{
              padding: '10px 16px',
              background: 'none',
              border: 'none',
              borderBottom: aba === a.id ? '2px solid #818cf8' : '2px solid transparent',
              color: aba === a.id ? '#818cf8' : 'rgba(255,255,255,.4)',
              fontSize: 12,
              fontWeight: aba === a.id ? 600 : 400,
              cursor: 'pointer',
              marginBottom: -1,
            }}
          >
            {a.icon} {a.label}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      <div style={{ padding: '1.5rem', maxWidth: 1200, margin: '0 auto' }}>
        {aba === 'overview' && <AbaOverview stats={stats} carregar={carregar} />}
        {aba === 'users'    && <AbaUsers />}
        {aba === 'audit'    && <AbaAudit />}
      </div>
    </div>
  )
}
