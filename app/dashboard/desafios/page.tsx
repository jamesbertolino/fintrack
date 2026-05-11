'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import PoupaUpLogo from '@/components/PoupaUpLogo'
import {
  CATALOGO_DESAFIOS, CORES_DIFICULDADE, LABEL_DIFICULDADE,
  type Desafio, type Dificuldade,
} from '@/lib/desafios'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface DesafioAtivo {
  id: string
  desafio_id: string
  desafio: Desafio | null
  iniciado_em: string
  termina_em: string
  status: string
  status_calculado: string
  progresso: number
  pct: number
}

interface DesafioHistorico {
  id: string
  desafio_id: string
  desafio: Desafio | null
  iniciado_em: string
  termina_em: string
  status: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtBRL(v: number) {
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function diasRestantes(termina_em: string) {
  const ms = new Date(termina_em).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 86400_000))
}

function fmtData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function labelProgresso(d: Desafio, progresso: number): string {
  if (d.tipo === 'limite_categoria') return `${fmtBRL(progresso)} de ${fmtBRL(d.valor_meta)}`
  if (d.tipo === 'sem_categoria')    return progresso ? 'Falhou — houve gastos' : 'Sem gastos até agora'
  if (d.tipo === 'economia')         return `${fmtBRL(progresso)} economizados de ${fmtBRL(d.valor_meta)}`
  if (d.tipo === 'habito')           return `${progresso} de ${d.valor_meta} dia${d.valor_meta > 1 ? 's' : ''}`
  return ''
}

function corBarra(d: Desafio, pct: number, status: string): string {
  if (status === 'falhou') return '#f87171'
  if (d.tipo === 'limite_categoria') return pct > 80 ? '#fbbf24' : '#4ade80'
  return '#4ade80'
}

function iconStatus(status: string) {
  if (status === 'concluido') return '✅'
  if (status === 'falhou')    return '❌'
  if (status === 'abandonado') return '🏳️'
  return '⏳'
}

// ─── Componente Card Desafio Disponível ──────────────────────────────────────

function CardDisponivel({ d, onAceitar, aceitando }: {
  d: Desafio
  onAceitar: (id: string) => void
  aceitando: string | null
}) {
  const cor = CORES_DIFICULDADE[d.dificuldade]
  return (
    <div style={{
      background: '#111', border: '1px solid #1a3a1a', borderRadius: 12,
      padding: '1rem', display: 'flex', flexDirection: 'column', gap: 10,
      transition: 'border-color .15s',
    }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = '#2a5a2a')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = '#1a3a1a')}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 22 }}>{d.icone}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{d.titulo}</div>
            <div style={{
              display: 'inline-block', fontSize: 9, fontWeight: 600,
              padding: '2px 7px', borderRadius: 10, marginTop: 3,
              background: cor.bg, color: cor.text, border: `1px solid ${cor.border}`,
              textTransform: 'uppercase', letterSpacing: '.05em',
            }}>
              {LABEL_DIFICULDADE[d.dificuldade]}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#4ade80' }}>+{d.xp} XP</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)' }}>{d.duracao_dias} dias</div>
        </div>
      </div>

      <p style={{ fontSize: 12, color: 'rgba(255,255,255,.55)', lineHeight: 1.5, margin: 0 }}>
        {d.descricao}
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {d.categoria && (
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', background: 'rgba(255,255,255,.05)', padding: '3px 8px', borderRadius: 6 }}>
            {d.categoria}
          </span>
        )}
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', background: 'rgba(255,255,255,.05)', padding: '3px 8px', borderRadius: 6 }}>
          {d.duracao_dias} dias
        </span>
      </div>

      <button
        onClick={() => onAceitar(d.id)}
        disabled={aceitando === d.id}
        style={{
          marginTop: 2, padding: '9px', background: aceitando === d.id ? 'rgba(74,222,128,.15)' : '#16a34a',
          border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 600,
          cursor: aceitando === d.id ? 'default' : 'pointer',
          opacity: aceitando === d.id ? 0.7 : 1,
        }}
      >
        {aceitando === d.id ? 'Aceitando...' : '⚔️ Aceitar desafio'}
      </button>
    </div>
  )
}

