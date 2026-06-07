'use client'

import { useEffect, useState } from 'react'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useRouter } from 'next/navigation'
import PoupaUpLogo from '@/components/PoupaUpLogo'
import Avatar from '@/components/Avatar'
import { useCores, useTema } from '@/components/ThemeProvider'

const TIPO_ICONE: Record<string, string> = { conta_bancaria: '🏦', especie: '💵', cheque: '📄', outro: '📦' }
const TIPO_LABEL: Record<string, string> = { conta_bancaria: 'Conta bancária', especie: 'Dinheiro em espécie', cheque: 'Cheque', outro: 'Outro' }
const CAT_LISTA = ['Moradia','Alimentação','Transporte','Lazer','Saúde','Educação','Investimento','Outros']

interface GrupoOrigem {
  id: string; grupo_id: string; criado_por: string; nome: string
  tipo: string; conta_id: string | null; saldo_inicial: number; saldo_atual: number
  contas?: { nome: string; bancos?: { nome_curto: string; cor: string | null } | null } | null
}

interface GrupoMovimento {
  id: string; origem_id: string; user_id: string; tipo: 'entrada' | 'saida'
  valor: number; descricao: string; categoria: string; data: string
  meta_id: string | null; divida_id: string | null; saldo_acumulado: number
  grupo_origens?: { nome: string; tipo: string } | null
  profiles?: { nome: string; avatar_url: string | null } | null
}

interface MembroDash {
  id:                  string
  nome:                string
  avatar_url:          string | null
  papel:               string
  membro_id_row?:      string
  incluir_consolidado: boolean
  receitas:            number
  despesas:            number
  saldo:               number
  pct_saldo?:          number
  pct_receitas?:       number
  pct_despesas?:       number
  metas:               { nome: string; valor_total: number; valor_atual: number }[]
  topCats:             [string, number][]
  txCount:             number
}

interface FamiliaDash {
  grupoId:       string
  membros:       MembroDash[]
  historico:     [string, number][]
  totalReceitas: number
  totalDespesas: number
  totalSaldo:    number
  mes:           string
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const CORES_MEMBROS = ['#4ade80', '#60a5fa', '#f472b6', '#fb923c', '#a78bfa', '#34d399']

function GraficoFamilia({ dash }: { dash: FamiliaDash }) {
  const W = 500, H = 120, P = { t: 12, b: 24, l: 44, r: 12 }
  const iW = W - P.l - P.r, iH = H - P.t - P.b

  const base   = dash.totalSaldo - dash.historico.reduce((a, [, v]) => a + v, 0)
  const pontos = dash.historico.reduce<{ dia: string; val: number }[]>((arr, [dia, val]) => {
    const prev = arr.length ? arr[arr.length - 1].val : base
    return [...arr, { dia, val: prev + val }]
  }, [])
  const mn = Math.min(...pontos.map(p => p.val))
  const mx = Math.max(...pontos.map(p => p.val), mn + 1)

  function px(i: number) { return P.l + (i / (pontos.length - 1)) * iW }
  function py(v: number) { return P.t + iH - ((v - mn) / (mx - mn)) * iH }

  const linha = pontos.map((p, i) => `${px(i)},${py(p.val)}`).join(' ')
  const area  = `M${px(0)},${py(pontos[0].val)} ` +
    pontos.slice(1).map((p, i) => `L${px(i + 1)},${py(p.val)}`).join(' ') +
    ` L${px(pontos.length - 1)},${P.t + iH} L${P.l},${P.t + iH} Z`

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', width: '100%' }}>
      <path d={area} fill="rgba(74,222,128,.1)" />
      <polyline points={linha} fill="none" stroke="#4ade80" strokeWidth="2" strokeLinejoin="round" />
      {[mn, mx].map((v, i) => (
        <text key={i} x={P.l - 4} y={py(v) + 3} textAnchor="end" fontSize="8" fill="rgba(255,255,255,.3)">
          {v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0)}
        </text>
      ))}
      {pontos.filter((_, i) => i % Math.max(1, Math.floor(pontos.length / 5)) === 0).map((p, i) => (
        <text key={i} x={px(dash.historico.findIndex(([d]) => d === p.dia))} y={H - 4}
          textAnchor="middle" fontSize="7" fill="rgba(255,255,255,.3)">
          {p.dia.slice(5)}
        </text>
      ))}
    </svg>
  )
}

