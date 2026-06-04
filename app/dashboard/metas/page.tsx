'use client'

import { useEffect, useMemo, useCallback, useState } from 'react'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { SkeletonMetas } from '@/components/Skeleton'
import { usePerfil } from '@/hooks/usePerfil'
import { useToast, Toasts } from '@/components/Toast'

interface Meta {
  id: string
  nome: string
  tipo: 'acumulacao' | 'emergencia' | 'limite'
  valor_total: number
  valor_atual: number
  contribuicao_mensal: number | null
  prazo: string | null
  categoria_vinculada: string | null
  ativo: boolean
  created_at: string
}

interface AlertaRegra {
  id: string
  tipo: string
  ativo: boolean
  canais: string[]
  threshold_pct: number | null
}

interface Aporte {
  id: string
  meta_id: string
  valor: number
  nota: string | null
  data: string
  created_at: string
}

interface MetaFamilia extends Meta {
  dono: { nome: string; avatar_url: string | null }
  dono_id: string
  aportes: Aporte[]
  e_minha: boolean
}

const MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']

function fmtBRL(v: number) {
  return 'R$ ' + Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function calcPrevisao(total: number, atual: number, contrib: number) {
  if (!contrib || contrib <= 0) return null
  const meses = Math.ceil((total - atual) / contrib)
  if (meses <= 0) return 'Concluída!'
  const d = new Date()
  d.setMonth(d.getMonth() + meses)
  return `${MESES[d.getMonth()]}/${String(d.getFullYear()).slice(2)} (${meses} meses)`
}

function PctBar({ pct, cor = '#4ade80' }: { pct: number; cor?: string }) {
  return (
    <div style={{ height: 6, background: 'rgba(255,255,255,.06)', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: cor, borderRadius: 3, transition: 'width .5s' }} />
    </div>
  )
}

function AportarRapido({ metaId, onAportar }: { metaId: string; onAportar: (id: string, valor: number) => Promise<void> }) {
  const [valor, setValor] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const v = parseFloat(valor.replace(',', '.'))
    if (!v || v <= 0) return
    setSalvando(true)
    await onAportar(metaId, v)
    setValor('')
    setSalvando(false)
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <input
        value={valor}
        onChange={e => setValor(e.target.value)}
        placeholder="R$ 0,00"
        style={{ width: 90, padding: '5px 8px', background: '#0a0a0a', border: '1px solid #1a3a1a', borderRadius: 6, color: '#fff', fontSize: 11, outline: 'none' }}
      />
      <button type="submit" disabled={salvando} style={{ padding: '5px 10px', background: 'rgba(74,222,128,.15)', border: '1px solid rgba(74,222,128,.3)', borderRadius: 6, color: '#4ade80', fontSize: 11, fontWeight: 600, cursor: salvando ? 'default' : 'pointer', opacity: salvando ? 0.6 : 1 }}>
        {salvando ? '...' : '+ Depositar'}
      </button>
    </form>
  )
}

