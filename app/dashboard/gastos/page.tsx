'use client'

import { useCallback, useEffect, useState, useMemo, Suspense, useRef } from 'react'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import PoupaUpLogo from '@/components/PoupaUpLogo'
import { usePerfil } from '@/hooks/usePerfil'

interface Transacao {
  id: string
  descricao: string
  valor: number
  tipo: 'debito' | 'credito'
  categoria: string
  data_hora: string
  origem: string
  conta_id?: string
}

const CORES: Record<string, string> = {
  'Alimentação': '#4ade80',
  'Transporte':  '#22d3ee',
  'Lazer':       '#f97316',
  'Saúde':       '#a78bfa',
  'Moradia':     '#fbbf24',
  'Educação':    '#60a5fa',
  'Receita':     '#4ade80',
  'Salário':     '#4ade80',
  'Freelance':   '#34d399',
  'Investimento':'#818cf8',
  'Presente':    '#f472b6',
  'Outros':      '#6b7280',
}

const TODAS_CATEGORIAS = ['Alimentação', 'Transporte', 'Lazer', 'Saúde', 'Moradia', 'Educação', 'Salário', 'Freelance', 'Investimento', 'Presente', 'Outros']

function fmtBRL(v: number) {
  return 'R$ ' + Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function labelPeriodo(p: string) {
  return p === '7' ? 'últimos 7 dias' : p === '30' ? 'últimos 30 dias' : p === '90' ? 'últimos 90 dias' : p === '365' ? 'último ano' : 'período personalizado'
}

function GastosPageInner({ tipoInicial, deInicial, ateInicial }: { tipoInicial: 'todos' | 'debito' | 'credito'; deInicial?: string; ateInicial?: string }) {
  const router = useRouter()
  const supabase = createClient()
  const { fmtData, fmtMes } = usePerfil()

  const [transacoes, setTransacoes]   = useState<Transacao[]>([])
  const [loading, setLoading]         = useState(true)
  const isMobile = useIsMobile(640)
  const [categoriasExtra, setCategoriasExtra] = useState<string[]>([])
  const [catFiltro, setCatFiltro]     = useState('Todas')
  const [tipoFiltro, setTipoFiltro]   = useState<'todos' | 'debito' | 'credito'>(tipoInicial)
  const [busca, setBusca]             = useState('')
  const [contaFiltro, setContaFiltro] = useState('')
  const [periodo, setPeriodo]         = useState(deInicial ? 'custom' : '30')
  const [dataInicio, setDataInicio]   = useState(deInicial ?? '')
  const [dataFim, setDataFim]         = useState(ateInicial ?? '')
  const [abaGrafico, setAbaGrafico]   = useState<'categoria' | 'evolucao' | 'comparativo'>('categoria')
  const [catDrilldown, setCatDrilldown] = useState<string | null>(null)
  const [filtroExpandido, setFiltroExpandido] = useState(false)
  const [userId, setUserId]           = useState('')
  const [contas, setContas]           = useState<Array<{ id: string; nome: string; tipo: string; bancos: { id: string; nome_curto: string; cor: string | null } | null }>>([])

  // ─── seleção em lote ───
  const [selecionados, setSelecionados]   = useState<string[]>([])
  const [contaDestino, setContaDestino]   = useState('')
  const [movendo, setMovendo]             = useState(false)
  const [excluindoLote, setExcluindoLote] = useState(false)

  const [deletando, setDeletando] = useState<string | null>(null)

  // ─── swipe mobile ───
  const swipeTouchX   = useRef<Record<string, number>>({})
  const [swipeOffset, setSwipeOffset] = useState<Record<string, number>>({})
  function onSwipeStart(id: string, e: React.TouchEvent) {
    swipeTouchX.current[id] = e.touches[0].clientX
  }
  function onSwipeMove(id: string, e: React.TouchEvent) {
    const dx = e.touches[0].clientX - (swipeTouchX.current[id] ?? e.touches[0].clientX)
    const clamped = Math.max(-90, Math.min(0, dx)) // só para esquerda (delete)
    setSwipeOffset(prev => ({ ...prev, [id]: clamped }))
  }
  function onSwipeEnd(id: string, t: Transacao) {
    const offset = swipeOffset[id] ?? 0
    if (offset < -70) {
      deletar(id)
    } else if (offset > 40) {
      abrirEdicao(t)
    }
    setSwipeOffset(prev => ({ ...prev, [id]: 0 }))
  }

  // ─── modal edição ───
  const [modalAberto, setModalAberto]               = useState(false)
  const [transacaoEditando, setTransacaoEditando]   = useState<Transacao | null>(null)
  const [editDescricao, setEditDescricao]           = useState('')
  const [editCategoria, setEditCategoria]           = useState('')
  const [editContaId, setEditContaId]               = useState('')
  const [editDataHora, setEditDataHora]             = useState('')
  const [editValor, setEditValor]                   = useState('')
  const [editTipo, setEditTipo]                     = useState<'debito' | 'credito'>('debito')
  const [salvandoEdicao, setSalvandoEdicao]         = useState(false)

  const [transacoesAnt, setTransacoesAnt] = useState<Transacao[]>([])

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setUserId(user.id)

    let desde: Date, corte: Date

    if (periodo === 'custom' && dataInicio && dataFim) {
      corte = new Date(dataInicio + 'T00:00:00')
      const fim = new Date(dataFim + 'T23:59:59')
      if (fim < corte) { setLoading(false); return }
      const duracao = fim.getTime() - corte.getTime()
      desde = new Date(corte.getTime() - duracao)

      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .gte('data_hora', desde.toISOString())
        .lte('data_hora', fim.toISOString())
        .order('data_hora', { ascending: false })

      if (data) {
        const corteISO = corte.toISOString()
        setTransacoes(data.filter(t => t.data_hora >= corteISO))
        setTransacoesAnt(data.filter(t => t.data_hora < corteISO))
      }
    } else {
      const dias = parseInt(periodo) || 30
      desde = new Date()
      desde.setDate(desde.getDate() - dias * 2)
      corte = new Date()
      corte.setDate(corte.getDate() - dias)

      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .gte('data_hora', desde.toISOString())
        .order('data_hora', { ascending: false })

      if (data) {
        const corteISO = corte.toISOString()
        setTransacoes(data.filter(t => t.data_hora >= corteISO))
        setTransacoesAnt(data.filter(t => t.data_hora < corteISO))
      }
    }
    setLoading(false)
  }, [supabase, router, periodo, dataInicio, dataFim])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar()
  }, [carregar])

  useEffect(() => {
    fetch('/api/contas').then(r => r.json()).then(d => setContas(d.contas || []))
  }, [])

  useEffect(() => {
    fetch('/api/categorias')
      .then(r => r.json())
      .then(d => setCategoriasExtra((d.categorias || []).map((c: { nome: string }) => c.nome)))
  }, [])

  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel('gastos-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${userId}` }, () => { carregar() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  // ─── métricas do período completo (sem filtros de tipo/categoria/busca) ───
  const totalReceitasPeriodo  = useMemo(() => transacoes.filter(t => t.tipo === 'credito').reduce((a, t) => a + t.valor, 0), [transacoes])
  const totalDespesasPeriodo  = useMemo(() => transacoes.filter(t => t.tipo === 'debito').reduce((a, t) => a + Math.abs(t.valor), 0), [transacoes])
  const saldoPeriodo          = totalReceitasPeriodo - totalDespesasPeriodo

  // ─── transações filtradas ───
  const filtradas = useMemo(() => transacoes.filter(t => {
    if (catFiltro !== 'Todas' && t.categoria?.toLowerCase() !== catFiltro.toLowerCase()) return false
    if (tipoFiltro !== 'todos' && t.tipo !== tipoFiltro) return false
    if (busca && !t.descricao.toLowerCase().includes(busca.toLowerCase())) return false
    if (contaFiltro && t.conta_id !== contaFiltro) return false
    return true
  }), [transacoes, catFiltro, tipoFiltro, busca, contaFiltro])

  const filtroAtivo = catFiltro !== 'Todas' || tipoFiltro !== 'todos' || busca !== '' || contaFiltro !== ''

  // métricas da seleção filtrada (para o rodapé da tabela)
  const totalReceitasFiltradas = filtradas.filter(t => t.tipo === 'credito').reduce((a, t) => a + t.valor, 0)
  const totalDespesasFiltradas = filtradas.filter(t => t.tipo === 'debito').reduce((a, t) => a + Math.abs(t.valor), 0)
  const saldoFiltrado          = totalReceitasFiltradas - totalDespesasFiltradas

  const porCategoria = useMemo(() => {
    const acc: Record<string, number> = {}
    filtradas.filter(t => t.tipo === 'debito').forEach(t => {
      acc[t.categoria] = (acc[t.categoria] || 0) + Math.abs(t.valor)
    })
    return Object.entries(acc).sort((a, b) => b[1] - a[1])
  }, [filtradas])

  const maxCat = porCategoria[0]?.[1] || 1

  const porMes = useMemo(() => {
    const acc: Record<string, { receitas: number; despesas: number }> = {}
    transacoes.forEach(t => {
      const mes = t.data_hora.slice(0, 7)
      if (!acc[mes]) acc[mes] = { receitas: 0, despesas: 0 }
      if (t.tipo === 'credito') acc[mes].receitas += t.valor
      else acc[mes].despesas += Math.abs(t.valor)
    })
    return Object.entries(acc).sort((a, b) => a[0].localeCompare(b[0])).slice(-6)
  }, [transacoes])

  const maxMes = Math.max(...porMes.flatMap(([, v]) => [v.receitas, v.despesas]), 1)

  // Período anterior — mesmas categorias para comparativo
  const porCategoriaAnt = useMemo(() => {
    const acc: Record<string, number> = {}
    transacoesAnt.filter(t => t.tipo === 'debito').forEach(t => {
      acc[t.categoria] = (acc[t.categoria] || 0) + Math.abs(t.valor)
    })
    return acc
  }, [transacoesAnt])

  // Drill-down: top descrições dentro de uma categoria
  const drilldownDados = useMemo(() => {
    if (!catDrilldown) return []
    const acc: Record<string, { total: number; count: number }> = {}
    filtradas.filter(t => t.tipo === 'debito' && t.categoria === catDrilldown).forEach(t => {
      const k = t.descricao.trim()
      if (!acc[k]) acc[k] = { total: 0, count: 0 }
      acc[k].total += Math.abs(t.valor)
      acc[k].count++
    })
    return Object.entries(acc).sort((a, b) => b[1].total - a[1].total).slice(0, 10)
  }, [filtradas, catDrilldown])

  const maxDrill = drilldownDados[0]?.[1].total || 1

  // Top gastos individuais do período
  const topGastos = useMemo(() =>
    [...filtradas].filter(t => t.tipo === 'debito').sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor)).slice(0, 8)
  , [filtradas])

  // Todas as categorias presentes no comparativo
  const catsComparativo = useMemo(() => {
    const s = new Set([...porCategoria.map(([c]) => c), ...Object.keys(porCategoriaAnt)])
    return [...s].sort((a, b) => ((porCategoriaAnt[b] || 0) + (porCategoria.find(([c]) => c === b)?.[1] || 0)) - ((porCategoriaAnt[a] || 0) + (porCategoria.find(([c]) => c === a)?.[1] || 0)))
  }, [porCategoria, porCategoriaAnt])
  const maxComp = Math.max(...catsComparativo.flatMap(c => [porCategoria.find(([k]) => k === c)?.[1] || 0, porCategoriaAnt[c] || 0]), 1)

  // ─── seleção ───
  function toggleSelecionado(id: string) {
    setSelecionados(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  function toggleTodos() {
    setSelecionados(prev => prev.length === filtradas.length ? [] : filtradas.map(t => t.id))
  }

  async function excluirSelecionados() {
    if (!selecionados.length) return
    if (!confirm(`Excluir ${selecionados.length} transaç${selecionados.length > 1 ? 'ões' : 'ão'}? Esta ação não pode ser desfeita.`)) return
    setExcluindoLote(true)
    await Promise.all(selecionados.map(id => fetch(`/api/lancamento/${id}`, { method: 'DELETE' })))
    setSelecionados([])
    setExcluindoLote(false)
    carregar()
  }

  async function deletar(id: string) {
    if (!confirm('Excluir este lançamento? Esta ação não pode ser desfeita.')) return
    setDeletando(id)
    await fetch(`/api/lancamento/${id}`, { method: 'DELETE' })
    setDeletando(null)
    carregar()
  }

  async function moverParaConta() {
    if (!selecionados.length || !contaDestino) return
    setMovendo(true)
    await Promise.all(
      selecionados.map(id =>
        fetch(`/api/lancamento/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conta_id: contaDestino }),
        })
      )
    )
    setSelecionados([])
    setContaDestino('')
    setMovendo(false)
    carregar()
  }

  // ─── exportar CSV ───
  function exportarCSV() {
    const header = 'Data;Descrição;Categoria;Tipo;Valor;Conta'
    const rows = filtradas.map(t => {
      const conta = contas.find(c => c.id === t.conta_id)
      const contaNome = conta ? `${conta.bancos?.nome_curto || ''} ${conta.nome}`.trim() : ''
      const valor = Math.abs(t.valor).toFixed(2).replace('.', ',')
      const data = new Date(t.data_hora).toLocaleDateString('pt-BR')
      return `${data};"${t.descricao}";"${t.categoria}";${t.tipo === 'debito' ? 'Despesa' : 'Receita'};${t.tipo === 'debito' ? '-' : ''}${valor};"${contaNome}"`
    })
    const csv = [header, ...rows].join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lancamentos_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ─── modal edição ───
  function abrirEdicao(t: Transacao) {
    setTransacaoEditando(t)
    setEditDescricao(t.descricao)
    setEditCategoria(t.categoria)
    setEditContaId(t.conta_id || '')
    setEditDataHora(t.data_hora ? new Date(t.data_hora).toISOString().slice(0, 16) : '')
    setEditValor(Math.abs(t.valor).toFixed(2).replace('.', ','))
    setEditTipo(t.tipo)
    setModalAberto(true)
  }

  async function salvarEdicao() {
    if (!transacaoEditando) return
    setSalvandoEdicao(true)
    await fetch(`/api/lancamento/${transacaoEditando.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        descricao: editDescricao,
        categoria: editCategoria,
        conta_id: editContaId || null,
        data_hora: editDataHora ? new Date(editDataHora).toISOString() : transacaoEditando.data_hora,
        valor: editTipo === 'debito' ? -Math.abs(parseFloat(editValor.replace(',', '.'))) : Math.abs(parseFloat(editValor.replace(',', '.'))),
        tipo: editTipo,
      }),
    })
    setSalvandoEdicao(false)
    setModalAberto(false)
    setTransacaoEditando(null)
    carregar()
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <PoupaUpLogo mode="compact" />
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)' }}>Carregando gastos...</div>
    </div>
  )

  return (
    <div className="dashboard-page-body" style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: 'system-ui, sans-serif', fontSize: 13, color: '#fff' }}>

      {/* Topbar */}
      <div style={{ borderBottom: '1px solid #1a3a1a', background: '#0a1a0a' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.875rem 1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.4)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Dashboard
            </button>
            <span style={{ color: 'rgba(255,255,255,.2)' }}>/</span>
            <span style={{ fontSize: 15, fontWeight: 500 }}>Gastos</span>
          </div>
          {/* topbar desktop limpa — período fica no corpo da página */}
        </div>
        {isMobile && (
          /* Mobile: pills em linha + inputs de data abaixo quando 📅 ativo */
          <div style={{ padding: '0 1rem .75rem', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 2 }}>
              {([['7','7d'],['30','30d'],['90','90d'],['365','1a']] as const).map(([v,l]) => (
                <button key={v} onClick={() => { setPeriodo(v); setDataInicio(''); setDataFim(''); setFiltroExpandido(false) }} style={{
                  flexShrink: 0, padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  background: periodo === v ? '#16a34a' : 'rgba(255,255,255,.08)',
                  color: periodo === v ? '#fff' : 'rgba(255,255,255,.45)',
                }}>{l}</button>
              ))}
              <button onClick={() => setFiltroExpandido(o => !o)} style={{
                flexShrink: 0, padding: '6px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: periodo === 'custom' ? '#16a34a' : filtroExpandido ? 'rgba(22,163,74,.2)' : 'rgba(255,255,255,.08)',
                color: periodo === 'custom' || filtroExpandido ? '#fff' : 'rgba(255,255,255,.45)',
              }}>
                {periodo === 'custom' && dataInicio && dataFim ? `${dataInicio.slice(5)}→${dataFim.slice(5)}` : '📅'}
              </button>
            </div>
            {filtroExpandido && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="date" value={dataInicio} onChange={e => { setDataInicio(e.target.value); if (e.target.value && dataFim) { setPeriodo('custom'); setFiltroExpandido(false) } }}
                  style={{ flex: 1, background: 'rgba(255,255,255,.05)', border: '1px solid #1a3a1a', borderRadius: 8, padding: '8px', color: '#fff', fontSize: 12, minHeight: 38, colorScheme: 'dark' }} />
                <span style={{ color: 'rgba(255,255,255,.3)', fontSize: 11, flexShrink: 0 }}>→</span>
                <input type="date" value={dataFim} onChange={e => { setDataFim(e.target.value); if (dataInicio && e.target.value) { setPeriodo('custom'); setFiltroExpandido(false) } }}
                  style={{ flex: 1, background: 'rgba(255,255,255,.05)', border: '1px solid #1a3a1a', borderRadius: 8, padding: '8px', color: '#fff', fontSize: 12, minHeight: 38, colorScheme: 'dark' }} />
                {periodo === 'custom' && (
                  <button onClick={() => { setPeriodo('30'); setDataInicio(''); setDataFim(''); setFiltroExpandido(false) }}
                    style={{ padding: '8px 10px', borderRadius: 8, border: 'none', background: 'rgba(239,68,68,.15)', color: '#f87171', fontSize: 13, cursor: 'pointer', minHeight: 38, flexShrink: 0 }}>✕</button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ padding: '1.5rem' }}>

        {/* ── Seletor de período — desktop integrado ao conteúdo ── */}
        {!isMobile && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 3, background: 'rgba(0,0,0,.3)', border: '1px solid #1a3a1a', borderRadius: 8, padding: 3 }}>
              {[['7', '7d'], ['30', '30d'], ['90', '90d'], ['365', '1 ano']].map(([v, l]) => (
                <button key={v} onClick={() => { setPeriodo(v); setDataInicio(''); setDataFim('') }} style={{
                  padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
                  background: periodo === v ? '#16a34a' : 'transparent',
                  color: periodo === v ? '#fff' : 'rgba(255,255,255,.4)',
                }}>{l}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input type="date" value={dataInicio} onChange={e => { setDataInicio(e.target.value); if (e.target.value && dataFim) setPeriodo('custom') }}
                style={{ background: periodo === 'custom' ? 'rgba(22,163,74,.15)' : 'rgba(255,255,255,.04)', border: `1px solid ${periodo === 'custom' ? '#16a34a55' : '#1a3a1a'}`, borderRadius: 8, padding: '6px 10px', color: '#fff', fontSize: 12, colorScheme: 'dark' }} />
              <span style={{ color: 'rgba(255,255,255,.25)', fontSize: 11 }}>até</span>
              <input type="date" value={dataFim} onChange={e => { setDataFim(e.target.value); if (dataInicio && e.target.value) setPeriodo('custom') }}
                style={{ background: periodo === 'custom' ? 'rgba(22,163,74,.15)' : 'rgba(255,255,255,.04)', border: `1px solid ${periodo === 'custom' ? '#16a34a55' : '#1a3a1a'}`, borderRadius: 8, padding: '6px 10px', color: '#fff', fontSize: 12, colorScheme: 'dark' }} />
              {periodo === 'custom' && (
                <button onClick={() => { setPeriodo('30'); setDataInicio(''); setDataFim('') }}
                  style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #3a1a1a', background: 'rgba(239,68,68,.1)', color: '#f87171', fontSize: 11, cursor: 'pointer' }}>✕</button>
              )}
            </div>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.25)', marginLeft: 'auto' }}>{labelPeriodo(periodo)}</span>
          </div>
        )}

        {/* ── Cards de métricas — sempre período completo, nunca filtrado ── */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,minmax(0,1fr))' : 'repeat(4,minmax(0,1fr))', gap: 10, marginBottom: filtroAtivo ? 6 : '1.25rem' }}>
          {[
            { label: 'Receitas',   val: fmtBRL(totalReceitasPeriodo),  cor: '#4ade80' },
            { label: 'Despesas',   val: fmtBRL(totalDespesasPeriodo),  cor: '#f87171' },
            { label: 'Saldo',      val: fmtBRL(saldoPeriodo),          cor: saldoPeriodo >= 0 ? '#4ade80' : '#f87171' },
            { label: 'Transações', val: String(transacoes.length),     cor: '#fff' },
          ].map(m => (
            <div key={m.label} style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{m.label}</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,.25)' }}>{labelPeriodo(periodo)}</div>
              </div>
              <div style={{ fontSize: 20, fontWeight: 500, color: m.cor }}>{m.val}</div>
            </div>
          ))}
        </div>

        {/* ── Banner de contexto — aparece quando há filtro ativo ── */}
        {filtroAtivo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.25rem', padding: '8px 14px', background: 'rgba(99,102,241,.08)', border: '1px solid rgba(99,102,241,.2)', borderRadius: 8 }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="5.5" stroke="#818cf8" strokeWidth="1.2"/><path d="M6.5 5.5v4M6.5 4h.01" stroke="#818cf8" strokeWidth="1.2" strokeLinecap="round"/></svg>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.5)' }}>
              Exibindo{' '}
              {tipoFiltro !== 'todos' && <strong style={{ color: tipoFiltro === 'credito' ? '#4ade80' : '#f87171' }}>{tipoFiltro === 'credito' ? 'Receitas' : 'Despesas'}</strong>}
              {catFiltro !== 'Todas' && <>{tipoFiltro !== 'todos' ? ' · ' : ''}<strong style={{ color: '#fff' }}>{catFiltro}</strong></>}
             {busca && <>{(tipoFiltro !== 'todos' || catFiltro !== 'Todas') ? ' · ' : ''}{'"'}<strong style={{ color: '#fff' }}>{busca}</strong>{'"'}</>}
              {contaFiltro && <>{' · '}<strong style={{ color: '#fbbf24' }}>{contas.find(c => c.id === contaFiltro)?.nome || 'Conta'}</strong></>}
              {' · '}<strong style={{ color: '#fff' }}>{filtradas.length}</strong> de <strong style={{ color: '#fff' }}>{transacoes.length}</strong> transações
              {' · '}<span>Os totais acima refletem o período completo</span>
            </span>
            <button onClick={() => { setCatFiltro('Todas'); setTipoFiltro('todos'); setBusca(''); setContaFiltro('') }}
              title="Limpar todos os filtros"
              style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.35)', fontSize: 18, lineHeight: 1 }}>×</button>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: 12, marginBottom: '1rem' }}>

          {/* Gráficos */}
          <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 12, padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: '1rem', flexWrap: 'wrap' }}>
              {(['categoria', 'evolucao', 'comparativo'] as const).map(a => (
                <button key={a} onClick={() => setAbaGrafico(a)} style={{
                  padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 500,
                  background: abaGrafico === a ? '#16a34a' : 'rgba(255,255,255,.06)',
                  color: abaGrafico === a ? '#fff' : 'rgba(255,255,255,.4)',
                }}>
                  {a === 'categoria' ? 'Por categoria' : a === 'evolucao' ? 'Evolução mensal' : 'Comparativo'}
                </button>
              ))}
              {filtroAtivo && (
                <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(255,255,255,.3)', fontStyle: 'italic' }}>filtrado</span>
              )}
            </div>

            {abaGrafico === 'categoria' && (
              <div>
                {porCategoria.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'rgba(255,255,255,.3)', fontSize: 12 }}>Sem despesas no período</div>
                ) : porCategoria.map(([cat, val]) => (
                  <div key={cat} style={{ marginBottom: 10, cursor: 'pointer' }}
                    onClick={() => setCatDrilldown(catDrilldown === cat ? null : cat)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: CORES[cat] || '#6b7280' }} />
                        <span style={{ fontSize: 12, color: catDrilldown === cat ? '#fff' : 'rgba(255,255,255,.7)', fontWeight: catDrilldown === cat ? 600 : 400 }}>{cat}</span>
                        <span style={{ fontSize: 9, color: 'rgba(255,255,255,.25)' }}>▾ detalhar</span>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 500 }}>{fmtBRL(val)}</span>
                    </div>
                    <div style={{ height: 6, background: 'rgba(255,255,255,.06)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(val / maxCat) * 100}%`, background: CORES[cat] || '#6b7280', borderRadius: 3, transition: 'width .5s' }} />
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', marginTop: 2 }}>
                      {totalDespesasFiltradas > 0 ? Math.round((val / totalDespesasFiltradas) * 100) : 0}% do total
                    </div>
                  </div>
                ))}
              </div>
            )}

            {abaGrafico === 'evolucao' && (
              <div>
                {porMes.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'rgba(255,255,255,.3)', fontSize: 12 }}>Sem dados suficientes</div>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'rgba(255,255,255,.5)' }}>
                        <div style={{ width: 10, height: 4, background: '#4ade80', borderRadius: 2 }} /> Receitas
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'rgba(255,255,255,.5)' }}>
                        <div style={{ width: 10, height: 4, background: '#f87171', borderRadius: 2 }} /> Despesas
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 140 }}>
                      {porMes.map(([mes, v]) => (
                        <div key={mes} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, height: '100%', justifyContent: 'flex-end' }}>
                          <div style={{ width: '100%', display: 'flex', gap: 2, alignItems: 'flex-end', flex: 1 }}>
                            <div style={{ flex: 1, background: '#4ade80', borderRadius: '3px 3px 0 0', height: `${(v.receitas / maxMes) * 100}%`, minHeight: 2, transition: 'height .5s' }} />
                            <div style={{ flex: 1, background: '#f87171', borderRadius: '3px 3px 0 0', height: `${(v.despesas / maxMes) * 100}%`, minHeight: 2, transition: 'height .5s' }} />
                          </div>
                          <div style={{ fontSize: 9, color: 'rgba(255,255,255,.35)', whiteSpace: 'nowrap' }}>{fmtMes(mes + '-01')}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {abaGrafico === 'comparativo' && (
              <div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'rgba(255,255,255,.5)' }}>
                    <div style={{ width: 10, height: 4, background: '#4ade80', borderRadius: 2 }} /> Período atual
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'rgba(255,255,255,.5)' }}>
                    <div style={{ width: 10, height: 4, background: 'rgba(255,255,255,.2)', borderRadius: 2 }} /> Período anterior
                  </div>
                </div>
                {catsComparativo.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'rgba(255,255,255,.3)', fontSize: 12 }}>Sem dados suficientes para comparar</div>
                ) : catsComparativo.map(cat => {
                  const atual = porCategoria.find(([c]) => c === cat)?.[1] || 0
                  const ant   = porCategoriaAnt[cat] || 0
                  const delta = atual - ant
                  return (
                    <div key={cat} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: CORES[cat] || '#6b7280' }} />
                          <span style={{ fontSize: 12, color: 'rgba(255,255,255,.7)' }}>{cat}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          {ant > 0 && (
                            <span style={{ fontSize: 10, color: delta > 0 ? '#f87171' : '#4ade80', fontWeight: 600 }}>
                              {delta > 0 ? '▲' : '▼'} {fmtBRL(Math.abs(delta))}
                            </span>
                          )}
                          <span style={{ fontSize: 12, fontWeight: 500 }}>{fmtBRL(atual)}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <div style={{ height: 6, background: 'rgba(255,255,255,.06)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${(atual / maxComp) * 100}%`, background: CORES[cat] || '#6b7280', borderRadius: 3, transition: 'width .5s' }} />
                        </div>
                        <div style={{ height: 4, background: 'rgba(255,255,255,.06)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${(ant / maxComp) * 100}%`, background: 'rgba(255,255,255,.2)', borderRadius: 2, transition: 'width .5s' }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Insights */}
          <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 12, padding: '1rem' }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,.5)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>Insights do período</div>
            {transacoes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'rgba(255,255,255,.3)', fontSize: 12 }}>Sem dados no período selecionado</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {porCategoria[0] && (
                  <div style={{ background: '#0a1a0a', borderRadius: 8, padding: '10px 12px', display: 'flex', gap: 8 }}>
                    <div style={{ width: 20, height: 20, borderRadius: 5, background: 'rgba(249,115,22,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 11 }}>📊</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,.7)', lineHeight: 1.5 }}>
                      Maior gasto: <strong style={{ color: '#fff' }}>{porCategoria[0][0]}</strong> com <strong style={{ color: '#f87171' }}>{fmtBRL(porCategoria[0][1])}</strong>
                    </div>
                  </div>
                )}
                {totalReceitasPeriodo > 0 && (
                  <div style={{ background: '#0a1a0a', borderRadius: 8, padding: '10px 12px', display: 'flex', gap: 8 }}>
                    <div style={{ width: 20, height: 20, borderRadius: 5, background: 'rgba(74,222,128,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 11 }}>💰</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,.7)', lineHeight: 1.5 }}>
                      Taxa de poupança: <strong style={{ color: saldoPeriodo >= 0 ? '#4ade80' : '#f87171' }}>
                        {Math.round(((totalReceitasPeriodo - totalDespesasPeriodo) / totalReceitasPeriodo) * 100)}%
                      </strong> das receitas
                    </div>
                  </div>
                )}
                {transacoes.filter(t => t.tipo === 'debito').length > 0 && (
                  <div style={{ background: '#0a1a0a', borderRadius: 8, padding: '10px 12px', display: 'flex', gap: 8 }}>
                    <div style={{ width: 20, height: 20, borderRadius: 5, background: 'rgba(34,211,238,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 11 }}>🧾</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,.7)', lineHeight: 1.5 }}>
                      Ticket médio por gasto: <strong style={{ color: '#22d3ee' }}>
                        {fmtBRL(totalDespesasPeriodo / transacoes.filter(t => t.tipo === 'debito').length)}
                      </strong>
                    </div>
                  </div>
                )}
                {totalDespesasPeriodo > totalReceitasPeriodo && totalReceitasPeriodo > 0 && (
                  <div style={{ background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 8, padding: '10px 12px', display: 'flex', gap: 8 }}>
                    <div style={{ width: 20, height: 20, borderRadius: 5, background: 'rgba(239,68,68,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 11 }}>⚠️</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#f87171', lineHeight: 1.5 }}>
                      Despesas superam receitas em <strong>{fmtBRL(totalDespesasPeriodo - totalReceitasPeriodo)}</strong> no período
                    </div>
                  </div>
                )}
                <div style={{ background: '#0a1a0a', borderRadius: 8, padding: '10px 12px', display: 'flex', gap: 8 }}>
                  <div style={{ width: 20, height: 20, borderRadius: 5, background: 'rgba(167,139,250,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 11 }}>🏷️</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,.7)', lineHeight: 1.5 }}>
                    <strong style={{ color: '#a78bfa' }}>{porCategoria.length}</strong> categorias de gastos em {labelPeriodo(periodo)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Drill-down da categoria clicada ── */}
        {catDrilldown && (() => {
          const cor = CORES[catDrilldown] || '#6b7280'
          const transacoesCat = filtradas.filter(t => t.tipo === 'debito' && t.categoria === catDrilldown)
            .sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor))
          const totalCat = transacoesCat.reduce((s, t) => s + Math.abs(t.valor), 0)
          if (transacoesCat.length === 0) return null
          return (
            <div style={{ background: '#111', border: `1px solid ${cor}33`, borderRadius: 12, padding: '1rem', marginBottom: '1rem' }}>

              {/* Cabeçalho */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: cor }} />
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{catDrilldown}</span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>
                    {transacoesCat.length} transaç{transacoesCat.length === 1 ? 'ão' : 'ões'} · total {fmtBRL(totalCat)}
                  </span>
                </div>
                <button onClick={() => setCatDrilldown(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.3)', fontSize: 20, lineHeight: 1 }}>×</button>
              </div>

              {/* Resumo por estabelecimento */}
              {drilldownDados.length > 1 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Resumo por estabelecimento</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 6 }}>
                    {drilldownDados.map(([desc, { total, count }]) => (
                      <div key={desc} style={{ background: 'rgba(255,255,255,.02)', borderRadius: 8, padding: '8px 10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center' }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{desc}</div>
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)' }}>{count}× · média {fmtBRL(total / count)}</div>
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: cor, flexShrink: 0, marginLeft: 8 }}>{fmtBRL(total)}</div>
                        </div>
                        <div style={{ height: 3, background: 'rgba(255,255,255,.06)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${(total / maxDrill) * 100}%`, background: cor, borderRadius: 2, opacity: .6 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Lista detalhada de lançamentos */}
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Lançamentos detalhados</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 100px', gap: 0 }}>
                  {/* header */}
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,.25)', padding: '4px 8px', borderBottom: '1px solid #1a3a1a' }}>Descrição</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,.25)', padding: '4px 8px', borderBottom: '1px solid #1a3a1a' }}>Data</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,.25)', padding: '4px 8px', borderBottom: '1px solid #1a3a1a', textAlign: 'right' }}>Valor</div>
                  {/* rows */}
                  {transacoesCat.map(t => (
                    <>
                      <div key={`d-${t.id}`} style={{ fontSize: 12, padding: '7px 8px', borderBottom: '1px solid rgba(255,255,255,.04)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' }}
                        onClick={() => abrirEdicao(t)}>{t.descricao}</div>
                      <div key={`dt-${t.id}`} style={{ fontSize: 11, color: 'rgba(255,255,255,.45)', padding: '7px 8px', borderBottom: '1px solid rgba(255,255,255,.04)' }}>{fmtData(t.data_hora)}</div>
                      <div key={`v-${t.id}`} style={{ fontSize: 12, fontWeight: 600, color: '#f87171', padding: '7px 8px', borderBottom: '1px solid rgba(255,255,255,.04)', textAlign: 'right' }}>-{fmtBRL(Math.abs(t.valor))}</div>
                    </>
                  ))}
                </div>
              </div>
            </div>
          )
        })()}

        {/* ── Top gastos + Grid 2 colunas ── */}
        {topGastos.length > 0 && (
          <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 12, padding: '1rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,.5)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>
              🏆 Maiores gastos do período
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 6 }}>
              {topGastos.map((t, i) => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 8, background: 'rgba(255,255,255,.02)' }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,.18)', fontWeight: 700, width: 18, textAlign: 'center', flexShrink: 0 }}>#{i + 1}</div>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: CORES[t.categoria] || '#6b7280', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.descricao}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)' }}>{t.categoria} · {fmtData(t.data_hora)}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#f87171', flexShrink: 0 }}>-{fmtBRL(Math.abs(t.valor))}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filtros + tabela */}
        <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 12, padding: '1rem' }}>

          {/* Filtros */}
          {isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: '1rem' }}>
              {/* Linha 1: busca */}
              <div style={{ position: 'relative' }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,.3)' }}>
                  <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M9 9l2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar transação..."
                  style={{ width: '100%', boxSizing: 'border-box', padding: '9px 10px 9px 30px', background: '#0a1a0a', border: '1px solid #1a3a1a', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none' }} />
              </div>
              {/* Linha 2: tipo + categoria */}
              <div style={{ display: 'flex', gap: 6 }}>
                <div style={{ display: 'flex', gap: 3, background: 'rgba(0,0,0,.3)', border: '1px solid #1a3a1a', borderRadius: 8, padding: 3, flexShrink: 0 }}>
                  {(['todos', 'debito', 'credito'] as const).map(t => (
                    <button key={t} onClick={() => setTipoFiltro(t)} style={{
                      padding: '5px 8px', borderRadius: 5, border: 'none', cursor: 'pointer', fontSize: 11,
                      background: tipoFiltro === t ? (t === 'credito' ? '#16a34a' : t === 'debito' ? 'rgba(239,68,68,.3)' : 'rgba(255,255,255,.1)') : 'transparent',
                      color: tipoFiltro === t ? '#fff' : 'rgba(255,255,255,.4)',
                    }}>
                      {t === 'todos' ? 'Todos' : t === 'debito' ? 'Desp.' : 'Rec.'}
                    </button>
                  ))}
                </div>
                <select value={catFiltro} onChange={e => setCatFiltro(e.target.value)} style={{
                  flex: 1, padding: '7px 8px', background: '#0a1a0a', border: '1px solid #1a3a1a',
                  borderRadius: 8, color: catFiltro === 'Todas' ? 'rgba(255,255,255,.5)' : '#fff',
                  fontSize: 12, outline: 'none', cursor: 'pointer', minWidth: 0,
                }}>
                  {['Todas', ...TODAS_CATEGORIAS, ...categoriasExtra.filter(c => !TODAS_CATEGORIAS.includes(c))].map(c => <option key={c} value={c} style={{ background: '#111' }}>{c}</option>)}
                </select>
              </div>
              {/* Linha 3: conta + ações */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {contas.length > 0 && (
                  <select value={contaFiltro} onChange={e => setContaFiltro(e.target.value)} style={{
                    flex: 1, padding: '7px 8px', background: '#0a1a0a', border: '1px solid #1a3a1a',
                    borderRadius: 8, color: contaFiltro ? '#fff' : 'rgba(255,255,255,.5)',
                    fontSize: 12, outline: 'none', cursor: 'pointer', minWidth: 0,
                  }}>
                    <option value="">Todas as contas</option>
                    {contas.map(c => <option key={c.id} value={c.id} style={{ background: '#111' }}>{c.bancos?.nome_curto || '—'} · {c.nome}</option>)}
                  </select>
                )}
                <span style={{ fontSize: 11, color: filtroAtivo ? '#818cf8' : 'rgba(255,255,255,.35)', whiteSpace: 'nowrap' }}>
                  {filtradas.length}/{transacoes.length}
                </span>
                {filtroAtivo && (
                  <button onClick={() => { setCatFiltro('Todas'); setTipoFiltro('todos'); setBusca(''); setContaFiltro('') }} style={{
                    padding: '6px 10px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)',
                    borderRadius: 8, color: '#f87171', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap',
                  }}>✕ Limpar</button>
                )}
                <button onClick={exportarCSV} title="Exportar CSV" style={{
                  display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px',
                  background: 'rgba(129,140,248,.1)', border: '1px solid rgba(129,140,248,.25)',
                  borderRadius: 8, color: '#818cf8', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap',
                }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v7M3 5l3 3 3-3M1 9v1a1 1 0 001 1h8a1 1 0 001-1V9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  CSV
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,.3)' }}>
                  <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M9 9l2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar transação..."
                  style={{ width: '100%', padding: '7px 10px 7px 28px', background: '#0a1a0a', border: '1px solid #1a3a1a', borderRadius: 8, color: '#fff', fontSize: 12, outline: 'none' }} />
              </div>
              <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,.3)', border: '1px solid #1a3a1a', borderRadius: 8, padding: 3 }}>
                {(['todos', 'debito', 'credito'] as const).map(t => (
                  <button key={t} onClick={() => setTipoFiltro(t)} style={{
                    padding: '5px 10px', borderRadius: 5, border: 'none', cursor: 'pointer', fontSize: 11,
                    background: tipoFiltro === t ? (t === 'credito' ? '#16a34a' : t === 'debito' ? 'rgba(239,68,68,.3)' : 'rgba(255,255,255,.1)') : 'transparent',
                    color: tipoFiltro === t ? '#fff' : 'rgba(255,255,255,.4)',
                  }}>
                    {t === 'todos' ? 'Todos' : t === 'debito' ? 'Despesas' : 'Receitas'}
                  </button>
                ))}
              </div>
              <select value={catFiltro} onChange={e => setCatFiltro(e.target.value)} style={{
                padding: '7px 10px', background: '#0a1a0a', border: '1px solid #1a3a1a',
                borderRadius: 8, color: catFiltro === 'Todas' ? 'rgba(255,255,255,.5)' : '#fff',
                fontSize: 12, outline: 'none', cursor: 'pointer',
              }}>
                {['Todas', ...TODAS_CATEGORIAS, ...categoriasExtra.filter(c => !TODAS_CATEGORIAS.includes(c))].map(c => <option key={c} value={c} style={{ background: '#111' }}>{c}</option>)}
              </select>
              {contas.length > 0 && (
                <select value={contaFiltro} onChange={e => setContaFiltro(e.target.value)} style={{
                  padding: '7px 10px', background: '#0a1a0a', border: '1px solid #1a3a1a',
                  borderRadius: 8, color: contaFiltro ? '#fff' : 'rgba(255,255,255,.5)',
                  fontSize: 12, outline: 'none', cursor: 'pointer',
                }}>
                  <option value="">Todas as contas</option>
                  {contas.map(c => <option key={c.id} value={c.id} style={{ background: '#111' }}>{c.bancos?.nome_curto || '—'} · {c.nome}</option>)}
                </select>
              )}
              {filtroAtivo && (
                <button onClick={() => { setCatFiltro('Todas'); setTipoFiltro('todos'); setBusca(''); setContaFiltro('') }} style={{
                  padding: '6px 10px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)',
                  borderRadius: 8, color: '#f87171', fontSize: 11, cursor: 'pointer',
                }}>Limpar filtros</button>
              )}
              <div style={{ marginLeft: 'auto', fontSize: 11, color: filtroAtivo ? '#818cf8' : 'rgba(255,255,255,.35)', fontWeight: filtroAtivo ? 500 : 400 }}>
                {filtradas.length} de {transacoes.length} transações
              </div>
              <button onClick={exportarCSV} title="Exportar CSV" style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px',
                background: 'rgba(129,140,248,.1)', border: '1px solid rgba(129,140,248,.25)',
                borderRadius: 8, color: '#818cf8', fontSize: 11, cursor: 'pointer',
              }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v7M3 5l3 3 3-3M1 9v1a1 1 0 001 1h8a1 1 0 001-1V9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Exportar CSV
              </button>
            </div>
          )}

          {/* Barra de ações em lote */}
          {selecionados.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '10px 14px', background: '#0a1a0a', border: '1px solid #1a5a1a', borderRadius: 10 }}>
              <span style={{ fontSize: 12, color: '#4ade80', fontWeight: 500 }}>
                {selecionados.length} selecionado{selecionados.length > 1 ? 's' : ''}
              </span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>
                {filtroAtivo ? '(da seleção filtrada)' : `(do período completo)`}
              </span>
              <div style={{ flex: 1 }} />
              {contas.length > 0 && (
                <>
                  <select value={contaDestino} onChange={e => setContaDestino(e.target.value)}
                    style={{ padding: '5px 10px', background: '#111', border: '1px solid #1a3a1a', borderRadius: 6, color: '#fff', fontSize: 12, outline: 'none', cursor: 'pointer' }}>
                    <option value="">Mover para conta...</option>
                    {contas.map(c => <option key={c.id} value={c.id}>{c.bancos?.nome_curto || '—'} · {c.nome}</option>)}
                  </select>
                  <button onClick={moverParaConta} disabled={!contaDestino || movendo}
                    style={{ padding: '5px 12px', background: 'rgba(74,222,128,.15)', border: '1px solid rgba(74,222,128,.3)', borderRadius: 6, color: '#4ade80', fontSize: 12, cursor: contaDestino ? 'pointer' : 'default', opacity: !contaDestino ? 0.4 : 1 }}>
                    {movendo ? 'Movendo...' : 'Mover'}
                  </button>
                </>
              )}
              <button onClick={excluirSelecionados} disabled={excluindoLote}
                style={{ padding: '5px 12px', background: 'rgba(239,68,68,.15)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 6, color: '#f87171', fontSize: 12, cursor: 'pointer' }}>
                {excluindoLote ? 'Excluindo...' : 'Excluir selecionados'}
              </button>
              <button onClick={() => setSelecionados([])}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.3)', fontSize: 18, lineHeight: 1 }}>×</button>
            </div>
          )}

          {/* Tabela */}
          {filtradas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'rgba(255,255,255,.3)', fontSize: 13 }}>
              Nenhuma transação encontrada com os filtros aplicados
            </div>
          ) : isMobile ? (
            /* ── Layout mobile: cards por transação ── */
            <div>
              {/* Header seleção */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderBottom: '1px solid #1a3a1a' }}>
                <input type="checkbox"
                  checked={selecionados.length === filtradas.length && filtradas.length > 0}
                  onChange={toggleTodos}
                  style={{ cursor: 'pointer', accentColor: '#4ade80', width: 15, height: 15 }} />
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  {selecionados.length > 0 ? `${selecionados.length} selecionados` : `${filtradas.length} lançamentos`}
                </span>
              </div>

              {filtradas.map(t => (
                <div key={t.id} style={{ position: 'relative', overflow: 'hidden', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                  {/* Fundo vermelho revelado ao arrastar */}
                  <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 80, background: 'rgba(239,68,68,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                    🗑️
                  </div>
                  {/* Row deslizável */}
                  <div
                    onTouchStart={e => onSwipeStart(t.id, e)}
                    onTouchMove={e => onSwipeMove(t.id, e)}
                    onTouchEnd={() => onSwipeEnd(t.id, t)}
                    style={{
                      transform: `translateX(${swipeOffset[t.id] ?? 0}px)`,
                      transition: (swipeOffset[t.id] ?? 0) === 0 ? 'transform .25s ease' : 'none',
                      padding: '10px 12px',
                      background: selecionados.includes(t.id) ? 'rgba(74,222,128,.04)' : '#0a1205',
                      display: 'flex', alignItems: 'center', gap: 10,
                    }}>
                  <input type="checkbox" checked={selecionados.includes(t.id)} onChange={() => toggleSelecionado(t.id)}
                    onClick={e => e.stopPropagation()}
                    style={{ cursor: 'pointer', accentColor: '#4ade80', width: 15, height: 15, flexShrink: 0 }} />

                  <div onClick={() => abrirEdicao(t)} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
                    {/* Linha 1: descrição + valor */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: CORES[t.categoria] || '#6b7280', flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.descricao}</span>
                        {t.origem === 'webhook' && (
                          <span style={{ fontSize: 9, background: 'rgba(74,222,128,.1)', color: '#4ade80', padding: '1px 5px', borderRadius: 3, flexShrink: 0 }}>auto</span>
                        )}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: t.tipo === 'credito' ? '#4ade80' : '#f87171', flexShrink: 0 }}>
                        {t.tipo === 'credito' ? '+' : '-'}{fmtBRL(Math.abs(t.valor))}
                      </span>
                    </div>
                    {/* Linha 2: categoria + data */}
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,.45)', background: 'rgba(255,255,255,.06)', padding: '2px 7px', borderRadius: 10 }}>{t.categoria}</span>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>{fmtData(t.data_hora)}</span>
                    </div>
                  </div>

                  <button onClick={() => deletar(t.id)} disabled={deletando === t.id}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.2)', padding: 6, flexShrink: 0, opacity: deletando === t.id ? 0.4 : 1 }}>
                    <svg width="15" height="15" viewBox="0 0 14 14" fill="none"><path d="M2 4h10M5 4V3a1 1 0 011-1h2a1 1 0 011 1v1M6 7v3M8 7v3M3 4l1 7a1 1 0 001 1h4a1 1 0 001-1l1-7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                  </div>
                </div>
              ))}

              {/* Rodapé mobile */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderTop: '1px solid #1a3a1a' }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>
                  {filtroAtivo ? 'Saldo da seleção' : 'Saldo do período'}
                </span>
                <span style={{ fontSize: 14, fontWeight: 600, color: (filtroAtivo ? saldoFiltrado : saldoPeriodo) >= 0 ? '#4ade80' : '#f87171' }}>
                  {(filtroAtivo ? saldoFiltrado : saldoPeriodo) >= 0 ? '+' : '-'}{fmtBRL(Math.abs(filtroAtivo ? saldoFiltrado : saldoPeriodo))}
                </span>
              </div>
            </div>
          ) : (
            /* ── Layout desktop: tabela ── */
            <div style={{ overflowX: 'auto' }}><div style={{ minWidth: 520 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 120px 120px 110px 28px', gap: 10, padding: '6px 8px', borderBottom: '1px solid #1a3a1a', marginBottom: 4, alignItems: 'center' }}>
                <input type="checkbox"
                  checked={selecionados.length === filtradas.length && filtradas.length > 0}
                  onChange={toggleTodos}
                  style={{ cursor: 'pointer', accentColor: '#4ade80', width: 14, height: 14 }} />
                {['Descrição', 'Categoria', 'Data', 'Valor', ''].map(h => (
                  <div key={h} style={{ fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.05em', textAlign: h === 'Valor' ? 'right' : 'left' }}>{h}</div>
                ))}
              </div>

              {filtradas.map(t => (
                <div key={t.id} style={{
                  display: 'grid', gridTemplateColumns: '32px 1fr 120px 120px 110px 28px', gap: 10,
                  padding: '8px', borderRadius: 6, transition: 'background .12s',
                  borderBottom: '1px solid rgba(255,255,255,.04)',
                  background: selecionados.includes(t.id) ? 'rgba(74,222,128,.04)' : 'transparent',
                }}
                  onMouseEnter={e => { if (!selecionados.includes(t.id)) e.currentTarget.style.background = 'rgba(255,255,255,.03)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = selecionados.includes(t.id) ? 'rgba(74,222,128,.04)' : 'transparent' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <input type="checkbox" checked={selecionados.includes(t.id)} onChange={() => toggleSelecionado(t.id)}
                      onClick={e => e.stopPropagation()}
                      style={{ cursor: 'pointer', accentColor: '#4ade80', width: 14, height: 14 }} />
                  </div>
                  <div onClick={() => abrirEdicao(t)} style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, cursor: 'pointer' }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: CORES[t.categoria] || '#6b7280', flexShrink: 0 }} />
                    <div style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.descricao}</div>
                    {t.origem === 'webhook' && (
                      <span style={{ fontSize: 9, background: 'rgba(74,222,128,.1)', color: '#4ade80', padding: '1px 5px', borderRadius: 3, flexShrink: 0 }}>auto</span>
                    )}
                  </div>
                  <div onClick={() => abrirEdicao(t)} style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', alignSelf: 'center', cursor: 'pointer' }}>{t.categoria}</div>
                  <div onClick={() => abrirEdicao(t)} style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', alignSelf: 'center', cursor: 'pointer' }}>{fmtData(t.data_hora)}</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: t.tipo === 'credito' ? '#4ade80' : '#f87171', textAlign: 'right', alignSelf: 'center' }}>
                    {t.tipo === 'credito' ? '+' : '-'}{fmtBRL(Math.abs(t.valor))}
                  </div>
                  <button onClick={() => deletar(t.id)} disabled={deletando === t.id}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.2)', padding: 4, alignSelf: 'center', opacity: deletando === t.id ? 0.4 : 1 }}
                    onMouseEnter={e => { e.stopPropagation(); (e.currentTarget as HTMLButtonElement).style.color = '#f87171' }}
                    onMouseLeave={e => { e.stopPropagation(); (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,.2)' }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 4h10M5 4V3a1 1 0 011-1h2a1 1 0 011 1v1M6 7v3M8 7v3M3 4l1 7a1 1 0 001 1h4a1 1 0 001-1l1-7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                </div>
              ))}

              <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 120px 120px 110px 28px', gap: 10, padding: '10px 8px', borderTop: '1px solid #1a3a1a', marginTop: 4 }}>
                <div />
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>
                  {filtroAtivo
                    ? <span>Saldo da seleção <span style={{ color: 'rgba(255,255,255,.25)' }}>· {labelPeriodo(periodo)}: {saldoPeriodo >= 0 ? '+' : '-'}{fmtBRL(Math.abs(saldoPeriodo))}</span></span>
                    : <span style={{ fontWeight: 500, color: 'rgba(255,255,255,.5)' }}>Saldo do período</span>
                  }
                </div>
                <div /><div />
                <div style={{ fontSize: 13, fontWeight: 600, color: (filtroAtivo ? saldoFiltrado : saldoPeriodo) >= 0 ? '#4ade80' : '#f87171', textAlign: 'right' }}>
                  {(filtroAtivo ? saldoFiltrado : saldoPeriodo) >= 0 ? '+' : '-'}{fmtBRL(Math.abs(filtroAtivo ? saldoFiltrado : saldoPeriodo))}
                </div>
                <div />
              </div>
            </div></div>
          )}
        </div>
        {/* Espaçador para o último elemento não ficar atrás da barra de navegação */}
        <div style={{ height: '5rem' }} />
      </div>

      {/* ─── Modal edição ─── */}
      {modalAberto && transacaoEditando && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '0 1rem' }}
          onClick={e => { if (e.target === e.currentTarget) setModalAberto(false) }}>
          <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 16, padding: '1.5rem', width: '100%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Editar lançamento</div>

            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Descrição</label>
              <input value={editDescricao} onChange={e => setEditDescricao(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', background: '#0a0a0a', border: '1px solid #1a3a1a', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none' }} />
            </div>

            {/* Valor + Tipo */}
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Valor (R$)</label>
                <input
                  value={editValor}
                  onChange={e => setEditValor(e.target.value.replace(/[^0-9,]/g, ''))}
                  placeholder="0,00"
                  style={{ width: '100%', padding: '9px 12px', background: '#0a0a0a', border: '1px solid #1a3a1a', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Tipo</label>
                <div style={{ display: 'flex', gap: 4, height: 38 }}>
                  {(['debito', 'credito'] as const).map(tipo => (
                    <button key={tipo} type="button" onClick={() => setEditTipo(tipo)} style={{
                      padding: '0 14px', borderRadius: 8, border: `1px solid ${editTipo === tipo ? (tipo === 'credito' ? '#4ade80' : '#f87171') : '#1a3a1a'}`,
                      background: editTipo === tipo ? (tipo === 'credito' ? 'rgba(74,222,128,.12)' : 'rgba(248,113,113,.12)') : 'transparent',
                      color: editTipo === tipo ? (tipo === 'credito' ? '#4ade80' : '#f87171') : 'rgba(255,255,255,.35)',
                      fontSize: 12, cursor: 'pointer', fontWeight: editTipo === tipo ? 600 : 400,
                    }}>
                      {tipo === 'credito' ? 'Receita' : 'Despesa'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Categoria</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {[...TODAS_CATEGORIAS, ...categoriasExtra.filter(c => !TODAS_CATEGORIAS.includes(c))].map(c => (
                  <button key={c} type="button" onClick={() => setEditCategoria(c)} style={{
                    padding: '4px 10px', borderRadius: 20,
                    border: `1px solid ${editCategoria === c ? CORES[c] || '#4ade80' : '#1a3a1a'}`,
                    background: editCategoria === c ? `${CORES[c] || '#4ade80'}18` : 'transparent',
                    color: editCategoria === c ? CORES[c] || '#4ade80' : 'rgba(255,255,255,.4)',
                    fontSize: 11, cursor: 'pointer',
                  }}>{c}</button>
                ))}
              </div>
            </div>

            {contas.length > 0 && (
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Conta</label>
                <select value={editContaId} onChange={e => setEditContaId(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', background: '#0a0a0a', border: '1px solid #1a3a1a', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none', cursor: 'pointer' }}>
                  <option value="">Sem conta específica</option>
                  {contas.map(c => <option key={c.id} value={c.id}>{c.bancos?.nome_curto || '—'} · {c.nome}</option>)}
                </select>
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Data e hora</label>
              <input type="datetime-local" value={editDataHora} onChange={e => setEditDataHora(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', background: '#0a0a0a', border: '1px solid #1a3a1a', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none' }} />
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button onClick={() => setModalAberto(false)}
                style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid #1a3a1a', borderRadius: 8, color: 'rgba(255,255,255,.4)', fontSize: 13, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={salvarEdicao} disabled={salvandoEdicao}
                style={{ flex: 2, padding: '10px', background: '#16a34a', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: salvandoEdicao ? 'default' : 'pointer', opacity: salvandoEdicao ? 0.7 : 1 }}>
                {salvandoEdicao ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function GastosPageSearchParams() {
  const searchParams = useSearchParams()
  const tipoParam = searchParams.get('tipo') as 'debito' | 'credito' | null
  const de = searchParams.get('de') ?? undefined
  const ate = searchParams.get('ate') ?? undefined
  return <GastosPageInner tipoInicial={tipoParam ?? 'todos'} deInicial={de} ateInicial={ate} />
}

export default function GastosPage() {
  return (
    <Suspense fallback={null}>
      <GastosPageSearchParams />
    </Suspense>
  )
}