export default function FamiliaPage() {
  const router = useRouter()
  const cores  = useCores()
  const { tema } = useTema()
  const m = tema === 'medieval'

  const [dash,        setDash]        = useState<FamiliaDash | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [erro,        setErro]        = useState('')
  const [aba,         setAba]         = useState<'dashboard' | 'fontes' | 'extrato'>('dashboard')
  const [membroFiltro, setMembroFiltro] = useState<string | null>(null) // null = consolidado
  const [togglingId,  setTogglingId]  = useState<string | null>(null)

  // fontes
  const [origens,      setOrigens]      = useState<GrupoOrigem[]>([])
  const [loadOrigens,  setLoadOrigens]  = useState(false)
  const [showFormOrigem, setShowFormOrigem] = useState(false)
  const [formOrigem,   setFormOrigem]   = useState({ nome: '', tipo: 'conta_bancaria', saldo_inicial: '' })
  const [salvandoOrigem, setSalvandoOrigem] = useState(false)

  // extrato
  const [movimentos,     setMovimentos]     = useState<GrupoMovimento[]>([])
  const [saldoGrupo,     setSaldoGrupo]     = useState(0)
  const [loadMovimentos, setLoadMovimentos] = useState(false)
  const [showFormMov,    setShowFormMov]    = useState(false)
  const [formMov,        setFormMov]        = useState({ origem_id: '', tipo: 'entrada' as 'entrada'|'saida', valor: '', descricao: '', categoria: 'Outros', data: new Date().toISOString().slice(0,10) })
  const [salvandoMov,    setSalvandoMov]    = useState(false)
  const [erroMov,        setErroMov]        = useState('')
  const [filtroOrigem,   setFiltroOrigem]   = useState('')
  const isMobile = useIsMobile(640)

  useEffect(() => {
    fetch('/api/familia/dashboard')
      .then(r => r.json())
      .then(d => {
        if (d.error) setErro(d.error)
        else setDash(d)
        setLoading(false)
      })
      .catch(() => { setErro('Erro ao carregar dados da família.'); setLoading(false) })
  }, [])  

  async function carregarOrigens() {
    setLoadOrigens(true)
    const res = await fetch('/api/familia/origens')
    const d = await res.json()
    setOrigens(d.origens || [])
    setLoadOrigens(false)
  }

  async function carregarMovimentos(origem?: string) {
    setLoadMovimentos(true)
    const url = `/api/familia/movimentos${origem ? `?origem_id=${origem}` : ''}`
    const res = await fetch(url)
    const d = await res.json()
    setMovimentos(d.movimentos || [])
    setSaldoGrupo(d.saldo || 0)
    setLoadMovimentos(false)
  }

  useEffect(() => {
    if (aba === 'fontes')  carregarOrigens()    // eslint-disable-line react-hooks/set-state-in-effect
    if (aba === 'extrato') { carregarOrigens(); carregarMovimentos() }  
   
  }, [aba])

  async function criarOrigem(e: React.FormEvent) {
    e.preventDefault()
    if (!formOrigem.nome.trim()) return
    setSalvandoOrigem(true)
    const res = await fetch('/api/familia/origens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: formOrigem.nome, tipo: formOrigem.tipo, saldo_inicial: parseFloat(formOrigem.saldo_inicial.replace(',','.')) || 0 }),
    })
    const d = await res.json()
    if (!res.ok) { setErroMov(d.error || 'Erro ao criar fonte'); setSalvandoOrigem(false); return }
    if (d.origem) { setOrigens(prev => [...prev, d.origem]); setShowFormOrigem(false); setFormOrigem({ nome: '', tipo: 'conta_bancaria', saldo_inicial: '' }) }
    setSalvandoOrigem(false)
  }

  async function removerOrigem(id: string) {
    const res = await fetch(`/api/familia/origens/${id}`, { method: 'DELETE' })
    if (res.ok) setOrigens(prev => prev.filter(o => o.id !== id))
    else setErroMov('Erro ao remover fonte')
  }

  async function criarMovimento(e: React.FormEvent) {
    e.preventDefault()
    const v = parseFloat(formMov.valor.replace(',','.'))
    if (!formMov.origem_id || !v || v <= 0) { setErroMov('Origem e valor são obrigatórios'); return }
    if (!formMov.descricao.trim()) { setErroMov('Descrição obrigatória'); return }
    setSalvandoMov(true); setErroMov('')
    const res = await fetch('/api/familia/movimentos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...formMov, valor: v }),
    })
    const d = await res.json()
    if (!res.ok) { setErroMov(d.error || 'Erro'); setSalvandoMov(false); return }
    setShowFormMov(false)
    setFormMov({ origem_id: origens[0]?.id || '', tipo: 'entrada', valor: '', descricao: '', categoria: 'Outros', data: new Date().toISOString().slice(0,10) })
    await carregarMovimentos(filtroOrigem || undefined)
    // atualizar saldo da origem
    setOrigens(prev => prev.map(o => o.id === d.movimento.origem_id
      ? { ...o, saldo_atual: o.saldo_atual + (d.movimento.tipo === 'entrada' ? v : -v) }
      : o))
    setSalvandoMov(false)
  }

  async function removerMovimento(id: string, origem_id: string, tipo: string, valor: number) {
    const res = await fetch('/api/familia/movimentos', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    if (!res.ok) { setErroMov('Erro ao remover lançamento'); return }
    setMovimentos(prev => prev.filter(m => m.id !== id))
    setOrigens(prev => prev.map(o => o.id === origem_id
      ? { ...o, saldo_atual: o.saldo_atual + (tipo === 'entrada' ? -valor : valor) }
      : o))
  }

  const nomeMes = dash ? new Date(dash.mes + '-15').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : ''
  const totalGrupo = origens.reduce((s, o) => s + o.saldo_atual, 0)
  const inputSt: React.CSSProperties = { width: '100%', padding: '8px 10px', background: cores.pageBg, border: `1px solid ${cores.border}`, borderRadius: 7, color: cores.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }

  return (
    <div style={{ minHeight: '100vh', background: cores.pageBg, color: cores.text, fontFamily: 'system-ui, sans-serif' }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '1rem 1.5rem', borderBottom: `1px solid ${cores.border}`, background: cores.surface }}>
        <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: cores.textMuted, fontSize: 18, lineHeight: 1, padding: 4 }}>←</button>
        <PoupaUpLogo mode="compact" />
        <span style={{ fontSize: 13, color: cores.textMuted }}>{m ? '👑 Reino Familiar' : '👨‍👩‍👧 Família'}</span>
        {/* Abas só aparecem quando há família configurada */}
        {!erro && !loading && (
          <div style={{ display: 'flex', gap: 2, marginLeft: 'auto' }}>
            {([
              { id: 'dashboard', label: '📊 Dashboard' },
              { id: 'fontes',    label: '💰 Fontes' },
              { id: 'extrato',   label: '📋 Extrato' },
            ] as const).map(t => (
              <button key={t.id} onClick={() => setAba(t.id)} style={{ padding: '6px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: aba === t.id ? 600 : 400, background: aba === t.id ? cores.accent : 'transparent', color: aba === t.id ? '#fff' : cores.textMuted }}>
                {t.label}
              </button>
            ))}
            <button onClick={() => router.push('/dashboard/perfil?aba=grupo')} style={{ marginLeft: 6, fontSize: 12, padding: '6px 12px', borderRadius: 7, border: `1px solid ${cores.border}`, background: 'transparent', color: cores.textMuted, cursor: 'pointer' }}>
              Membros →
            </button>
          </div>
        )}
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '1.5rem' }}>

        {aba === 'dashboard' && loading && <div style={{ textAlign: 'center', padding: '4rem', color: cores.textMuted }}>Carregando dados da família...</div>}

        {aba === 'dashboard' && erro && !loading && (
          <div style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 12, padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>👨‍👩‍👧</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Nenhuma família configurada</div>
            <div style={{ fontSize: 13, color: cores.textMuted, marginBottom: 16 }}>
              Crie um grupo familiar e convide membros para ver o dashboard consolidado.
            </div>
            <button
              onClick={() => router.push('/dashboard/perfil?aba=grupo')}
              style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: '#16a34a', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Configurar família →
            </button>
          </div>
        )}

        {/* ── ABA FONTES ── */}
        {aba === 'fontes' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ fontSize: 13, color: cores.textMuted }}>
                {origens.length > 0 && <>Total do grupo: <strong style={{ color: totalGrupo >= 0 ? '#4ade80' : '#f87171' }}>{fmt(totalGrupo)}</strong></>}
              </div>
              <button onClick={() => setShowFormOrigem(true)} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                + Adicionar fonte
              </button>
            </div>

            {showFormOrigem && (
              <div style={{ background: cores.surface, border: `1px solid ${cores.border}`, borderRadius: 12, padding: '1.25rem', marginBottom: '1rem' }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: '1rem' }}>Nova fonte de recursos</div>
                <form onSubmit={criarOrigem}>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 10, color: cores.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>Nome</div>
                      <input value={formOrigem.nome} onChange={e => setFormOrigem(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Conta conjunta" style={inputSt} />
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: cores.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>Tipo</div>
                      <select value={formOrigem.tipo} onChange={e => setFormOrigem(p => ({ ...p, tipo: e.target.value }))} style={{ ...inputSt, cursor: 'pointer' }}>
                        {Object.entries(TIPO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: cores.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>Saldo inicial (R$)</div>
                      <input value={formOrigem.saldo_inicial} onChange={e => setFormOrigem(p => ({ ...p, saldo_inicial: e.target.value }))} placeholder="0,00" style={inputSt} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="submit" disabled={salvandoOrigem} style={{ padding: '8px 18px', borderRadius: 7, border: 'none', background: '#16a34a', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: salvandoOrigem ? 0.6 : 1 }}>
                      {salvandoOrigem ? 'Salvando...' : 'Criar fonte'}
                    </button>
                    <button type="button" onClick={() => setShowFormOrigem(false)} style={{ padding: '8px 14px', borderRadius: 7, border: `1px solid ${cores.border}`, background: 'transparent', color: cores.textMuted, fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
                  </div>
                </form>
              </div>
            )}

            {loadOrigens ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: cores.textMuted }}>Carregando...</div>
            ) : origens.length === 0 ? (
              <div style={{ background: cores.surface, border: `1px dashed ${cores.border}`, borderRadius: 12, padding: '3rem', textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>💰</div>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Nenhuma fonte ainda</div>
                <div style={{ fontSize: 12, color: cores.textMuted }}>Adicione contas bancárias, dinheiro em espécie ou cheques para consolidar o patrimônio do grupo.</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: 12 }}>
                {origens.map(o => {
                  const pct = totalGrupo > 0 ? Math.round(Math.max(0, o.saldo_atual) / totalGrupo * 100) : 0
                  return (
                    <div key={o.id} style={{ background: cores.surface, border: `1px solid ${cores.border}`, borderRadius: 12, padding: '1.1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 22 }}>{TIPO_ICONE[o.tipo] || '📦'}</span>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{o.nome}</div>
                            <div style={{ fontSize: 10, color: cores.textMuted }}>{TIPO_LABEL[o.tipo]}</div>
                          </div>
                        </div>
                        <button onClick={() => removerOrigem(o.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(239,68,68,.5)', fontSize: 15, padding: 4 }}>✕</button>
                      </div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: o.saldo_atual >= 0 ? '#4ade80' : '#f87171', marginBottom: 6 }}>{fmt(o.saldo_atual)}</div>
                      <div style={{ fontSize: 10, color: cores.textMuted, marginBottom: 6 }}>Saldo inicial: {fmt(o.saldo_inicial)}</div>
                      {totalGrupo > 0 && (
                        <>
                          <div style={{ height: 4, background: 'rgba(255,255,255,.07)', borderRadius: 2, overflow: 'hidden', marginBottom: 4 }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: '#4ade80', borderRadius: 2 }} />
                          </div>
                          <div style={{ fontSize: 10, color: cores.textMuted }}>{pct}% do total do grupo</div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── ABA EXTRATO ── */}
        {aba === 'extrato' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select value={filtroOrigem} onChange={e => { setFiltroOrigem(e.target.value); carregarMovimentos(e.target.value || undefined) }}
                  style={{ padding: '6px 10px', borderRadius: 7, border: `1px solid ${cores.border}`, background: cores.surface, color: cores.text, fontSize: 12 }}>
                  <option value="">Todas as fontes</option>
                  {origens.map(o => <option key={o.id} value={o.id}>{TIPO_ICONE[o.tipo]} {o.nome}</option>)}
                </select>
                <div style={{ fontSize: 13, color: cores.textMuted }}>
                  Saldo: <strong style={{ color: saldoGrupo >= 0 ? '#4ade80' : '#f87171' }}>{fmt(saldoGrupo)}</strong>
                </div>
              </div>
              <button onClick={() => { setFormMov(p => ({ ...p, origem_id: origens[0]?.id || '' })); setShowFormMov(true) }}
                style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                + Lançamento
              </button>
            </div>

            {showFormMov && (
              <div style={{ background: cores.surface, border: `1px solid ${cores.border}`, borderRadius: 12, padding: '1.25rem', marginBottom: '1rem' }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: '1rem' }}>Novo lançamento</div>
                <form onSubmit={criarMovimento}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 10, color: cores.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>Origem</div>
                      <select value={formMov.origem_id} onChange={e => setFormMov(p => ({ ...p, origem_id: e.target.value }))} style={{ ...inputSt, cursor: 'pointer' }}>
                        <option value="">Selecionar…</option>
                        {origens.map(o => <option key={o.id} value={o.id}>{TIPO_ICONE[o.tipo]} {o.nome} ({fmt(o.saldo_atual)})</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: cores.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>Tipo</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {(['entrada','saida'] as const).map(t => (
                          <button key={t} type="button" onClick={() => setFormMov(p => ({ ...p, tipo: t }))} style={{ flex: 1, padding: '8px', borderRadius: 7, border: `1.5px solid ${formMov.tipo === t ? (t === 'entrada' ? '#4ade80' : '#f87171') : cores.border}`, background: formMov.tipo === t ? `${t === 'entrada' ? '#4ade80' : '#f87171'}15` : 'transparent', color: formMov.tipo === t ? (t === 'entrada' ? '#4ade80' : '#f87171') : cores.textMuted, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                            {t === 'entrada' ? '↑ Entrada' : '↓ Saída'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: cores.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>Valor (R$)</div>
                      <input value={formMov.valor} onChange={e => setFormMov(p => ({ ...p, valor: e.target.value }))} placeholder="0,00" style={inputSt} />
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: cores.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>Data</div>
                      <input type="date" value={formMov.data} onChange={e => setFormMov(p => ({ ...p, data: e.target.value }))} style={{ ...inputSt, colorScheme: 'dark' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: cores.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>Descrição</div>
                      <input value={formMov.descricao} onChange={e => setFormMov(p => ({ ...p, descricao: e.target.value }))} placeholder="Ex: Aluguel, Compras…" style={inputSt} />
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: cores.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>Categoria</div>
                      <select value={formMov.categoria} onChange={e => setFormMov(p => ({ ...p, categoria: e.target.value }))} style={{ ...inputSt, cursor: 'pointer' }}>
                        {CAT_LISTA.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  {erroMov && <div style={{ fontSize: 12, color: '#f87171', marginBottom: 8 }}>{erroMov}</div>}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="submit" disabled={salvandoMov} style={{ padding: '8px 18px', borderRadius: 7, border: 'none', background: '#16a34a', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: salvandoMov ? 0.6 : 1 }}>
                      {salvandoMov ? 'Salvando...' : 'Registrar'}
                    </button>
                    <button type="button" onClick={() => setShowFormMov(false)} style={{ padding: '8px 14px', borderRadius: 7, border: `1px solid ${cores.border}`, background: 'transparent', color: cores.textMuted, fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
                  </div>
                </form>
              </div>
            )}

            {loadMovimentos ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: cores.textMuted }}>Carregando...</div>
            ) : movimentos.length === 0 ? (
              <div style={{ background: cores.surface, border: `1px dashed ${cores.border}`, borderRadius: 12, padding: '3rem', textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Nenhum lançamento ainda</div>
                <div style={{ fontSize: 12, color: cores.textMuted }}>Adicione fontes e depois registre entradas e saídas para ver o extrato consolidado.</div>
              </div>
            ) : (
              <div style={{ background: cores.surface, border: `1px solid ${cores.border}`, borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}><div style={{ minWidth: 560 }}>
                {/* Header */}
                <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr auto auto auto 90px 28px', gap: '0 12px', padding: '8px 14px', borderBottom: `1px solid ${cores.border}`, fontSize: 9, fontWeight: 700, color: cores.textMuted, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  <span>Data</span><span>Descrição</span><span>Origem</span><span>Quem</span><span>Categ.</span><span style={{ textAlign: 'right' }}>Valor / Saldo</span><span />
                </div>
                {movimentos.map((mv, i) => (
                  <div key={mv.id} style={{ display: 'grid', gridTemplateColumns: '80px 1fr auto auto auto 90px 28px', gap: '0 12px', padding: '10px 14px', borderBottom: i < movimentos.length - 1 ? `1px solid ${cores.border}33` : 'none', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: cores.textMuted }}>{new Date(mv.data + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>{mv.descricao}</div>
                      {(mv.meta_id || mv.divida_id) && <div style={{ fontSize: 10, color: cores.textMuted }}>{mv.meta_id ? '🎯 Meta' : '💳 Dívida'}</div>}
                    </div>
                    <span style={{ fontSize: 11, color: cores.textMuted }}>{TIPO_ICONE[mv.grupo_origens?.tipo || ''] || '📦'} {mv.grupo_origens?.nome}</span>
                    <span style={{ fontSize: 11, color: cores.textMuted }}>{mv.profiles?.nome?.split(' ')[0]}</span>
                    <span style={{ fontSize: 10, color: cores.textMuted }}>{mv.categoria}</span>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: mv.tipo === 'entrada' ? '#4ade80' : '#f87171' }}>
                        {mv.tipo === 'entrada' ? '+' : '-'}{fmt(mv.valor)}
                      </div>
                      <div style={{ fontSize: 9, color: cores.textMuted }}>{fmt(mv.saldo_acumulado)}</div>
                    </div>
                    <button onClick={() => removerMovimento(mv.id, mv.origem_id, mv.tipo, mv.valor)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(239,68,68,.4)', fontSize: 14, padding: 2 }}>✕</button>
                  </div>
                ))}
                {/* Rodapé totais */}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderTop: `1px solid ${cores.border}`, background: `${cores.border}44` }}>
                  <div style={{ display: 'flex', gap: 24 }}>
                    <span style={{ fontSize: 12 }}>Entradas: <strong style={{ color: '#4ade80' }}>{fmt(movimentos.filter(m => m.tipo === 'entrada').reduce((s, m) => s + m.valor, 0))}</strong></span>
                    <span style={{ fontSize: 12 }}>Saídas: <strong style={{ color: '#f87171' }}>{fmt(movimentos.filter(m => m.tipo === 'saida').reduce((s, m) => s + m.valor, 0))}</strong></span>
                  </div>
                  <span style={{ fontSize: 12 }}>Saldo: <strong style={{ color: saldoGrupo >= 0 ? '#4ade80' : '#f87171' }}>{fmt(saldoGrupo)}</strong></span>
                </div>
                </div></div>
              </div>
            )}
          </div>
        )}

        {aba === 'dashboard' && dash && !loading && (
          <>
            {/* ── Filtro por membro / Consolidado ── */}
            <div style={{ display: 'flex', gap: 8, marginBottom: '1.25rem', flexWrap: 'wrap' as const }}>
              <button onClick={() => setMembroFiltro(null)} style={{
                padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
                background: membroFiltro === null ? '#4ade80' : 'rgba(255,255,255,.06)',
                color:      membroFiltro === null ? '#000'    : cores.textMuted,
              }}>
                🏠 Consolidado
              </button>
              {dash.membros.map((mb, idx) => (
                <button key={mb.id} onClick={() => setMembroFiltro(mb.id === membroFiltro ? null : mb.id)} style={{
                  padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: 'none',
                  background: membroFiltro === mb.id ? CORES_MEMBROS[idx % CORES_MEMBROS.length] : 'rgba(255,255,255,.06)',
                  color:      membroFiltro === mb.id ? '#000' : cores.textMuted,
                }}>
                  {mb.nome.split(' ')[0]}
                </button>
              ))}
            </div>

            {/* ── Cards: consolidado ou membro filtrado ── */}
            {(() => {
              const vis = membroFiltro ? dash.membros.filter(m => m.id === membroFiltro) : null
              const totalR = vis ? vis[0]?.receitas ?? 0 : dash.totalReceitas
              const totalD = vis ? vis[0]?.despesas ?? 0 : dash.totalDespesas
              const totalS = vis ? vis[0]?.saldo    ?? 0 : dash.totalSaldo
              return (
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
                  {[
                    { label: membroFiltro ? 'Saldo' : 'Saldo consolidado', valor: totalS, cor: totalS >= 0 ? '#4ade80' : '#f87171' },
                    { label: `Receitas — ${nomeMes}`, valor: totalR, cor: '#34d399' },
                    { label: `Gastos — ${nomeMes}`,   valor: totalD, cor: '#f87171' },
                  ].map((card, i) => (
                    <div key={i} style={{ background: cores.surface, border: `1px solid ${cores.border}`, borderRadius: 14, padding: '1.25rem' }}>
                      <div style={{ fontSize: 11, color: cores.textMuted, textTransform: 'uppercase' as const, letterSpacing: '.08em', marginBottom: 8 }}>{card.label}</div>
                      <div style={{ fontSize: 28, fontWeight: 700, color: card.cor, fontVariantNumeric: 'tabular-nums' }}>{fmt(card.valor)}</div>
                      {!membroFiltro && (
                        <div style={{ fontSize: 11, color: cores.textMuted, marginTop: 4 }}>
                          {dash.membros.filter(m => m.incluir_consolidado).length} membro{dash.membros.filter(m => m.incluir_consolidado).length !== 1 ? 's' : ''} no consolidado
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            })()}


            {/* ── Gráfico histórico ── */}
            {dash.historico.length >= 2 && (
              <div style={{ background: cores.surface, border: `1px solid ${cores.border}`, borderRadius: 14, padding: '1.25rem', marginBottom: '1.25rem' }}>
                <div style={{ fontSize: 11, color: cores.textMuted, textTransform: 'uppercase' as const, letterSpacing: '.08em', marginBottom: 10 }}>
                  Saldo consolidado — últimos 30 dias
                </div>
                <GraficoFamilia dash={dash} />
              </div>
            )}

            {/* ── Membros em grid ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
              {(membroFiltro ? dash.membros.filter(m => m.id === membroFiltro) : dash.membros).map((mb, idx) => {
                const realIdx = dash.membros.findIndex(m => m.id === mb.id)
                const corMb   = CORES_MEMBROS[realIdx % CORES_MEMBROS.length]
                const resultado = mb.receitas - mb.despesas
                return (
                  <div key={mb.id} style={{ background: cores.surface, border: `1px solid ${mb.incluir_consolidado ? cores.border : 'rgba(255,255,255,.08)'}`, borderRadius: 14, overflow: 'hidden', opacity: mb.incluir_consolidado ? 1 : 0.6 }}>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '1rem', borderBottom: `1px solid ${cores.border}`, background: `${corMb}0d` }}>
                      <Avatar url={mb.avatar_url} nome={mb.nome} size={36} nivel={1} onClick={() => {}} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{mb.nome}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                          <span style={{ fontSize: 11, color: cores.textMuted, textTransform: 'capitalize' }}>{mb.papel === 'dono' ? '👑 dono' : mb.papel === 'edicao' ? '✏️ edição' : '👁️ leitura'}</span>
                          {mb.pct_saldo !== undefined && mb.incluir_consolidado && (
                            <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: `${corMb}20`, color: corMb, border: `1px solid ${corMb}40` }}>
                              {mb.pct_saldo}% do saldo
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: mb.saldo >= 0 ? corMb : '#f87171', fontVariantNumeric: 'tabular-nums' }}>
                          {fmt(mb.saldo)}
                        </div>
                        {mb.papel !== 'dono' && mb.membro_id_row && (
                          <button
                            disabled={togglingId === mb.membro_id_row}
                            onClick={async () => {
                              setTogglingId(mb.membro_id_row!)
                              await fetch(`/api/familia/membro/${mb.membro_id_row}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ incluir_consolidado: !mb.incluir_consolidado }),
                              })
                              setDash(prev => prev ? {
                                ...prev,
                                membros: prev.membros.map(m => m.id === mb.id ? { ...m, incluir_consolidado: !m.incluir_consolidado } : m)
                              } : prev)
                              setTogglingId(null)
                            }}
                            style={{
                              fontSize: 9, padding: '2px 7px', borderRadius: 6, cursor: 'pointer',
                              background: mb.incluir_consolidado ? 'rgba(74,222,128,.1)' : 'rgba(255,255,255,.06)',
                              border: `1px solid ${mb.incluir_consolidado ? 'rgba(74,222,128,.3)' : 'rgba(255,255,255,.15)'}`,
                              color: mb.incluir_consolidado ? '#4ade80' : 'rgba(255,255,255,.35)',
                            }}
                          >
                            {togglingId === mb.membro_id_row ? '...' : mb.incluir_consolidado ? '✓ no consolidado' : '+ incluir'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Métricas do mês */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0 }}>
                      {[
                        { l: 'Receitas',  v: mb.receitas,  c: '#34d399' },
                        { l: 'Gastos',    v: mb.despesas,  c: '#f87171' },
                        { l: 'Resultado', v: resultado,    c: resultado >= 0 ? '#4ade80' : '#fb923c' },
                      ].map((cell, i) => (
                        <div key={i} style={{ padding: '10px 14px', borderRight: i < 2 ? `1px solid ${cores.border}` : 'none', borderBottom: `1px solid ${cores.border}` }}>
                          <div style={{ fontSize: 9, color: cores.textMuted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>{cell.l}</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: cell.c, fontVariantNumeric: 'tabular-nums' }}>{fmt(cell.v)}</div>
                        </div>
                      ))}
                    </div>

                    {/* Top categorias */}
                    {mb.topCats.length > 0 && (
                      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${cores.border}` }}>
                        <div style={{ fontSize: 9, color: cores.textMuted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Top gastos</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {mb.topCats.map(([cat, val]) => (
                            <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: 12, color: cores.textMuted }}>{cat}</span>
                              <span style={{ fontSize: 12, fontWeight: 500, color: '#f87171', fontVariantNumeric: 'tabular-nums' }}>{fmt(val)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Metas */}
                    {mb.metas.length > 0 && (
                      <div style={{ padding: '10px 14px' }}>
                        <div style={{ fontSize: 9, color: cores.textMuted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Metas</div>
                        {mb.metas.slice(0, 2).map((mt, i) => {
                          const pct = Math.min(100, Math.round((mt.valor_atual / mt.valor_total) * 100))
                          return (
                            <div key={i} style={{ marginBottom: i < mb.metas.slice(0, 2).length - 1 ? 6 : 0 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                <span style={{ fontSize: 11, color: cores.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{mt.nome}</span>
                                <span style={{ fontSize: 11, color: corMb }}>{pct}%</span>
                              </div>
                              <div style={{ height: 4, background: 'rgba(255,255,255,.07)', borderRadius: 2 }}>
                                <div style={{ height: '100%', width: `${pct}%`, background: corMb, borderRadius: 2 }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* ── Comparativo de gastos por membro ── */}
            {dash.membros.length > 1 && (
              <div style={{ background: cores.surface, border: `1px solid ${cores.border}`, borderRadius: 14, padding: '1.25rem' }}>
                <div style={{ fontSize: 11, color: cores.textMuted, textTransform: 'uppercase' as const, letterSpacing: '.08em', marginBottom: 14 }}>
                  Participação nos gastos — {nomeMes}
                </div>
                {(() => {
                  const maxDesp = Math.max(...dash.membros.map(m => m.despesas), 1)
                  return dash.membros.map((mb, idx) => {
                    const pct   = dash.totalDespesas > 0 ? Math.round((mb.despesas / dash.totalDespesas) * 100) : 0
                    const corMb = CORES_MEMBROS[idx % CORES_MEMBROS.length]
                    return (
                      <div key={mb.id} style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 13 }}>{mb.nome}</span>
                          <span style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(mb.despesas)} <span style={{ fontSize: 11, color: cores.textMuted, fontWeight: 400 }}>({pct}%)</span></span>
                        </div>
                        <div style={{ height: 7, background: 'rgba(255,255,255,.06)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${(mb.despesas / maxDesp) * 100}%`, background: corMb, borderRadius: 4, transition: 'width .6s ease' }} />
                        </div>
                      </div>
                    )
                  })
                })()}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