export default function MetasPage() {
  const router = useRouter()
  const supabase = createClient()
  const { fmtMes } = usePerfil()
  const { show, toasts, fechar } = useToast()

  const [metas, setMetas]         = useState<Meta[]>([])
  const [alertas, setAlertas]     = useState<AlertaRegra[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [metaSel, setMetaSel]     = useState<Meta | null>(null)
  const [salvando, setSalvando]   = useState(false)
  const [erro, setErro]           = useState('')
  const [abaSel, setAbaSel]       = useState<'metas' | 'alertas' | 'familia'>('metas')
  const [sortMetas, setSortMetas] = useState<'progresso' | 'nome' | 'valor'>('progresso')

  const metasOrdenadas = useMemo(() => [...metas].sort((a, b) => {
    if (sortMetas === 'nome')  return a.nome.localeCompare(b.nome)
    if (sortMetas === 'valor') return b.valor_total - a.valor_total
    const pctA = a.valor_total > 0 ? a.valor_atual / a.valor_total : 0
    const pctB = b.valor_total > 0 ? b.valor_atual / b.valor_total : 0
    return pctB - pctA
  }), [metas, sortMetas])
  const [userId, setUserId]       = useState('')

  // compartilhamento familiar
  const [compartilhadas,    setCompartilhadas]    = useState<Record<string, boolean>>({})
  const [metasFamilia,      setMetasFamilia]      = useState<MetaFamilia[]>([])
  const [loadFamilia,       setLoadFamilia]       = useState(false)
  const [toggling,          setToggling]          = useState<string | null>(null)
  const [temFamilia,        setTemFamilia]        = useState(false)

  const [form, setForm] = useState({
    nome: '', tipo: 'acumulacao', valor_total: '',
    valor_atual: '0', contribuicao_mensal: '', prazo: '', categoria_vinculada: '',
  })

  const trapMeta    = useFocusTrap(showForm)

  // aportes
  const [metaAporte,   setMetaAporte]   = useState<Meta | null>(null)
  const [aportes,      setAportes]      = useState<Aporte[]>([])
  const [loadAportes,  setLoadAportes]  = useState(false)
  const [formAporte,   setFormAporte]   = useState({ valor: '', nota: '', data: new Date().toISOString().slice(0, 10) })
  const trapAportes = useFocusTrap(!!metaAporte)
  const [salvandoAporte, setSalvandoAporte] = useState(false)
  const [erroAporte,   setErroAporte]   = useState('')

  async function carregar() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setUserId(user.id)

    const [{ data: mt }, { data: al }] = await Promise.all([
      supabase.from('goals').select('*').eq('user_id', user.id).eq('ativo', true).order('created_at', { ascending: false }),
      supabase.from('alert_rules').select('*').eq('user_id', user.id),
    ])
    if (mt) setMetas(mt)
    if (al) setAlertas(al)
    setLoading(false)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel('metas-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'goals', filter: `user_id=eq.${userId}` }, () => { carregar() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  useEffect(() => {
    if (abaSel === 'familia') carregarFamilia()  
   
  }, [abaSel])

  const carregarFamilia = useCallback(async function carregarFamilia() {
    setLoadFamilia(true)
    const [famRes, compRes] = await Promise.all([
      fetch('/api/familia'),
      fetch('/api/metas/compartilhadas'),
    ])
    const famData = await famRes.json()
    const compData = await compRes.json()
    setTemFamilia(!!(famData.grupo || famData.grupo_id))
    setMetasFamilia(compData.metas || [])
    const map: Record<string, boolean> = {}
    for (const m of (compData.metas || []) as MetaFamilia[]) {
      if (m.e_minha) map[m.id] = true
    }
    setCompartilhadas(map)
    setLoadFamilia(false)
  }

  async function toggleCompartilhar(m: Meta) {
    setToggling(m.id)
    const jaComp = compartilhadas[m.id]
    const res = await fetch(`/api/metas/${m.id}/compartilhar`, { method: jaComp ? 'DELETE' : 'POST' })
    if (res.ok) {
      setCompartilhadas(prev => ({ ...prev, [m.id]: !jaComp }))
      if (abaSel === 'familia') await carregarFamilia()
    }
    setToggling(null)
  }

  async function aportarMetaFamilia(metaId: string, valor: number) {
    const res = await fetch(`/api/metas/${metaId}/aportes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valor, data: new Date().toISOString().slice(0, 10) }),
    })
    if (res.ok) {
      const d = await res.json()
      setMetasFamilia(prev => prev.map(m => m.id === metaId
        ? { ...m, valor_atual: d.valor_atual, aportes: [d.aporte, ...m.aportes] }
        : m
      ))
    }
  }

  async function abrirAportes(m: Meta) {
    setMetaAporte(m)
    setFormAporte({ valor: '', nota: '', data: new Date().toISOString().slice(0, 10) })
    setErroAporte('')
    setLoadAportes(true)
    const res = await fetch(`/api/metas/${m.id}/aportes`)
    const d = await res.json()
    setAportes(d.aportes || [])
    setLoadAportes(false)
  }

  async function registrarAporte(e: React.FormEvent) {
    e.preventDefault()
    const v = parseFloat(formAporte.valor.replace(',', '.'))
    if (!v || v <= 0) { setErroAporte('Valor inválido'); return }
    setSalvandoAporte(true); setErroAporte('')
    const res = await fetch(`/api/metas/${metaAporte!.id}/aportes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valor: v, nota: formAporte.nota || null, data: formAporte.data }),
    })
    const d = await res.json()
    if (!res.ok) { setErroAporte(d.error || 'Erro'); setSalvandoAporte(false); return }
    setMetas(prev => prev.map(m => m.id === metaAporte!.id ? { ...m, valor_atual: d.valor_atual } : m))
    setMetaAporte(prev => prev ? { ...prev, valor_atual: d.valor_atual } : prev)
    setAportes(prev => [d.aporte, ...prev])
    setFormAporte(p => ({ ...p, valor: '', nota: '' }))
    setSalvandoAporte(false)
    show(`Depósito de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)} registrado`)
  }

  async function removerAporte(aporte_id: string, valor: number) {
    if (!confirm('Remover este aporte? O valor será descontado do progresso da meta.')) return
    await fetch(`/api/metas/${metaAporte!.id}/aportes`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aporte_id }),
    })
    setAportes(prev => prev.filter(a => a.id !== aporte_id))
    const novoValor = Math.max(0, (metaAporte?.valor_atual || 0) - valor)
    setMetas(prev => prev.map(m => m.id === metaAporte!.id ? { ...m, valor_atual: novoValor } : m))
    setMetaAporte(prev => prev ? { ...prev, valor_atual: novoValor } : prev)
    show('Depósito removido')
  }

  function calcProjecaoAportes(meta: Meta, historicoAportes: Aporte[]) {
    if (meta.valor_atual >= meta.valor_total) return 'Concluída!'
    const ultimos = historicoAportes.slice(0, 3)
    if (ultimos.length === 0) return null
    const media = ultimos.reduce((s, a) => s + a.valor, 0) / ultimos.length
    if (media <= 0) return null
    const meses = Math.ceil((meta.valor_total - meta.valor_atual) / media)
    const d = new Date()
    d.setMonth(d.getMonth() + meses)
    return `${MESES[d.getMonth()]}/${String(d.getFullYear()).slice(2)} (~${meses} meses, média ${fmtBRL(media)}/mês)`
  }

  async function salvarMeta(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (!form.nome.trim()) { setErro('Nome obrigatório'); return }
    if (!form.valor_total || parseFloat(form.valor_total) <= 0) { setErro('Valor total inválido'); return }
    if (form.valor_atual && parseFloat(form.valor_atual) > parseFloat(form.valor_total)) { setErro('Valor atual não pode exceder o valor total da meta'); return }
    if (form.prazo) {
      const hoje = new Date()
      const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
      if (form.prazo < mesAtual) { setErro('O prazo não pode ser no passado'); return }
    }

    setSalvando(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const payload = {
      user_id: user.id,
      nome: form.nome.trim(),
      tipo: form.tipo,
      valor_total: parseFloat(form.valor_total),
      valor_atual: parseFloat(form.valor_atual) || 0,
      contribuicao_mensal: form.contribuicao_mensal ? parseFloat(form.contribuicao_mensal) : null,
      prazo: form.prazo || null,
      categoria_vinculada: form.categoria_vinculada || null,
      ativo: true,
    }

    if (metaSel) {
      await supabase.from('goals').update(payload).eq('id', metaSel.id)
    } else {
      await supabase.from('goals').insert(payload)
    }

    setSalvando(false)
    setShowForm(false)
    show(metaSel ? 'Meta atualizada' : 'Meta criada')
    setMetaSel(null)
    resetForm()
    carregar()
  }

  async function excluirMeta(id: string) {
    await supabase.from('goals').update({ ativo: false }).eq('id', id)
    show('Meta excluída')
    carregar()
  }

  async function toggleAlerta(id: string, ativo: boolean) {
    await supabase.from('alert_rules').update({ ativo: !ativo }).eq('id', id)
    carregar()
  }

  async function toggleCanal(id: string, canal: string, canais: string[]) {
    const novos = canais.includes(canal)
      ? canais.filter(c => c !== canal)
      : [...canais, canal]
    await supabase.from('alert_rules').update({ canais: novos }).eq('id', id)
    carregar()
  }

  function editarMeta(m: Meta) {
    setMetaSel(m)
    setForm({
      nome: m.nome, tipo: m.tipo,
      valor_total: String(m.valor_total),
      valor_atual: String(m.valor_atual),
      contribuicao_mensal: m.contribuicao_mensal ? String(m.contribuicao_mensal) : '',
      prazo: m.prazo ? m.prazo.slice(0, 7) : '',
      categoria_vinculada: m.categoria_vinculada || '',
    })
    setShowForm(true)
  }

  function resetForm() {
    setForm({ nome: '', tipo: 'acumulacao', valor_total: '', valor_atual: '0', contribuicao_mensal: '', prazo: '', categoria_vinculada: '' })
    setMetaSel(null)
    setErro('')
  }

  const previsao = calcPrevisao(
    parseFloat(form.valor_total) || 0,
    parseFloat(form.valor_atual) || 0,
    parseFloat(form.contribuicao_mensal) || 0
  )

  if (loading) return <SkeletonMetas />

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: 'system-ui, sans-serif', fontSize: 15, color: '#fff' }}>

      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.875rem 1.5rem', borderBottom: '1px solid #1a3a1a', background: '#0a1a0a' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.4)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Dashboard
          </button>
          <span style={{ color: 'rgba(255,255,255,.2)' }}>/</span>
          <span style={{ fontSize: 15, fontWeight: 500 }}>Metas</span>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true) }} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
          background: '#16a34a', border: 'none', borderRadius: 8,
          color: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer',
        }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          Nova meta
        </button>
      </div>

      <div style={{ padding: '1.5rem' }}>

        {/* Abas */}
        <div style={{ display: 'flex', gap: 5, background: 'rgba(0,0,0,.3)', border: '1px solid #1a3a1a', borderRadius: 8, padding: 3, marginBottom: '1.5rem', width: 'fit-content' }}>
          {([
            { id: 'metas',   label: `Minhas metas (${metas.length})` },
            { id: 'familia', label: '👨‍👩‍👧 Família' },
            { id: 'alertas', label: `Alertas (${alertas.length})` },
          ] as const).map(a => (
            <button key={a.id} onClick={() => setAbaSel(a.id)} style={{
              padding: '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
              background: abaSel === a.id ? '#16a34a' : 'transparent',
              color: abaSel === a.id ? '#fff' : 'rgba(255,255,255,.4)',
            }}>
              {a.label}
            </button>
          ))}
        </div>

        {/* ── METAS ── */}
        {abaSel === 'metas' && (
          <>
            {metas.length === 0 ? (
              <div style={{ maxWidth: 560, margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                  <div style={{ fontSize: 40, marginBottom: 10 }}>🎯</div>
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Nenhuma meta ainda</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', lineHeight: 1.6 }}>
                    Crie sua primeira meta e comece a acumular XP. Escolha um modelo ou crie do zero.
                  </div>
                </div>
                {/* Templates de metas */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 16 }}>
                  {[
                    { emoji: '🏦', nome: 'Reserva de emergência', valor: '10000', contrib: '500', tipo: 'emergencia' as const },
                    { emoji: '✈️', nome: 'Viagem',                valor: '5000',  contrib: '300', tipo: 'acumulacao' as const },
                    { emoji: '📱', nome: 'Novo celular',           valor: '3000',  contrib: '200', tipo: 'acumulacao' as const },
                    { emoji: '🏠', nome: 'Apartamento próprio',    valor: '50000', contrib: '1000', tipo: 'acumulacao' as const },
                  ].map(t => (
                    <button key={t.nome} onClick={() => {
                      setForm({ nome: t.nome, tipo: t.tipo, valor_total: t.valor, valor_atual: '0', contribuicao_mensal: t.contrib, prazo: '', categoria_vinculada: '' })
                      setShowForm(true)
                    }} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                      background: '#111', border: '1px solid #1a3a1a', borderRadius: 10,
                      cursor: 'pointer', textAlign: 'left', transition: 'border-color .15s',
                    }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = '#16a34a')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = '#1a3a1a')}>
                      <span style={{ fontSize: 24, flexShrink: 0 }}>{t.emoji}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>{t.nome}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', marginTop: 2 }}>
                          R$ {parseInt(t.valor).toLocaleString('pt-BR')} · R$ {parseInt(t.contrib).toLocaleString('pt-BR')}/mês
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                <button onClick={() => { resetForm(); setShowForm(true) }} style={{
                  width: '100%', padding: '11px', background: 'transparent', border: '1px dashed #1a3a1a',
                  borderRadius: 10, color: 'rgba(255,255,255,.4)', fontSize: 13, cursor: 'pointer',
                  transition: 'all .15s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#16a34a'; e.currentTarget.style.color = '#4ade80' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#1a3a1a'; e.currentTarget.style.color = 'rgba(255,255,255,.4)' }}>
                  + Criar meta personalizada
                </button>
              </div>
            ) : (
              <>
                {/* Ordenação */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>Ordenar:</span>
                  {([
                    { id: 'progresso', label: '% Progresso' },
                    { id: 'nome',      label: 'Nome A-Z' },
                    { id: 'valor',     label: 'Valor' },
                  ] as const).map(op => (
                    <button key={op.id} onClick={() => setSortMetas(op.id)} style={{
                      padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11,
                      background: sortMetas === op.id ? '#16a34a' : 'rgba(255,255,255,.07)',
                      color: sortMetas === op.id ? '#fff' : 'rgba(255,255,255,.45)',
                    }}>{op.label}</button>
                  ))}
                </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
                {metasOrdenadas.map(m => {
                  const pct = m.valor_total > 0 ? Math.min(Math.round((m.valor_atual / m.valor_total) * 100), 100) : 0
                  const prev = calcPrevisao(m.valor_total, m.valor_atual, m.contribuicao_mensal || 0)
                  const cor = pct >= 100 ? '#4ade80' : pct >= 50 ? '#22d3ee' : '#16a34a'
                  return (
                    <div key={m.id} style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 12, padding: '1.1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>{m.nome}</div>
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                            {m.tipo === 'acumulacao' ? 'Acumulação' : m.tipo === 'emergencia' ? 'Emergência' : 'Limite mensal'}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 200 }}>
                          <button onClick={() => abrirAportes(m)} style={{ background: 'rgba(74,222,128,.12)', border: '1px solid rgba(74,222,128,.3)', borderRadius: 6, padding: '10px 12px', minHeight: 44, cursor: 'pointer', color: '#4ade80', fontSize: 12, fontWeight: 600 }}>
                            + Depositar
                          </button>
                          <button
                            onClick={() => toggleCompartilhar(m)}
                            disabled={toggling === m.id}
                            aria-label={compartilhadas[m.id] ? 'Parar de compartilhar' : 'Compartilhar com família'}
                            title={compartilhadas[m.id] ? 'Parar de compartilhar' : 'Compartilhar com família'}
                            style={{ background: compartilhadas[m.id] ? 'rgba(251,191,36,.12)' : 'rgba(255,255,255,.05)', border: `1px solid ${compartilhadas[m.id] ? 'rgba(251,191,36,.4)' : 'rgba(255,255,255,.1)'}`, borderRadius: 6, padding: '10px 10px', minHeight: 44, cursor: toggling === m.id ? 'default' : 'pointer', color: compartilhadas[m.id] ? '#fbbf24' : 'rgba(255,255,255,.35)', fontSize: 14, opacity: toggling === m.id ? 0.5 : 1 }}>
                            {compartilhadas[m.id] ? '👨‍👩‍👧' : '🔗'}
                          </button>
                          <button onClick={() => editarMeta(m)} style={{ background: 'rgba(255,255,255,.06)', border: 'none', borderRadius: 6, padding: '10px 10px', minHeight: 44, cursor: 'pointer', color: 'rgba(255,255,255,.5)', fontSize: 12 }}>
                            Editar
                          </button>
                          <button onClick={() => excluirMeta(m.id)} style={{ background: 'rgba(239,68,68,.1)', border: 'none', borderRadius: 6, padding: '10px 10px', minHeight: 44, cursor: 'pointer', color: '#f87171', fontSize: 12 }}>
                            Excluir
                          </button>
                        </div>
                      </div>

                      {/* Valores */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                        <div style={{ fontSize: 22, fontWeight: 500, color: cor }}>{fmtBRL(m.valor_atual)}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>de {fmtBRL(m.valor_total)}</div>
                      </div>

                      {/* Barra */}
                      <PctBar pct={pct} cor={cor} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, marginBottom: 10 }}>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,.35)' }}>{pct}% concluído</span>
                        {pct >= 100 && <span style={{ fontSize: 10, background: 'rgba(74,222,128,.15)', color: '#4ade80', padding: '1px 8px', borderRadius: 4 }}>✓ Concluída!</span>}
                      </div>

                      {/* Detalhes */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, paddingTop: 10, borderTop: '1px solid #1a3a1a' }}>
                        {m.contribuicao_mensal && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                            <span style={{ color: 'rgba(255,255,255,.4)' }}>Contribuição/mês</span>
                            <span style={{ color: '#4ade80', fontWeight: 500 }}>{fmtBRL(m.contribuicao_mensal)}</span>
                          </div>
                        )}
                        {prev && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                            <span style={{ color: 'rgba(255,255,255,.4)' }}>Previsão</span>
                            <span style={{ color: '#fff' }}>{prev}</span>
                          </div>
                        )}
                        {m.prazo && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                            <span style={{ color: 'rgba(255,255,255,.4)' }}>Prazo</span>
                            <span style={{ color: '#fff' }}>{fmtMes(m.prazo)}</span>
                          </div>
                        )}
                      </div>

                      {/* Marcos */}
                      <div style={{ display: 'flex', gap: 5, marginTop: 10 }}>
                        {[25, 50, 75, 100].map(marco => (
                          <div key={marco} style={{
                            flex: 1, textAlign: 'center', padding: '4px 0',
                            background: pct >= marco ? 'rgba(74,222,128,.15)' : 'rgba(255,255,255,.03)',
                            border: `1px solid ${pct >= marco ? 'rgba(74,222,128,.3)' : '#1a3a1a'}`,
                            borderRadius: 6, fontSize: 10,
                            color: pct >= marco ? '#4ade80' : 'rgba(255,255,255,.35)',
                          }}>
                            {marco}%
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
              </>
            )}
          </>
        )}

        {/* ── ALERTAS ── */}
        {abaSel === 'alertas' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {alertas.length === 0 ? (
              <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 12, padding: '2rem', textAlign: 'center', color: 'rgba(255,255,255,.4)', fontSize: 13 }}>
                Nenhuma regra de alerta. As regras padrão são criadas automaticamente ao se cadastrar.
              </div>
            ) : alertas.map(a => (
              <div key={a.id} style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 12, padding: '1rem', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 3 }}>
                    {{
                      receita_recebida: '💰 Receita recebida — sugerir aporte',
                      marco_meta: '🎯 Marco de meta atingido (25/50/75/100%)',
                      limite_categoria: '⚠️ Categoria atingiu o limite',
                      fim_mes: '📅 Fim do mês sem contribuição',
                    }[a.tipo] || a.tipo}
                  </div>
                  <div style={{ display: 'flex', gap: 5, marginTop: 8 }}>
                    {['push', 'email', 'whatsapp'].map(canal => (
                      <button key={canal} onClick={() => toggleCanal(a.id, canal, a.canais)} style={{
                        fontSize: 10, padding: '3px 9px', borderRadius: 20, cursor: 'pointer',
                        border: `1px solid ${a.canais.includes(canal) ? 'rgba(74,222,128,.4)' : '#1a3a1a'}`,
                        background: a.canais.includes(canal) ? 'rgba(74,222,128,.1)' : 'transparent',
                        color: a.canais.includes(canal) ? '#4ade80' : 'rgba(255,255,255,.3)',
                        transition: 'all .15s',
                      }}>
                        {canal}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Toggle ativo */}
                <div role="switch" aria-checked={a.ativo} aria-label="Ativar/desativar alerta" tabIndex={0}
                  onClick={() => toggleAlerta(a.id, a.ativo)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleAlerta(a.id, a.ativo) } }}
                  style={{
                    width: 36, height: 20, borderRadius: 10, cursor: 'pointer',
                    background: a.ativo ? '#16a34a' : 'rgba(255,255,255,.1)',
                    position: 'relative', transition: 'background .2s', flexShrink: 0, marginTop: 2,
                  }}>
                  <div style={{
                    position: 'absolute', top: 3, left: a.ativo ? 18 : 3,
                    width: 14, height: 14, borderRadius: '50%', background: '#fff',
                    transition: 'left .2s',
                  }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── FAMÍLIA ── */}
        {abaSel === 'familia' && (
          <div>
            {loadFamilia ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'rgba(255,255,255,.4)', fontSize: 13 }}>Carregando...</div>
            ) : !temFamilia ? (
              <div style={{ background: '#111', border: '1px dashed #1a3a1a', borderRadius: 12, padding: '3rem', textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>👨‍👩‍👧</div>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Você não pertence a nenhuma família</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', marginBottom: 20 }}>Configure sua família em Configurações → Família para compartilhar metas</div>
                <button onClick={() => router.push('/dashboard/perfil')} style={{ padding: '9px 20px', background: '#16a34a', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                  Configurar família
                </button>
              </div>
            ) : metasFamilia.length === 0 ? (
              <div style={{ background: '#111', border: '1px dashed #1a3a1a', borderRadius: 12, padding: '3rem', textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🔗</div>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Nenhuma meta compartilhada ainda</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)' }}>Na aba &ldquo;Minhas metas&rdquo;, clique em 🔗 para compartilhar uma meta com a família</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {metasFamilia.map(m => {
                  const pct = m.valor_total > 0 ? Math.min(Math.round((m.valor_atual / m.valor_total) * 100), 100) : 0
                  const cor = pct >= 100 ? '#4ade80' : pct >= 50 ? '#22d3ee' : '#16a34a'
                  const totalAportes = m.aportes.reduce((s, a) => s + a.valor, 0)
                  return (
                    <div key={m.id} style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 12, padding: '1.1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                            <div style={{ fontSize: 14, fontWeight: 500 }}>{m.nome}</div>
                            <span style={{ fontSize: 10, background: 'rgba(251,191,36,.12)', border: '1px solid rgba(251,191,36,.3)', color: '#fbbf24', borderRadius: 4, padding: '1px 6px' }}>👨‍👩‍👧 Família</span>
                          </div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>por {m.dono.nome}</div>
                        </div>
                        {!m.e_minha && (
                          <AportarRapido metaId={m.id} onAportar={aportarMetaFamilia} />
                        )}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                        <div style={{ fontSize: 20, fontWeight: 500, color: cor }}>{fmtBRL(m.valor_atual)}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>de {fmtBRL(m.valor_total)}</div>
                      </div>
                      <PctBar pct={pct} cor={cor} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, marginBottom: 10 }}>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,.35)' }}>{pct}% concluído</span>
                        {pct >= 100 && <span style={{ fontSize: 10, background: 'rgba(74,222,128,.15)', color: '#4ade80', padding: '1px 8px', borderRadius: 4 }}>✓ Concluída!</span>}
                      </div>

                      {/* Depósitos recentes */}
                      {m.aportes.length > 0 && (
                        <div style={{ borderTop: '1px solid #1a3a1a', paddingTop: 10 }}>
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                            {m.aportes.length} aporte{m.aportes.length !== 1 ? 's' : ''} · total {fmtBRL(totalAportes)}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {m.aportes.slice(0, 3).map(a => (
                              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                                <span style={{ color: 'rgba(255,255,255,.4)' }}>{new Date(a.data + 'T12:00:00').toLocaleDateString('pt-BR')}{a.nota ? ` · ${a.nota}` : ''}</span>
                                <span style={{ color: '#4ade80', fontWeight: 600 }}>+{fmtBRL(a.valor)}</span>
                              </div>
                            ))}
                            {m.aportes.length > 3 && <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)' }}>+{m.aportes.length - 3} mais...</div>}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── MODAL CRIAR/EDITAR META ── */}
      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 50, padding: '1rem',
        }}>
          <div ref={trapMeta} role="dialog" aria-modal="true" aria-labelledby="modal-meta-titulo" style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 16, padding: '1.5rem', width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div id="modal-meta-titulo" style={{ fontSize: 16, fontWeight: 500 }}>{metaSel ? 'Editar meta' : 'Nova meta'}</div>
              <button onClick={() => { setShowForm(false); resetForm() }} aria-label="Fechar formulário" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.4)', fontSize: 18, lineHeight: 1 }}>×</button>
            </div>

            {erro && <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#f87171', marginBottom: 12 }}>{erro}</div>}

            <form onSubmit={salvarMeta}>
              {/* Tipo */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,.5)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>Tipo</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                  {[
                    { v: 'acumulacao', label: '📈 Acumulação' },
                    { v: 'emergencia', label: '🛡️ Emergência' },
                    { v: 'limite',     label: '⏱️ Limite' },
                  ].map(t => (
                    <button key={t.v} type="button" onClick={() => setForm(p => ({ ...p, tipo: t.v }))} style={{
                      padding: '8px 4px', borderRadius: 8, border: `1px solid ${form.tipo === t.v ? '#16a34a' : '#1a3a1a'}`,
                      background: form.tipo === t.v ? 'rgba(22,163,74,.15)' : 'transparent',
                      color: form.tipo === t.v ? '#4ade80' : 'rgba(255,255,255,.5)',
                      fontSize: 11, cursor: 'pointer', fontWeight: form.tipo === t.v ? 500 : 400,
                    }}>{t.label}</button>
                  ))}
                </div>
              </div>

              {/* Campos */}
              {[
                { label: 'Nome da meta', key: 'nome', type: 'text', placeholder: 'Ex: Viagem Europa, Reserva...' },
                { label: 'Valor total (R$)', key: 'valor_total', type: 'number', placeholder: '10000' },
                { label: 'Já tenho (R$)', key: 'valor_atual', type: 'number', placeholder: '0' },
                { label: 'Contribuição mensal (R$)', key: 'contribuicao_mensal', type: 'number', placeholder: '500' },
              ].map(f => (
                <div key={f.key} style={{ marginBottom: 12 }}>
                  <label htmlFor={`meta-${f.key}`} style={{ display: 'block', fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,.5)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' }}>{f.label}</label>
                  <input
                    id={`meta-${f.key}`}
                    type={f.type} placeholder={f.placeholder}
                    value={form[f.key as keyof typeof form]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', background: '#0a1a0a', border: '1px solid #1a3a1a', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none' }}
                  />
                </div>
              ))}

              <div style={{ marginBottom: 14 }}>
                <label htmlFor="meta-prazo" style={{ display: 'block', fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,.5)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' }}>Prazo (opcional)</label>
                <input id="meta-prazo" type="month" value={form.prazo} onChange={e => setForm(p => ({ ...p, prazo: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', background: '#0a1a0a', border: '1px solid #1a3a1a', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none' }}
                />
              </div>

              {/* Previsão dinâmica */}
              {previsao && (
                <div style={{ background: 'rgba(74,222,128,.07)', border: '1px solid rgba(74,222,128,.2)', borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>
                  <div style={{ fontSize: 10, color: 'rgba(74,222,128,.7)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>Previsão dinâmica</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#4ade80' }}>{previsao}</div>
                  {form.contribuicao_mensal && form.valor_total && (
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginTop: 3 }}>
                      guardando {fmtBRL(parseFloat(form.contribuicao_mensal))} por mês
                    </div>
                  )}
                </div>
              )}

              <button type="submit" disabled={salvando} style={{
                width: '100%', padding: 11, background: '#16a34a', border: 'none',
                borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 500,
                cursor: salvando ? 'default' : 'pointer', opacity: salvando ? 0.6 : 1,
              }}>
                {salvando ? 'Salvando...' : metaSel ? 'Salvar alterações' : 'Criar meta'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL APORTES ── */}
      {metaAporte && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '1rem' }}>
          <div ref={trapAportes} role="dialog" aria-modal="true" aria-labelledby="modal-aportes-titulo" style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 16, padding: '1.5rem', width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <div id="modal-aportes-titulo" style={{ fontSize: 15, fontWeight: 600 }}>💰 Depósitos — {metaAporte.nome}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>
                  {fmtBRL(metaAporte.valor_atual)} de {fmtBRL(metaAporte.valor_total)} ({metaAporte.valor_total > 0 ? Math.round(metaAporte.valor_atual / metaAporte.valor_total * 100) : 0}%)
                </div>
              </div>
              <button onClick={() => setMetaAporte(null)} aria-label="Fechar aportes" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.4)', fontSize: 20, lineHeight: 1 }}>×</button>
            </div>

            {/* Barra de progresso */}
            <div style={{ marginBottom: '1.25rem' }}>
              <PctBar pct={metaAporte.valor_total > 0 ? Math.round(metaAporte.valor_atual / metaAporte.valor_total * 100) : 0} cor={metaAporte.valor_atual >= metaAporte.valor_total ? '#4ade80' : '#22d3ee'} />
            </div>

            {/* Projeção baseada nos aportes */}
            {aportes.length > 0 && (() => {
              const proj = calcProjecaoAportes(metaAporte, aportes)
              return proj ? (
                <div style={{ background: 'rgba(34,211,238,.07)', border: '1px solid rgba(34,211,238,.2)', borderRadius: 8, padding: '10px 14px', marginBottom: '1.25rem', fontSize: 12, color: '#22d3ee', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 16 }}>📅</span>
                  <span>Projeção: <strong>{proj}</strong></span>
                </div>
              ) : null
            })()}

            {/* Formulário novo aporte */}
            <form onSubmit={registrarAporte} style={{ background: 'rgba(255,255,255,.03)', border: '1px solid #1a3a1a', borderRadius: 10, padding: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.5)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12 }}>Novo depósito</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label htmlFor="aporte-valor" style={{ display: 'block', fontSize: 10, color: 'rgba(255,255,255,.4)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>Valor (R$)</label>
                  <input
                    id="aporte-valor"
                    value={formAporte.valor}
                    onChange={e => setFormAporte(p => ({ ...p, valor: e.target.value }))}
                    placeholder="0,00"
                    style={{ width: '100%', padding: '8px 10px', background: '#0a0a0a', border: '1px solid #1a3a1a', borderRadius: 7, color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label htmlFor="aporte-data" style={{ display: 'block', fontSize: 10, color: 'rgba(255,255,255,.4)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>Data</label>
                  <input
                    id="aporte-data"
                    type="date"
                    value={formAporte.data}
                    onChange={e => setFormAporte(p => ({ ...p, data: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', background: '#0a0a0a', border: '1px solid #1a3a1a', borderRadius: 7, color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box', colorScheme: 'dark' }}
                  />
                </div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label htmlFor="aporte-nota" style={{ display: 'block', fontSize: 10, color: 'rgba(255,255,255,.4)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>Nota (opcional)</label>
                <input
                  id="aporte-nota"
                  value={formAporte.nota}
                  onChange={e => setFormAporte(p => ({ ...p, nota: e.target.value }))}
                  placeholder="Ex: Bônus de abril, 13º salário..."
                  style={{ width: '100%', padding: '8px 10px', background: '#0a0a0a', border: '1px solid #1a3a1a', borderRadius: 7, color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              {erroAporte && <div style={{ fontSize: 12, color: '#f87171', marginBottom: 8 }}>{erroAporte}</div>}
              <button type="submit" disabled={salvandoAporte} style={{ padding: '8px 20px', background: '#16a34a', border: 'none', borderRadius: 7, color: '#fff', fontSize: 13, fontWeight: 600, cursor: salvandoAporte ? 'default' : 'pointer', opacity: salvandoAporte ? 0.6 : 1 }}>
                {salvandoAporte ? 'Registrando...' : 'Registrar aporte'}
              </button>
            </form>

            {/* Histórico */}
            <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.5)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
              Histórico ({aportes.length})
            </div>
            {loadAportes ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: 'rgba(255,255,255,.3)', fontSize: 13 }}>Carregando...</div>
            ) : aportes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: 'rgba(255,255,255,.3)', fontSize: 13 }}>Nenhum aporte ainda.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {aportes.map(a => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'rgba(255,255,255,.03)', border: '1px solid #1a3a1a', borderRadius: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#4ade80' }}>+{fmtBRL(a.valor)}</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', marginTop: 1 }}>
                        {new Date(a.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                        {a.nota && <span style={{ marginLeft: 6 }}>· {a.nota}</span>}
                      </div>
                    </div>
                    <button onClick={() => removerAporte(a.id, a.valor)} aria-label="Remover aporte" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(239,68,68,.5)', fontSize: 15, padding: 4, lineHeight: 1 }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      <Toasts toasts={toasts} fechar={fechar} />
    </div>
  )
}
