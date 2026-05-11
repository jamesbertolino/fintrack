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
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'k'
  return String(n)
}

function fmtData(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

// Minibar chart inline
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

// ─── Página ───────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter()
  const [stats, setStats]     = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro]       = useState('')

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

  const { resumo, planos, ia_por_endpoint, ia_tokens_por_dia, top_users_ia, tx_por_dia, cad_por_dia } = stats

  const totalIA = Object.values(ia_por_endpoint).reduce((s, v) => s + v.total, 0)
  const maxIAEndpoint = Math.max(...Object.values(ia_por_endpoint).map(v => v.total), 1)

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
        <button onClick={carregar} style={{ padding: '5px 12px', background: 'rgba(99,102,241,.15)', border: '1px solid rgba(99,102,241,.3)', borderRadius: 7, color: '#818cf8', fontSize: 11, cursor: 'pointer' }}>
          ↻ Atualizar
        </button>
      </div>

      <div style={{ padding: '1.5rem', maxWidth: 1100, margin: '0 auto' }}>

        {/* ── Cards de resumo ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: '1.5rem' }}>
          {[
            { label: 'Usuários',        val: fmtNum(resumo.total_usuarios),   cor: '#a78bfa', icon: '👥' },
            { label: 'Transações',      val: fmtNum(resumo.total_transacoes), cor: '#4ade80', icon: '📊' },
            { label: 'Ativos (7d)',     val: fmtNum(resumo.ativos_7d),        cor: '#22d3ee', icon: '⚡' },
            { label: 'Tokens IA (30d)', val: fmtNum(resumo.tokens_30d),       cor: '#fbbf24', icon: '🧠' },
            { label: 'Calls IA (30d)',  val: fmtNum(resumo.calls_ia_30d),     cor: '#f97316', icon: '🔁' },
          ].map(m => (
            <div key={m.label} style={{ background: '#111', border: '1px solid #1a1a3a', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>
                {m.icon} {m.label}
              </div>
              <div style={{ fontSize: 22, fontWeight: 600, color: m.cor }}>{m.val}</div>
            </div>
          ))}
        </div>

        {/* ── Gráficos de atividade ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: '1.5rem' }}>

          {/* Transações por dia */}
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

          {/* Tokens IA por dia */}
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

          {/* Distribuição por plano */}
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

          {/* Consumo IA por endpoint */}
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

          {/* Cadastros por dia */}
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

        {/* ── Top usuários por consumo IA ── */}
        <div style={{ background: '#111', border: '1px solid #1a1a3a', borderRadius: 12, padding: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>
            🧠 Top 10 usuários por tokens IA (mês atual)
          </div>
          {top_users_ia.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1rem', color: 'rgba(255,255,255,.25)', fontSize: 12 }}>
              Nenhum consumo registrado este mês
            </div>
          ) : (
            <div>
              {/* Header */}
              <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr 80px 180px 100px', gap: 10, padding: '4px 8px', marginBottom: 4 }}>
                {['#', 'Usuário', 'Plano', 'Tokens usados', 'Limite mensal'].map(h => (
                  <div key={h} style={{ fontSize: 10, color: 'rgba(255,255,255,.25)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</div>
                ))}
              </div>
              {top_users_ia.map((u, i) => {
                const limite = LIMITES_TOKENS[u.plano] ?? LIMITES_TOKENS.free
                const pct = Math.min(100, Math.round((u.total / limite) * 100))
                const corPct = pct > 90 ? '#f87171' : pct > 70 ? '#fbbf24' : '#4ade80'
                return (
                  <div key={u.user_id} style={{ display: 'grid', gridTemplateColumns: '24px 1fr 80px 180px 100px', gap: 10, padding: '8px', borderRadius: 6, borderBottom: '1px solid rgba(255,255,255,.04)', alignItems: 'center' }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.25)', fontWeight: 700 }}>#{i + 1}</div>
                    <div style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.nome}</div>
                    <div style={{ fontSize: 11, color: COR_PLANO[u.plano] || '#6b7280', fontWeight: 600, textTransform: 'capitalize' }}>{u.plano}</div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: 11, color: corPct, fontWeight: 600 }}>{fmtNum(u.total)}</span>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,.3)' }}>{pct}%</span>
                      </div>
                      <div style={{ height: 4, background: 'rgba(255,255,255,.07)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: corPct, borderRadius: 2 }} />
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>{fmtNum(limite)}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Limites por plano ── */}
        <div style={{ background: '#111', border: '1px solid #1a1a3a', borderRadius: 12, padding: '1rem' }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>
            Configuração de limites mensais de tokens por plano
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
          <div style={{ marginTop: 10, fontSize: 11, color: 'rgba(255,255,255,.3)' }}>
            Para ajustar os limites, edite <code style={{ background: 'rgba(255,255,255,.06)', padding: '1px 6px', borderRadius: 4 }}>LIMITES_TOKENS</code> em <code style={{ background: 'rgba(255,255,255,.06)', padding: '1px 6px', borderRadius: 4 }}>lib/iaUsage.ts</code>
          </div>
        </div>

      </div>
    </div>
  )
}