// ─── Componente Card Desafio Ativo ────────────────────────────────────────────

function CardAtivo({ p, onAbandonar, abandonando }: {
  p: DesafioAtivo
  onAbandonar: (id: string) => void
  abandonando: string | null
}) {
  if (!p.desafio) return null
  const d = p.desafio
  const dias = diasRestantes(p.termina_em)
  const falhou = p.status_calculado === 'falhou'
  const cor = falhou ? '#f87171' : CORES_DIFICULDADE[d.dificuldade].text
  const baraCor = corBarra(d, p.pct, p.status_calculado)

  return (
    <div style={{
      background: '#111',
      border: `1px solid ${falhou ? 'rgba(248,113,113,.3)' : '#1a3a1a'}`,
      borderRadius: 12, padding: '1rem', display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>{d.icone}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{d.titulo}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', marginTop: 2 }}>
              Iniciado em {fmtData(p.iniciado_em)} · termina em {fmtData(p.termina_em)}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: cor }}>+{d.xp} XP</div>
          {!falhou && (
            <div style={{ fontSize: 10, color: dias <= 2 ? '#fbbf24' : 'rgba(255,255,255,.35)', fontWeight: dias <= 2 ? 600 : 400 }}>
              {dias === 0 ? 'Último dia!' : `${dias} dia${dias > 1 ? 's' : ''} restante${dias > 1 ? 's' : ''}`}
            </div>
          )}
          {falhou && <div style={{ fontSize: 10, color: '#f87171', fontWeight: 600 }}>Desafio perdido</div>}
        </div>
      </div>

      {/* Barra de progresso */}
      {d.tipo !== 'sem_categoria' ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.5)' }}>{labelProgresso(d, p.progresso)}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: baraCor }}>{Math.round(p.pct)}%</span>
          </div>
          <div style={{ height: 8, background: 'rgba(255,255,255,.07)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${p.pct}%`, borderRadius: 4,
              background: baraCor, transition: 'width .5s',
            }} />
          </div>
          {d.tipo === 'limite_categoria' && (
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', marginTop: 4 }}>
              Limite: {fmtBRL(d.valor_meta)} · restante: {fmtBRL(Math.max(0, d.valor_meta - p.progresso))}
            </div>
          )}
        </div>
      ) : (
        <div style={{
          padding: '8px 12px', borderRadius: 8, textAlign: 'center', fontSize: 12, fontWeight: 500,
          background: falhou ? 'rgba(248,113,113,.1)' : 'rgba(74,222,128,.08)',
          color: falhou ? '#f87171' : '#4ade80',
          border: `1px solid ${falhou ? 'rgba(248,113,113,.2)' : 'rgba(74,222,128,.15)'}`,
        }}>
          {falhou ? '❌ Houve gastos em ' + d.categoria : '✅ Sem gastos em ' + d.categoria + ' até agora'}
        </div>
      )}

      {!falhou && (
        <button
          onClick={() => onAbandonar(p.id)}
          disabled={abandonando === p.id}
          style={{
            alignSelf: 'flex-end', padding: '5px 12px', background: 'transparent',
            border: '1px solid rgba(248,113,113,.25)', borderRadius: 7,
            color: 'rgba(248,113,113,.6)', fontSize: 11, cursor: 'pointer',
            opacity: abandonando === p.id ? 0.5 : 1,
          }}
        >
          {abandonando === p.id ? 'Abandonando...' : 'Abandonar'}
        </button>
      )}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function DesafiosPage() {
  const router = useRouter()

  const [aba, setAba]           = useState<'disponiveis' | 'ativos' | 'historico'>('disponiveis')
  const [catalogo, setCatalogo] = useState<Desafio[]>(CATALOGO_DESAFIOS)
  const [ativos, setAtivos]     = useState<DesafioAtivo[]>([])
  const [historico, setHistorico] = useState<DesafioHistorico[]>([])
  const [loading, setLoading]   = useState(true)
  const [aceitando, setAceitando] = useState<string | null>(null)
  const [abandonando, setAbandonando] = useState<string | null>(null)
  const [erro, setErro]         = useState('')
  const [filtroDificuldade, setFiltroDificuldade] = useState<Dificuldade | 'todos'>('todos')

  const carregar = useCallback(async () => {
    setLoading(true)
    const r = await fetch('/api/desafios')
    if (r.status === 401) { router.push('/login'); return }
    const d = await r.json()
    setCatalogo(d.catalogo || CATALOGO_DESAFIOS)
    setAtivos(d.ativos || [])
    setHistorico(d.historico || [])
    setLoading(false)
  }, [router])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar()
  }, [carregar])

  async function aceitar(desafio_id: string) {
    setAceitando(desafio_id)
    setErro('')
    const r = await fetch('/api/desafios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ desafio_id }),
    })
    if (!r.ok) {
      const d = await r.json()
      setErro(d.error || 'Erro ao aceitar desafio')
    } else {
      await carregar()
      setAba('ativos')
    }
    setAceitando(null)
  }

  async function abandonar(id: string) {
    if (!confirm('Tem certeza que deseja abandonar este desafio?')) return
    setAbandonando(id)
    await fetch(`/api/desafios/${id}`, { method: 'POST' })
    await carregar()
    setAbandonando(null)
  }

  const catalogoFiltrado = filtroDificuldade === 'todos'
    ? catalogo
    : catalogo.filter(d => d.dificuldade === filtroDificuldade)

  const xpGanho = historico
    .filter(h => h.status === 'concluido')
    .reduce((s, h) => s + (h.desafio?.xp || 0), 0)

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <PoupaUpLogo mode="compact" />
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)' }}>Carregando desafios...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: 'system-ui, sans-serif', fontSize: 13, color: '#fff' }}>

      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.875rem 1.5rem', borderBottom: '1px solid #1a3a1a', background: '#0a1a0a' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.4)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Dashboard
          </button>
          <span style={{ color: 'rgba(255,255,255,.2)' }}>/</span>
          <span style={{ fontSize: 15, fontWeight: 500 }}>Desafios</span>
        </div>
        {xpGanho > 0 && (
          <div style={{ fontSize: 12, color: '#4ade80', fontWeight: 600, background: 'rgba(74,222,128,.08)', border: '1px solid rgba(74,222,128,.2)', padding: '5px 12px', borderRadius: 8 }}>
            ⚔️ {xpGanho} XP conquistados
          </div>
        )}
      </div>

      <div style={{ padding: '1.5rem', maxWidth: 900, margin: '0 auto' }}>

        {/* Hero */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px' }}>⚔️ Desafios do Reino</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,.45)', margin: 0 }}>
            Aceite um desafio financeiro, cumpra-o no prazo e ganhe XP extra. Quanto mais difícil, maior a recompensa.
          </p>
        </div>

        {/* Cards de resumo */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: '1.5rem' }}>
          {[
            { label: 'Ativos',      val: ativos.length,                              cor: '#4ade80' },
            { label: 'Concluídos',  val: historico.filter(h => h.status === 'concluido').length,  cor: '#a78bfa' },
            { label: 'XP ganho',    val: `${xpGanho} XP`,                            cor: '#fbbf24' },
          ].map(m => (
            <div key={m.label} style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{m.label}</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: m.cor }}>{m.val}</div>
            </div>
          ))}
        </div>

        {/* Erro */}
        {erro && (
          <div style={{ marginBottom: '1rem', padding: '10px 14px', background: 'rgba(248,113,113,.1)', border: '1px solid rgba(248,113,113,.2)', borderRadius: 8, color: '#f87171', fontSize: 12 }}>
            {erro}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,.3)', border: '1px solid #1a3a1a', borderRadius: 8, padding: 3, marginBottom: '1.25rem', alignSelf: 'flex-start', width: 'fit-content' }}>
          {([
            ['disponiveis', `Disponíveis (${catalogo.length})`],
            ['ativos',      `Ativos (${ativos.length})`],
            ['historico',   `Histórico (${historico.length})`],
          ] as const).map(([v, l]) => (
            <button key={v} onClick={() => setAba(v)} style={{
              padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
              background: aba === v ? '#16a34a' : 'transparent',
              color: aba === v ? '#fff' : 'rgba(255,255,255,.45)',
            }}>{l}</button>
          ))}
        </div>

        {/* ── Disponíveis ── */}
        {aba === 'disponiveis' && (
          <div>
            {/* Filtro dificuldade */}
            <div style={{ display: 'flex', gap: 6, marginBottom: '1rem', flexWrap: 'wrap' }}>
              {(['todos', 'facil', 'medio', 'dificil', 'lendario'] as const).map(d => {
                const cor = d === 'todos' ? null : CORES_DIFICULDADE[d as Dificuldade]
                return (
                  <button key={d} onClick={() => setFiltroDificuldade(d)} style={{
                    padding: '4px 12px', borderRadius: 20, fontSize: 11, cursor: 'pointer', fontWeight: 500,
                    border: `1px solid ${filtroDificuldade === d ? (cor?.border || 'rgba(74,222,128,.4)') : '#1a3a1a'}`,
                    background: filtroDificuldade === d ? (cor?.bg || 'rgba(74,222,128,.1)') : 'transparent',
                    color: filtroDificuldade === d ? (cor?.text || '#4ade80') : 'rgba(255,255,255,.4)',
                  }}>
                    {d === 'todos' ? 'Todos' : LABEL_DIFICULDADE[d as Dificuldade]}
                  </button>
                )
              })}
            </div>

            {catalogoFiltrado.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'rgba(255,255,255,.3)', fontSize: 13 }}>
                {catalogo.length === 0
                  ? 'Todos os desafios disponíveis já estão ativos. Volte após concluir algum!'
                  : 'Nenhum desafio com essa dificuldade disponível no momento.'}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                {catalogoFiltrado.map(d => (
                  <CardDisponivel key={d.id} d={d} onAceitar={aceitar} aceitando={aceitando} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Ativos ── */}
        {aba === 'ativos' && (
          <div>
            {ativos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem', color: 'rgba(255,255,255,.3)', fontSize: 13 }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>⚔️</div>
                <div style={{ fontWeight: 500, marginBottom: 6 }}>Nenhum desafio ativo</div>
                <div style={{ fontSize: 12 }}>Vá até <strong style={{ color: '#fff' }}>Disponíveis</strong> e aceite um desafio para começar!</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {ativos.map(p => (
                  <CardAtivo key={p.id} p={p} onAbandonar={abandonar} abandonando={abandonando} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Histórico ── */}
        {aba === 'historico' && (
          <div>
            {historico.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem', color: 'rgba(255,255,255,.3)', fontSize: 13 }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📜</div>
                <div>Nenhum desafio finalizado ainda.</div>
              </div>
            ) : (
              <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 12, overflow: 'hidden' }}>
                {historico.map((h, i) => {
                  const d = h.desafio
                  const corStatus = h.status === 'concluido' ? '#4ade80' : h.status === 'falhou' ? '#f87171' : 'rgba(255,255,255,.3)'
                  return (
                    <div key={h.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                      borderBottom: i < historico.length - 1 ? '1px solid rgba(255,255,255,.05)' : 'none',
                    }}>
                      <span style={{ fontSize: 20, flexShrink: 0 }}>{d?.icone || '🎯'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{d?.titulo || h.desafio_id}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>
                          {fmtData(h.iniciado_em)} → {fmtData(h.termina_em)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: corStatus }}>
                          {iconStatus(h.status)} {h.status === 'concluido' ? 'Concluído' : h.status === 'falhou' ? 'Falhou' : 'Abandonado'}
                        </div>
                        {h.status === 'concluido' && d && (
                          <div style={{ fontSize: 11, color: '#4ade80' }}>+{d.xp} XP</div>
                        )}
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
