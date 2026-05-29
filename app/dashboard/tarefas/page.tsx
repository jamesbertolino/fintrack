'use client'

import { useCallback, useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCores } from '@/components/ThemeProvider'
import {
  CATALOGO_DESAFIOS, CORES_DIFICULDADE, LABEL_DIFICULDADE,
  type Desafio, type Dificuldade,
} from '@/lib/desafios'
import { CONQUISTAS, CONQUISTAS_POR_CATEGORIA } from '@/lib/conquistas'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Aba = 'missoes' | 'desafios' | 'conquistas'

interface MissaoComProgresso {
  id: string; tipo: 'diaria' | 'semanal'; titulo: string; descricao: string
  icone: string; xp: number; meta: number; progresso: number; concluida: boolean
}

interface DesafioAtivo {
  id: string; desafio_id: string; desafio: Desafio | null
  iniciado_em: string; termina_em: string; status: string
  status_calculado: string; progresso: number; pct: number
}

interface DesafioHistorico {
  id: string; desafio_id: string; desafio: Desafio | null
  iniciado_em: string; termina_em: string; status: string
}

interface ConquistaComStatus {
  id: string; nome: string; descricao: string; icone: string; xp: number
  categoria: string; desbloqueada: boolean; desbloqueada_em: string | null; nova: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtBRL(v: number) {
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function diasRestantes(termina_em: string) {
  return Math.max(0, Math.ceil((new Date(termina_em).getTime() - Date.now()) / 86400_000))
}

function fmtData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function labelProgresso(d: Desafio, progresso: number): string {
  if (d.tipo === 'limite_categoria') return `${fmtBRL(progresso)} de ${fmtBRL(d.valor_meta)}`
  if (d.tipo === 'sem_categoria')    return progresso ? 'Falhou — houve gastos' : 'Sem gastos até agora'
  if (d.tipo === 'economia')         return `${fmtBRL(progresso)} de ${fmtBRL(d.valor_meta)}`
  if (d.tipo === 'habito')           return `${progresso} de ${d.valor_meta} dia${d.valor_meta > 1 ? 's' : ''}`
  return ''
}

const NOMES_CATEGORIA_CONQUISTA: Record<string, string> = {
  inicio: 'Início', habito: 'Hábitos', saldo: 'Saldo', metas: 'Metas',
  grupo: 'Clã', upload: 'Escribas', lendario: 'Lendário',
}

// ─── Sub-componente para ler searchParams ─────────────────────────────────────

function AbaReader({ onDetect }: { onDetect: (a: Aba) => void }) {
  const sp = useSearchParams()
  useEffect(() => {
    const a = sp.get('aba') as Aba | null
    if (a && ['missoes', 'desafios', 'conquistas'].includes(a)) onDetect(a)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function TarefasPage() {
  const router = useRouter()
  const cores  = useCores()

  const [aba, setAba] = useState<Aba>('missoes')

  // Missões
  const [missoes, setMissoes]         = useState<{ diarias: MissaoComProgresso[]; semanais: MissaoComProgresso[] } | null>(null)
  const [abaM, setAbaM]               = useState<'diaria' | 'semanal'>('diaria')

  // Desafios
  const [catalogo, setCatalogo]       = useState<Desafio[]>(CATALOGO_DESAFIOS)
  const [ativos, setAtivos]           = useState<DesafioAtivo[]>([])
  const [historico, setHistorico]     = useState<DesafioHistorico[]>([])
  const [abaD, setAbaD]               = useState<'disponiveis' | 'ativos' | 'historico'>('disponiveis')
  const [aceitando, setAceitando]     = useState<string | null>(null)
  const [abandonando, setAbandonando] = useState<string | null>(null)
  const [filtroD, setFiltroD]         = useState<Dificuldade | 'todos'>('todos')
  const [erroD, setErroD]             = useState('')

  // Conquistas
  const [conquistas, setConquistas]   = useState<ConquistaComStatus[]>([])
  const [novasC, setNovasC]           = useState<ConquistaComStatus[]>([])
  const [mostrarNovas, setMostrarNovas] = useState(false)

  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    setLoading(true)
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 8000)
    try {
      const [rM, rD, rC] = await Promise.all([
        fetch('/api/missoes',   { signal: ctrl.signal }),
        fetch('/api/desafios',  { signal: ctrl.signal }),
        fetch('/api/conquistas', { method: 'POST', signal: ctrl.signal }),
      ])
      clearTimeout(timer)
      if (rM.status === 401 || rD.status === 401) { router.push('/login'); return }

      const [dM, dD, dC] = await Promise.all([rM.json(), rD.json(), rC.json()])

      setMissoes(dM)
      setCatalogo(dD.catalogo || CATALOGO_DESAFIOS)
      setAtivos(dD.ativos || [])
      setHistorico(dD.historico || [])

      if (dC.conquistas) {
        setConquistas(dC.conquistas)
        const novas = (dC.conquistas as ConquistaComStatus[]).filter(c => c.nova)
        if (novas.length > 0) { setNovasC(novas); setMostrarNovas(true) }
      }
    } catch (e) {
      clearTimeout(timer)
      if ((e as Error).name !== 'AbortError') console.error('[tarefas] carregar:', e)
    } finally {
      setLoading(false)
    }
  }, [router])

  // eslint-disable-next-line react-hooks/exhaustive-deps,react-hooks/set-state-in-effect
  useEffect(() => { carregar() }, [])

  async function aceitar(desafio_id: string) {
    setAceitando(desafio_id); setErroD('')
    const r = await fetch('/api/desafios', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ desafio_id }),
    })
    if (!r.ok) { const d = await r.json(); setErroD(d.error || 'Erro ao aceitar') }
    else { await carregar(); setAbaD('ativos') }
    setAceitando(null)
  }

  async function abandonar(id: string) {
    if (!confirm('Abandonar este desafio?')) return
    setAbandonando(id)
    await fetch(`/api/desafios/${id}`, { method: 'POST' })
    await carregar()
    setAbandonando(null)
  }

  const listaMissoes  = abaM === 'diaria' ? missoes?.diarias : missoes?.semanais
  const concluidasM   = listaMissoes?.filter(m => m.concluida).length || 0
  const totalM        = listaMissoes?.length || 0
  const xpDispM       = listaMissoes?.filter(m => !m.concluida).reduce((a, m) => a + m.xp, 0) || 0
  const catalogoFilt  = filtroD === 'todos' ? catalogo : catalogo.filter(d => d.dificuldade === filtroD)
  const xpDesafios    = historico.filter(h => h.status === 'concluido').reduce((s, h) => s + (h.desafio?.xp || 0), 0)
  const totalConq     = CONQUISTAS.length
  const desbConq      = conquistas.filter(c => c.desbloqueada).length
  const pctConq       = totalConq > 0 ? Math.round((desbConq / totalConq) * 100) : 0

  const abas: { id: Aba; label: string; badge?: string }[] = [
    { id: 'missoes',    label: '☀️ Missões',    badge: totalM > 0 ? `${concluidasM}/${totalM}` : undefined },
    { id: 'desafios',   label: '⚔️ Desafios',   badge: ativos.length > 0 ? String(ativos.length) : undefined },
    { id: 'conquistas', label: '🏆 Conquistas', badge: `${desbConq}/${totalConq}` },
  ]

  return (
    <div style={{ minHeight: '100vh', background: cores.pageBg, color: cores.text, fontFamily: 'system-ui, sans-serif', fontSize: 13 }}>

      <Suspense><AbaReader onDetect={setAba} /></Suspense>

      {/* Modal novas conquistas */}
      {mostrarNovas && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: cores.surface, border: `1px solid ${cores.border}`, borderRadius: 16, padding: '2rem', maxWidth: 360, width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: 44, marginBottom: 10 }}>🎉</div>
            <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700 }}>
              {novasC.length === 1 ? 'Nova conquista!' : `${novasC.length} novas conquistas!`}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '14px 0' }}>
              {novasC.map(c => (
                <div key={c.id} style={{ background: 'rgba(251,191,36,.08)', border: '1px solid rgba(251,191,36,.2)', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}>
                  <span style={{ fontSize: 26 }}>{c.icone}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{c.nome}</div>
                    <div style={{ fontSize: 11, color: cores.textMuted }}>{c.descricao}</div>
                    <div style={{ fontSize: 11, color: '#fbbf24', marginTop: 2 }}>+{c.xp} XP</div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setMostrarNovas(false)} style={{ width: '100%', padding: '10px', background: '#fbbf24', border: 'none', borderRadius: 8, color: '#0a0a0a', fontWeight: 700, cursor: 'pointer' }}>
              Incrível!
            </button>
          </div>
        </div>
      )}

      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.875rem 1.5rem', borderBottom: `1px solid ${cores.border}`, background: cores.surface }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: cores.textMuted, display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Dashboard
          </button>
          <span style={{ color: cores.border }}>/</span>
          <span style={{ fontSize: 15, fontWeight: 600 }}>📋 Tarefas</span>
        </div>
      </div>

      <div style={{ padding: '1.25rem 1.5rem', maxWidth: 860, margin: '0 auto' }}>

        {/* Abas principais */}
        <div style={{ display: 'flex', gap: 4, background: cores.surfaceDark, border: `1px solid ${cores.border}`, borderRadius: 10, padding: 3, marginBottom: '1.25rem' }}>
          {abas.map(a => (
            <button key={a.id} onClick={() => setAba(a.id)} style={{
              flex: 1, padding: '8px 6px', borderRadius: 7, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: aba === a.id ? cores.surface : 'transparent',
              color: aba === a.id ? cores.text : cores.textMuted,
              boxShadow: aba === a.id ? '0 1px 3px rgba(0,0,0,.2)' : 'none',
              transition: 'all .15s',
            }}>
              {a.label}
              {a.badge && (
                <span style={{ fontSize: 10, background: aba === a.id ? cores.accent + '22' : 'transparent', color: aba === a.id ? cores.accent : cores.textFaint, padding: '1px 5px', borderRadius: 6, fontWeight: 700 }}>
                  {a.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: cores.textMuted }}>Carregando...</div>
        ) : (

          <>
            {/* ══════════════ MISSÕES ══════════════ */}
            {aba === 'missoes' && (
              <div>
                <p style={{ margin: '0 0 14px', fontSize: 12, color: cores.textMuted }}>
                  Tarefas rotineiras que renovam diária ou semanalmente. Complete para ganhar XP.
                </p>

                {/* Sub-abas diária/semanal */}
                <div style={{ display: 'flex', gap: 3, background: cores.surfaceDark, border: `1px solid ${cores.border}`, borderRadius: 7, padding: 2, marginBottom: 14, width: 'fit-content' }}>
                  {(['diaria', 'semanal'] as const).map(t => (
                    <button key={t} onClick={() => setAbaM(t)} style={{
                      padding: '5px 16px', borderRadius: 5, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                      background: abaM === t ? cores.accent : 'transparent',
                      color: abaM === t ? '#fff' : cores.textMuted,
                    }}>
                      {t === 'diaria' ? '☀️ Diárias' : '📅 Semanais'}
                    </button>
                  ))}
                </div>

                {/* Progresso geral */}
                {totalM > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 11 }}>
                      <span style={{ color: cores.textMuted }}>{concluidasM}/{totalM} concluídas</span>
                      <span style={{ color: cores.accent, fontWeight: 600 }}>+{xpDispM} XP disponível</span>
                    </div>
                    <div style={{ height: 5, background: cores.border, borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${totalM > 0 ? Math.round((concluidasM / totalM) * 100) : 0}%`, background: cores.accent, borderRadius: 99, transition: 'width .4s' }} />
                    </div>
                  </div>
                )}

                {/* Lista */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(listaMissoes || []).map(m => (
                    <div key={m.id} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px',
                      background: m.concluida ? cores.accentGlow : cores.surface,
                      border: `1px solid ${m.concluida ? cores.accent + '33' : cores.border}`,
                      borderRadius: 10, opacity: m.concluida ? 0.7 : 1,
                    }}>
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <span style={{ fontSize: 22 }}>{m.icone}</span>
                        {m.concluida && (
                          <div style={{ position: 'absolute', bottom: -2, right: -4, width: 13, height: 13, borderRadius: '50%', background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="7" height="7" viewBox="0 0 7 7" fill="none"><polyline points="1,3.5 2.8,5.5 6,1.5" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </div>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: m.concluida ? cores.textMuted : cores.text, textDecoration: m.concluida ? 'line-through' : 'none' }}>
                            {m.titulo}
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: m.concluida ? cores.accent + '66' : cores.accent, flexShrink: 0 }}>+{m.xp} XP</span>
                        </div>
                        <div style={{ fontSize: 11, color: cores.textFaint, marginBottom: m.meta > 1 && !m.concluida ? 6 : 0 }}>{m.descricao}</div>
                        {m.meta > 1 && !m.concluida && (
                          <>
                            <div style={{ height: 3, background: cores.border, borderRadius: 99, overflow: 'hidden', marginBottom: 2 }}>
                              <div style={{ height: '100%', width: `${Math.round((m.progresso / m.meta) * 100)}%`, background: cores.accent, borderRadius: 99 }} />
                            </div>
                            <span style={{ fontSize: 10, color: cores.textFaint }}>{m.progresso}/{m.meta}</span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ══════════════ DESAFIOS ══════════════ */}
            {aba === 'desafios' && (
              <div>
                <p style={{ margin: '0 0 14px', fontSize: 12, color: cores.textMuted }}>
                  Desafios financeiros com prazo e risco de falha. Escolha um, cumpra no tempo e ganhe XP extra.
                </p>

                {/* Resumo */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
                  {[
                    { label: 'Ativos',     val: ativos.length,                                            cor: '#4ade80' },
                    { label: 'Concluídos', val: historico.filter(h => h.status === 'concluido').length,   cor: '#a78bfa' },
                    { label: 'XP ganho',   val: `${xpDesafios} XP`,                                       cor: '#fbbf24' },
                  ].map(m => (
                    <div key={m.label} style={{ background: cores.surface, border: `1px solid ${cores.border}`, borderRadius: 10, padding: '10px 12px' }}>
                      <div style={{ fontSize: 10, color: cores.textMuted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{m.label}</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: m.cor }}>{m.val}</div>
                    </div>
                  ))}
                </div>

                {erroD && (
                  <div style={{ marginBottom: 12, padding: '10px 14px', background: 'rgba(248,113,113,.1)', border: '1px solid rgba(248,113,113,.2)', borderRadius: 8, color: '#f87171', fontSize: 12 }}>
                    {erroD}
                  </div>
                )}

                {/* Sub-abas */}
                <div style={{ display: 'flex', gap: 3, background: cores.surfaceDark, border: `1px solid ${cores.border}`, borderRadius: 7, padding: 2, marginBottom: 14, width: 'fit-content' }}>
                  {([
                    ['disponiveis', `Disponíveis (${catalogo.length})`],
                    ['ativos',      `Ativos (${ativos.length})`],
                    ['historico',   `Histórico (${historico.length})`],
                  ] as const).map(([v, l]) => (
                    <button key={v} onClick={() => setAbaD(v)} style={{
                      padding: '5px 14px', borderRadius: 5, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                      background: abaD === v ? '#16a34a' : 'transparent',
                      color: abaD === v ? '#fff' : cores.textMuted,
                    }}>{l}</button>
                  ))}
                </div>

                {/* Disponíveis */}
                {abaD === 'disponiveis' && (
                  <div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                      {(['todos', 'facil', 'medio', 'dificil', 'lendario'] as const).map(d => {
                        const cor = d !== 'todos' ? CORES_DIFICULDADE[d] : null
                        return (
                          <button key={d} onClick={() => setFiltroD(d)} style={{
                            padding: '4px 12px', borderRadius: 20, fontSize: 11, cursor: 'pointer', fontWeight: 500,
                            border: `1px solid ${filtroD === d ? (cor?.border || 'rgba(74,222,128,.4)') : cores.border}`,
                            background: filtroD === d ? (cor?.bg || 'rgba(74,222,128,.1)') : 'transparent',
                            color: filtroD === d ? (cor?.text || '#4ade80') : cores.textMuted,
                          }}>
                            {d === 'todos' ? 'Todos' : LABEL_DIFICULDADE[d]}
                          </button>
                        )
                      })}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
                      {catalogoFilt.map(d => {
                        const cor = CORES_DIFICULDADE[d.dificuldade]
                        const jaAtivo = ativos.some(a => a.desafio_id === d.id && (a.status === 'ativo' || a.status_calculado === 'ativo'))
                        return (
                          <div key={d.id} style={{ background: cores.surface, border: `1px solid ${cores.border}`, borderRadius: 12, padding: '1rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 22 }}>{d.icone}</span>
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 700 }}>{d.titulo}</div>
                                  <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 10, marginTop: 3, display: 'inline-block', background: cor.bg, color: cor.text, border: `1px solid ${cor.border}`, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                                    {LABEL_DIFICULDADE[d.dificuldade]}
                                  </span>
                                </div>
                              </div>
                              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: '#4ade80' }}>+{d.xp} XP</div>
                                <div style={{ fontSize: 10, color: cores.textMuted }}>{d.duracao_dias} dias</div>
                              </div>
                            </div>
                            <p style={{ fontSize: 12, color: cores.textMuted, lineHeight: 1.5, margin: 0 }}>{d.descricao}</p>
                            <button onClick={() => aceitar(d.id)} disabled={!!aceitando || jaAtivo} style={{
                              padding: '9px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, cursor: jaAtivo ? 'default' : 'pointer',
                              background: jaAtivo ? 'rgba(74,222,128,.1)' : '#16a34a', color: '#fff',
                              opacity: aceitando === d.id ? 0.7 : 1,
                            }}>
                              {jaAtivo ? '✓ Em andamento' : aceitando === d.id ? 'Aceitando...' : '⚔️ Aceitar desafio'}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Ativos */}
                {abaD === 'ativos' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {ativos.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                        <div style={{ fontSize: 32 }}>🎮</div>
                        <div style={{ color: cores.textMuted, fontSize: 13 }}>Nenhum desafio ativo ainda.</div>
                        <button onClick={() => setAbaD('disponiveis')} style={{ padding: '8px 18px', background: 'rgba(74,222,128,.12)', border: '1px solid rgba(74,222,128,.3)', borderRadius: 20, color: '#4ade80', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          Ver desafios disponíveis →
                        </button>
                      </div>
                    ) : ativos.map(p => {
                      if (!p.desafio) return null
                      const d = p.desafio
                      const dias = diasRestantes(p.termina_em)
                      const falhou = p.status_calculado === 'falhou'
                      const barCor = falhou ? '#f87171' : (d.tipo === 'limite_categoria' && p.pct > 80 ? '#fbbf24' : '#4ade80')
                      return (
                        <div key={p.id} style={{ background: cores.surface, border: `1px solid ${falhou ? 'rgba(248,113,113,.3)' : cores.border}`, borderRadius: 12, padding: '1rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 20 }}>{d.icone}</span>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 700 }}>{d.titulo}</div>
                                <div style={{ fontSize: 10, color: cores.textMuted, marginTop: 2 }}>
                                  {fmtData(p.iniciado_em)} → {fmtData(p.termina_em)}
                                </div>
                              </div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 700, color: falhou ? '#f87171' : '#4ade80' }}>+{d.xp} XP</div>
                              <div style={{ fontSize: 10, color: dias <= 2 && !falhou ? '#fbbf24' : cores.textMuted, fontWeight: dias <= 2 ? 600 : 400 }}>
                                {falhou ? 'Desafio perdido' : dias === 0 ? 'Último dia!' : `${dias} dia${dias > 1 ? 's' : ''} restante${dias > 1 ? 's' : ''}`}
                              </div>
                            </div>
                          </div>
                          {d.tipo !== 'sem_categoria' ? (
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                                <span style={{ fontSize: 11, color: cores.textMuted }}>{labelProgresso(d, p.progresso)}</span>
                                <span style={{ fontSize: 11, fontWeight: 600, color: barCor }}>{Math.round(p.pct)}%</span>
                              </div>
                              <div style={{ height: 7, background: cores.border, borderRadius: 4, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${p.pct}%`, borderRadius: 4, background: barCor, transition: 'width .5s' }} />
                              </div>
                            </div>
                          ) : (
                            <div style={{ padding: '8px 12px', borderRadius: 8, textAlign: 'center', fontSize: 12, fontWeight: 500, background: falhou ? 'rgba(248,113,113,.1)' : 'rgba(74,222,128,.08)', color: falhou ? '#f87171' : '#4ade80', border: `1px solid ${falhou ? 'rgba(248,113,113,.2)' : 'rgba(74,222,128,.15)'}` }}>
                              {falhou ? '❌ Houve gastos em ' + d.categoria : '✅ Sem gastos em ' + d.categoria + ' até agora'}
                            </div>
                          )}
                          {!falhou && (
                            <button onClick={() => abandonar(p.id)} disabled={abandonando === p.id} style={{ alignSelf: 'flex-end', padding: '5px 12px', background: 'transparent', border: '1px solid rgba(248,113,113,.25)', borderRadius: 7, color: 'rgba(248,113,113,.6)', fontSize: 11, cursor: 'pointer', opacity: abandonando === p.id ? 0.5 : 1 }}>
                              {abandonando === p.id ? 'Abandonando...' : 'Abandonar'}
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Histórico */}
                {abaD === 'historico' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {historico.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '2rem', color: cores.textMuted }}>Nenhum desafio no histórico ainda.</div>
                    ) : historico.map(h => (
                      <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: cores.surface, border: `1px solid ${cores.border}`, borderRadius: 10 }}>
                        <span style={{ fontSize: 20 }}>{h.desafio?.icone || '📋'}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>{h.desafio?.titulo || h.desafio_id}</div>
                          <div style={{ fontSize: 10, color: cores.textMuted }}>{fmtData(h.iniciado_em)} → {fmtData(h.termina_em)}</div>
                        </div>
                        <div style={{ flexShrink: 0, textAlign: 'right' }}>
                          <div style={{ fontSize: 12 }}>
                            {h.status === 'concluido' ? '✅' : h.status === 'falhou' ? '❌' : '🏳️'}
                          </div>
                          {h.status === 'concluido' && h.desafio && (
                            <div style={{ fontSize: 10, color: '#fbbf24', fontWeight: 600 }}>+{h.desafio.xp} XP</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ══════════════ CONQUISTAS ══════════════ */}
            {aba === 'conquistas' && (
              <div>
                <p style={{ margin: '0 0 14px', fontSize: 12, color: cores.textMuted }}>
                  Medalhas permanentes desbloqueadas ao atingir marcos históricos. Uma vez conquistadas, são suas para sempre.
                </p>

                {/* Progresso geral */}
                <div style={{ background: cores.surface, border: `1px solid ${cores.border}`, borderRadius: 12, padding: '1rem', marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                    <span style={{ fontWeight: 600 }}>Progresso total</span>
                    <span style={{ color: cores.textMuted }}>{desbConq} / {totalConq}</span>
                  </div>
                  <div style={{ height: 8, background: cores.border, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pctConq}%`, background: '#fbbf24', borderRadius: 4, transition: 'width .4s' }} />
                  </div>
                  <div style={{ fontSize: 11, color: cores.textMuted, marginTop: 6 }}>{pctConq}% desbloqueado</div>
                </div>

                {/* Por categoria */}
                {Object.entries(CONQUISTAS_POR_CATEGORIA).map(([cat, lista]) => {
                  const comStatus = conquistas.filter(c => c.categoria === cat)
                  const desb = comStatus.filter(c => c.desbloqueada).length
                  return (
                    <div key={cat} style={{ marginBottom: 20 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: cores.textMuted, textTransform: 'uppercase', letterSpacing: '.08em' }}>
                          {NOMES_CATEGORIA_CONQUISTA[cat] || cat}
                        </span>
                        <span style={{ fontSize: 10, color: cores.textMuted }}>{desb}/{lista.length}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 8 }}>
                        {comStatus.map(c => (
                          <div key={c.id} style={{
                            background: c.desbloqueada ? (c.nova ? 'rgba(251,191,36,.08)' : cores.surface) : cores.surfaceDark,
                            border: `1px solid ${c.desbloqueada ? (c.nova ? 'rgba(251,191,36,.4)' : cores.border) : 'rgba(255,255,255,.04)'}`,
                            borderRadius: 10, padding: '12px', display: 'flex', alignItems: 'flex-start', gap: 10,
                            opacity: c.desbloqueada ? 1 : 0.4, position: 'relative',
                          }}>
                            <span style={{ fontSize: 26, filter: c.desbloqueada ? 'none' : 'grayscale(1)', flexShrink: 0 }}>{c.icone}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{c.nome}</div>
                              <div style={{ fontSize: 10, color: cores.textMuted, lineHeight: 1.3 }}>{c.descricao}</div>
                              <div style={{ fontSize: 10, color: c.desbloqueada ? '#fbbf24' : cores.textMuted, marginTop: 4 }}>
                                {c.desbloqueada
                                  ? (c.desbloqueada_em ? new Date(c.desbloqueada_em).toLocaleDateString('pt-BR') : 'Desbloqueado')
                                  : `+${c.xp} XP ao desbloquear`}
                              </div>
                            </div>
                            {c.nova && (
                              <div style={{ position: 'absolute', top: 5, right: 6, fontSize: 9, background: '#fbbf24', color: '#0a0a0a', padding: '1px 5px', borderRadius: 5, fontWeight: 700 }}>NOVO</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
