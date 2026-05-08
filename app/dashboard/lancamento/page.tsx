'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { usePerfil } from '@/hooks/usePerfil'

// ─── Sistema de tips ──────────────────────────────────────────────────────────
const TIPS_KEY = 'poupaup_tips_v1'

function useTips() {
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({})

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { setDismissed(JSON.parse(localStorage.getItem(TIPS_KEY) || '{}')) } catch { /* ignore */ }
  }, [])

  function dismiss(id: string) {
    const next = { ...dismissed, [id]: true }
    setDismissed(next)
    try { localStorage.setItem(TIPS_KEY, JSON.stringify(next)) } catch { /* ignore */ }
  }

  function isVisible(id: string) {
    return !dismissed[id]
  }

  return { isVisible, dismiss }
}

function TipCard({ id, icon, text, tips, accent = '#4ade80' }: {
  id: string
  icon: string
  text: string
  tips: ReturnType<typeof useTips>
  accent?: string
}) {
  if (!tips.isVisible(id)) return null
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '10px 12px',
      background: `${accent}08`,
      border: `1px solid ${accent}22`,
      borderLeft: `3px solid ${accent}`,
      borderRadius: 8,
      marginBottom: 12,
      animation: 'tipFadeIn .3s ease',
    }}>
      <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 12, color: 'rgba(255,255,255,.65)', lineHeight: 1.55 }}
        dangerouslySetInnerHTML={{ __html: text }} />
      <button
        onClick={() => tips.dismiss(id)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.25)', fontSize: 16, lineHeight: 1, flexShrink: 0, padding: '0 0 0 4px' }}
        title="Dispensar dica"
      >×</button>
      <style>{`@keyframes tipFadeIn { from { opacity:0; transform:translateY(-4px) } to { opacity:1; transform:translateY(0) } }`}</style>
    </div>
  )
}

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

interface TransacaoDetectada {
  descricao: string
  tipo_pagamento?: string
  valor: number
  tipo: string
  categoria: string
  data_hora: string
  nao_categorizado?: boolean
  potencial_duplicata?: boolean
  duplicata_origem?: 'historico' | 'lote'   // onde foi encontrada a duplicata
}

const CATEGORIAS_DESPESA = ['Alimentação','Transporte','Lazer','Saúde','Moradia','Educação','Outros']
const CATEGORIAS_RECEITA = ['Salário','Freelance','Investimento','Presente','Outros']
const TODAS_CATEGORIAS = [...new Set([...CATEGORIAS_DESPESA, ...CATEGORIAS_RECEITA])]

const CORES: Record<string, string> = {
  'Alimentação': '#4ade80', 'Transporte': '#22d3ee', 'Lazer': '#f97316',
  'Saúde': '#a78bfa', 'Moradia': '#fbbf24', 'Educação': '#60a5fa',
  'Salário': '#4ade80', 'Freelance': '#34d399', 'Investimento': '#818cf8',
  'Presente': '#f472b6', 'Outros': '#6b7280',
}

const ATALHOS = [
  { label: 'iFood',        cat: 'Alimentação', tipo: 'debito'  },
  { label: 'Uber',         cat: 'Transporte',  tipo: 'debito'  },
  { label: 'Mercado',      cat: 'Alimentação', tipo: 'debito'  },
  { label: 'Salário',      cat: 'Salário',     tipo: 'credito' },
  { label: 'Farmácia',     cat: 'Saúde',       tipo: 'debito'  },
  { label: 'Netflix',      cat: 'Lazer',       tipo: 'debito'  },
  { label: 'Luz/Água/Gás', cat: 'Moradia',     tipo: 'debito'  },
  { label: 'Freelance',    cat: 'Freelance',   tipo: 'credito' },
]

function fmtBRL(v: number) {
  return 'R$ ' + Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function dataLocalParaInput(timezone: string): string {
  const agora = new Date()
  const local = new Intl.DateTimeFormat('sv-SE', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(agora)
  return local.replace(' ', 'T').slice(0, 16)
}

function inputParaUTC(dataLocal: string, timezone: string): string {
  const [data, hora] = dataLocal.split('T')
  const [ano, mes, dia] = data.split('-').map(Number)
  const [h, min] = hora.split(':').map(Number)
  const dataObj = new Date(Date.UTC(ano, mes - 1, dia, h, min))
  const formatter = new Intl.DateTimeFormat('en', { timeZone: timezone, timeZoneName: 'shortOffset' })
  const parts = formatter.formatToParts(dataObj)
  const offset = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT+0'
  const match = offset.match(/GMT([+-]\d+)(?::(\d+))?/)
  const horas = match ? parseInt(match[1]) : 0
  const mins  = match ? parseInt(match[2] || '0') : 0
  const offsetMs = (horas * 60 + (horas < 0 ? -mins : mins)) * 60000
  return new Date(dataObj.getTime() - offsetMs).toISOString()
}

export default function LancamentoPage() {
  const router = useRouter()
  const supabase = createClient()
  const { fmtDataHora } = usePerfil()

  // ─── form ───
  const [tipo, setTipo]             = useState<'debito' | 'credito'>('debito')
  const [valor, setValor]           = useState('')
  const [descricao, setDescricao]   = useState('')
  const [categoria, setCategoria]   = useState('Alimentação')
  const [dataHora, setDataHora]     = useState('')
  const [timezone, setTimezone]     = useState('America/Sao_Paulo')
  const [recorrente, setRecorrente] = useState(false)
  const [salvando, setSalvando]     = useState(false)
  const [erro, setErro]             = useState('')
  const [sucesso, setSucesso]       = useState(false)
  const [userId, setUserId]         = useState('')
  const [contas, setContas]         = useState<Array<{ id: string; nome: string; tipo: string; bancos: { id: string; nome_curto: string; cor: string | null } | null }>>([])
  const [contaSelecionada, setConta] = useState('')

  // ─── histórico ───
  const [historico, setHistorico]   = useState<Transacao[]>([])
  const [deletando, setDeletando]   = useState<string | null>(null)

  // ─── filtro de conta no histórico ───
  const [filtroContaId, setFiltroContaId] = useState('')

  // ─── seleção em lote ───
  const [selecionados, setSelecionados] = useState<string[]>([])
  const [movendo, setMovendo]           = useState(false)
  const [contaDestino, setContaDestino] = useState('')
  const [excluindoLote, setExcluindoLote] = useState(false)

  // ─── modal nova conta (inline) ───
  const [modalNovaConta, setModalNovaConta] = useState(false)
  const [bancosLista, setBancosLista]       = useState<Array<{ id: string; nome: string; nome_curto: string; cor: string | null; codigo: string }>>([])
  const [buscaBancoModal, setBuscaBancoModal] = useState('')
  const [salvandoConta, setSalvandoConta]   = useState(false)
  const [erroNovaConta, setErroNovaConta]   = useState('')
  const [formNovaConta, setFormNovaConta]   = useState({
    banco_id: '', nome: '', tipo: 'corrente', numero: '', agencia: '', mostrar_saldo: true, saldo_inicial: '',
  })

  // ─── modal edição ───
  const [modalAberto, setModalAberto]       = useState(false)
  const [transacaoEditando, setTransacaoEditando] = useState<Transacao | null>(null)
  const [editDescricao, setEditDescricao]   = useState('')
  const [editCategoria, setEditCategoria]   = useState('')
  const [editContaId, setEditContaId]       = useState('')
  const [editDataHora, setEditDataHora]     = useState('')
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)

  // ─── upload ───
  const inputRef                    = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver]     = useState(false)
  const [processando, setProcessan] = useState(false)
  const [etapaUpload, setEtapa]     = useState('')
  const [confirmando, setConfirman] = useState(false)
  const [transacoesDetectadas, setTransacoesDetectadas] = useState<TransacaoDetectada[]>([])
  const [resumoDetectado, setResumo] = useState('')
  const [csvDebug, setCsvDebug]       = useState('')
  const [tipoDocumento, setTipoDocumento] = useState('')
  const [bancoDetectado, setBancoDetectado] = useState<{ id: string; nome_curto: string; cor: string | null } | null>(null)
  const [contaUpload, setContaUpload] = useState('')
  // Controle de edição inline de categoria (índice do item em edição)
  const [editandoCategoriaIdx, setEditandoCategoriaIdx] = useState<number | null>(null)

  // ─── cadastro inline de conta (no upload) ───
  const [contaInlineAberta, setContaInlineAberta] = useState(false)

  // ─── confirmação de conta destino antes de importar ───
  const [etapaConfirmacao, setEtapaConfirmacao] = useState(false)

  // ─── modal conta não encontrada ───
  const [modalContaNaoEncontrada, setModalContaNaoEncontrada] = useState(false)
  const [bancoNaoEncontrado, setBancoNaoEncontrado] = useState('')

  useEffect(() => {
    const client = createClient()
    client.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      client.from('profiles').select('timezone').eq('id', user.id).single().then(({ data }) => {
        const tz = data?.timezone || 'America/Sao_Paulo'
        setTimezone(tz)
        setDataHora(dataLocalParaInput(tz))
      })
    })
  }, [])

  useEffect(() => {
    fetch('/api/contas').then(r => r.json()).then(d => setContas(d.contas || []))
  }, [])

  const carregarHistorico = useCallback(async (contaFiltro?: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setUserId(user.id)
    let query = supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('data_hora', { ascending: false })
      .limit(50)
    if (contaFiltro === '__sem_conta__') query = query.is('conta_id', null)
    else if (contaFiltro) query = query.eq('conta_id', contaFiltro)
    const { data } = await query
    if (data) setHistorico(data)
  }, [supabase, router])

useEffect(() => {
  carregarHistorico(filtroContaId || undefined) // eslint-disable-line react-hooks/set-state-in-effect
}, [carregarHistorico, filtroContaId])

  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel('lancamento-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${userId}` }, () => { carregarHistorico() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  function handleSetTipo(t: 'debito' | 'credito') {
    setTipo(t)
    setCategoria(t === 'debito' ? 'Alimentação' : 'Salário')
  }

  function aplicarAtalho(atalho: typeof ATALHOS[0]) {
    handleSetTipo(atalho.tipo as 'debito' | 'credito')
    setDescricao(atalho.label)
    setCategoria(atalho.cat)
  }

  function formatarValor(raw: string) {
    const numeros = raw.replace(/\D/g, '')
    if (!numeros) return ''
    const numero = parseInt(numeros) / 100
    return numero.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  function valorNumerico() {
    return parseFloat(valor.replace(/\./g, '').replace(',', '.')) || 0
  }

  async function abrirModalNovaConta() {
    if (bancosLista.length === 0) {
      const res = await fetch('/api/bancos')
      const d = await res.json()
      setBancosLista(d.bancos || [])
    }
    setErroNovaConta('')
    setFormNovaConta({ banco_id: '', nome: '', tipo: 'corrente', numero: '', agencia: '', mostrar_saldo: true, saldo_inicial: '' })
    setBuscaBancoModal('')
    setModalNovaConta(true)
  }

  async function salvarNovaConta(e: React.FormEvent) {
    e.preventDefault()
    if (!formNovaConta.banco_id) { setErroNovaConta('Selecione um banco'); return }
    if (!formNovaConta.nome.trim()) { setErroNovaConta('Nome da conta obrigatório'); return }
    setSalvandoConta(true); setErroNovaConta('')
    const res = await fetch('/api/contas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formNovaConta),
    })
    const data = await res.json()
    setSalvandoConta(false)
    if (!data.ok) { setErroNovaConta(data.error || 'Erro ao salvar'); return }
    const contasRes = await fetch('/api/contas')
    const contasDados = await contasRes.json()
    setContas(contasDados.contas || [])
    setContaUpload(data.conta.id)
    setModalNovaConta(false)
    setContaInlineAberta(false)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    const v = valorNumerico()
    if (!v || v <= 0) { setErro('Digite um valor válido'); return }
    if (!descricao.trim()) { setErro('Digite uma descrição'); return }
    setSalvando(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('transactions').insert({
      user_id: user.id,
      descricao: descricao.trim().toUpperCase(),
      valor: tipo === 'debito' ? -v : v,
      tipo,
      categoria,
      data_hora: inputParaUTC(dataHora, timezone),
      origem: 'manual',
      conta_id: contaSelecionada || null,
    })
    if (error) { setErro('Erro ao salvar: ' + error.message); setSalvando(false); return }
    setSalvando(false)
    setSucesso(true)
    setValor('')
    setDescricao('')
    setDataHora(dataLocalParaInput(timezone))
    carregarHistorico()
    setTimeout(() => setSucesso(false), 2500)
  }

  async function handleUpload(arquivo: File) {
    if (!arquivo) return
    if (arquivo.size > 15 * 1024 * 1024) { setErro('Arquivo muito grande. Máx 15MB'); return }
    setProcessan(true)
    setTransacoesDetectadas([])
    setEditandoCategoriaIdx(null)
    setErro('')

    const isPDF = arquivo.name.toLowerCase().endsWith('.pdf')
    const uploadForm = new FormData()
    uploadForm.append('arquivo', arquivo)

    setEtapa(isPDF ? '📄 Enviando PDF para a IA...' : '🤖 Analisando com IA...')
    const res  = await fetch('/api/lancamento/upload', { method: 'POST', body: uploadForm })
    const data = await res.json()
    setProcessan(false)
    setEtapa('')
    if (!data.ok || !data.transacoes?.length) {
      setErro(data.error || 'Não foi possível extrair transações do documento')
      return
    }
    const comDuplicatas = detectarDuplicatas(data.transacoes, historico)
    setTransacoesDetectadas(comDuplicatas)
    setResumo(data.resumo || `${data.transacoes.length} transações encontradas`)
    setCsvDebug(data._csv_debug || '')
    setTipoDocumento(data.tipo_documento || '')

    if (data.conta_vinculada) {
      const contaMatch = contas.find(c => c.bancos?.nome_curto === data.conta_vinculada || c.nome === data.conta_vinculada)
      if (contaMatch) setContaUpload(contaMatch.id)
    }
    if (data.banco_nao_encontrado) {
      setBancoNaoEncontrado(data.banco_nome || 'Desconhecido')
      setModalContaNaoEncontrada(true)
    }
    if (data.banco_id) {
      const bancoDados = await (await fetch('/api/bancos')).json()
      const banco = bancoDados.bancos?.find((b: { id: string }) => b.id === data.banco_id)
      if (banco) {
        setBancoDetectado(banco)
        const contasBanco = contas.filter(c => c.bancos?.id === banco.id)
        if (contasBanco.length === 1) setContaUpload(contasBanco[0].id)
      }
    }
  }

  function editarTransacao(i: number, campo: string, val: string) {
    setTransacoesDetectadas(prev => prev.map((t, idx) =>
      idx === i ? { ...t, [campo]: val, ...(campo === 'categoria' ? { nao_categorizado: false } : {}) } : t
    ))
  }

  function removerTransacao(i: number) {
    setTransacoesDetectadas(prev => prev.filter((_, idx) => idx !== i))
    setEditandoCategoriaIdx(null)
  }

  function categorizarNaoCategorizadosComoOutros() {
    setTransacoesDetectadas(prev => prev.map(t =>
      t.nao_categorizado ? { ...t, categoria: 'Outros', nao_categorizado: false } : t
    ))
  }

  function detectarDuplicatas(detectadas: TransacaoDetectada[], existentes: Transacao[]): TransacaoDetectada[] {
    return detectadas.map(t => {
      // Checa duplicata no histórico existente
      const valorAbs = Math.abs(t.valor)
      const dataT = new Date(t.data_hora)
      const duplicataHistorico = existentes.some(e => {
        const diff = Math.abs(new Date(e.data_hora).getTime() - dataT.getTime())
        return Math.abs(e.valor) === valorAbs && diff < 3 * 24 * 60 * 60 * 1000 &&
          e.descricao.toLowerCase().trim() === t.descricao.toLowerCase().trim()
      })
      // Checa duplicata dentro do próprio lote
      const duplicataLote = detectadas.some((other) =>
        other !== t &&
        Math.abs(other.valor) === valorAbs &&
        other.descricao.toLowerCase().trim() === t.descricao.toLowerCase().trim() &&
        Math.abs(new Date(other.data_hora).getTime() - dataT.getTime()) < 60 * 1000
      )
      if (duplicataHistorico) return { ...t, potencial_duplicata: true, duplicata_origem: 'historico' as const }
      if (duplicataLote) return { ...t, potencial_duplicata: true, duplicata_origem: 'lote' as const }
      return t
    })
  }

  function descartarDuplicatas() {
    setTransacoesDetectadas(prev => prev.filter(t => !t.potencial_duplicata))
  }

  function desmarcarDuplicata(i: number) {
    setTransacoesDetectadas(prev => prev.map((t, idx) =>
      idx === i ? { ...t, potencial_duplicata: false, duplicata_origem: undefined } : t
    ))
  }

  async function confirmarLancamentos() {
    setConfirman(true)
    const res = await fetch('/api/lancamento/confirmar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transacoes: transacoesDetectadas, conta_id: contaUpload || null }),
    })
    const data = await res.json()
    setConfirman(false)
    if (data.ok) {
      setTransacoesDetectadas([])
      setResumo('')
      setBancoDetectado(null)
      setContaUpload('')
      setEtapaConfirmacao(false)
      setContaInlineAberta(false)
      setSucesso(true)
      carregarHistorico()
      setTimeout(() => setSucesso(false), 3000)
    } else {
      setErro(data.error || 'Erro ao confirmar')
    }
  }

  async function deletar(id: string) {
    setDeletando(id)
    await fetch(`/api/lancamento/${id}`, { method: 'DELETE' })
    setDeletando(null)
    carregarHistorico()
  }

  // ─── seleção em lote ───
  function toggleSelecionado(id: string) {
    setSelecionados(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  function toggleTodos() {
    setSelecionados(prev => prev.length === historico.length ? [] : historico.map(t => t.id))
  }

  async function excluirSelecionados() {
    if (!selecionados.length) return
    setExcluindoLote(true)
    await Promise.all(selecionados.map(id => fetch(`/api/lancamento/${id}`, { method: 'DELETE' })))
    setSelecionados([])
    setExcluindoLote(false)
    carregarHistorico()
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
    carregarHistorico()
  }

  // ─── modal edição ───
  function abrirEdicao(t: Transacao) {
    setTransacaoEditando(t)
    setEditDescricao(t.descricao)
    setEditCategoria(t.categoria)
    setEditContaId(t.conta_id || '')
    setEditDataHora(t.data_hora ? new Date(t.data_hora).toISOString().slice(0, 16) : '')
    setModalAberto(true)
  }

  async function salvarEdicao() {
    if (!transacaoEditando) return
    setSalvandoEdicao(true)
    await fetch(`/api/lancamento/${transacaoEditando.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        descricao: editDescricao.toUpperCase(),
        categoria: editCategoria,
        conta_id: editContaId || null,
        data_hora: editDataHora ? new Date(editDataHora).toISOString() : transacaoEditando.data_hora,
      }),
    })
    setSalvandoEdicao(false)
    setModalAberto(false)
    setTransacaoEditando(null)
    carregarHistorico()
  }

  const categorias = tipo === 'debito' ? CATEGORIAS_DESPESA : CATEGORIAS_RECEITA
  const tips = useTips()

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: 'system-ui, sans-serif', fontSize: 13, color: '#fff' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '.875rem 1.5rem', borderBottom: '1px solid #1a3a1a', background: '#0a1a0a', gap: 12 }}>
        <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.4)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Dashboard
        </button>
        <span style={{ color: 'rgba(255,255,255,.2)' }}>/</span>
        <span style={{ fontSize: 15, fontWeight: 500 }}>Lançamento</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', minHeight: 'calc(100vh - 53px)' }}>

        {/* ─── Formulário ─── */}
        <div style={{ borderRight: '1px solid #1a3a1a', padding: '1.5rem', overflowY: 'auto' }}>

          <div style={{ display: 'flex', background: 'rgba(0,0,0,.4)', border: '1px solid #1a3a1a', borderRadius: 12, padding: 4, marginBottom: '1.5rem' }}>
            {(['debito', 'credito'] as const).map(t => (
              <button key={t} onClick={() => handleSetTipo(t)} style={{
                flex: 1, padding: '10px', borderRadius: 9, border: 'none', cursor: 'pointer',
                fontWeight: 600, fontSize: 13, transition: 'all .2s',
                background: tipo === t ? (t === 'debito' ? 'rgba(239,68,68,.2)' : 'rgba(22,163,74,.2)') : 'transparent',
                color: tipo === t ? (t === 'debito' ? '#f87171' : '#4ade80') : 'rgba(255,255,255,.3)',
                borderBottom: tipo === t ? `2px solid ${t === 'debito' ? '#f87171' : '#4ade80'}` : '2px solid transparent',
              }}>
                {t === 'debito' ? '↓ Despesa' : '↑ Receita'}
              </button>
            ))}
          </div>

          <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Valor</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <span style={{ fontSize: 22, color: 'rgba(255,255,255,.3)', fontWeight: 300 }}>R$</span>
              <input type="text" inputMode="numeric" value={valor}
                onChange={e => setValor(formatarValor(e.target.value))} placeholder="0,00"
                style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 42, fontWeight: 700, textAlign: 'center', color: tipo === 'debito' ? '#f87171' : '#4ade80', width: 220 }}
              />
            </div>
            <div style={{ height: 2, background: tipo === 'debito' ? 'rgba(248,113,113,.3)' : 'rgba(74,222,128,.3)', borderRadius: 1, margin: '8px auto 0', width: 200 }} />
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Atalhos rápidos</div>
            <TipCard id="tip-atalhos" icon="⚡" tips={tips}
              text="Clique num atalho para preencher descrição e categoria automaticamente. Seus favoritos aparecem aqui." />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {ATALHOS.filter(a => a.tipo === tipo).map(a => (
                <button key={a.label} onClick={() => aplicarAtalho(a)} style={{
                  padding: '5px 12px', borderRadius: 20, border: `1px solid ${CORES[a.cat] || '#1a3a1a'}22`,
                  background: descricao === a.label ? `${CORES[a.cat]}22` : 'rgba(255,255,255,.04)',
                  color: descricao === a.label ? CORES[a.cat] || '#fff' : 'rgba(255,255,255,.5)',
                  fontSize: 11, cursor: 'pointer', transition: 'all .15s',
                }}>{a.label}</button>
              ))}
            </div>
          </div>

          <form onSubmit={salvar}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,.4)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' }}>Descrição</label>
              <input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex: Almoço, Gasolina, Netflix..." required
                style={{ width: '100%', padding: '9px 12px', background: '#111', border: '1px solid #1a3a1a', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none' }} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,.4)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' }}>Categoria</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {categorias.map(c => (
                  <button key={c} type="button" onClick={() => setCategoria(c)} style={{
                    padding: '5px 12px', borderRadius: 20, border: `1px solid ${categoria === c ? CORES[c] || '#4ade80' : '#1a3a1a'}`,
                    background: categoria === c ? `${CORES[c] || '#4ade80'}18` : 'transparent',
                    color: categoria === c ? CORES[c] || '#4ade80' : 'rgba(255,255,255,.4)',
                    fontSize: 11, cursor: 'pointer', transition: 'all .15s', fontWeight: categoria === c ? 500 : 400,
                  }}>{c}</button>
                ))}
              </div>
            </div>

            {contas.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,.4)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' }}>Conta (opcional)</label>
                <TipCard id="tip-conta-manual" icon="🏦" tips={tips} accent="#22d3ee"
                  text="Vincule o lançamento a uma conta para manter os <strong>saldos sempre atualizados</strong>. Sem vínculo, a transação fica no histórico geral." />
                <select value={contaSelecionada} onChange={e => setConta(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', background: '#111', border: '1px solid #1a3a1a', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none', cursor: 'pointer' }}>
                  <option value="">Sem conta específica</option>
                  {contas.map(c => (
                    <option key={c.id} value={c.id}>{c.bancos?.nome_curto || '—'} · {c.nome} ({c.tipo})</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,.4)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' }}>Data e hora</label>
              <input type="datetime-local" value={dataHora} onChange={e => setDataHora(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', background: '#111', border: '1px solid #1a3a1a', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none' }} />
            </div>

            <div onClick={() => setRecorrente(!recorrente)} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.25rem', padding: '10px 12px', background: '#111', border: '1px solid #1a3a1a', borderRadius: 8, cursor: 'pointer' }}>
              <div style={{ width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${recorrente ? '#16a34a' : '#1a3a1a'}`, background: recorrente ? '#16a34a' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .15s' }}>
                {recorrente && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><polyline points="1.5,5 4,7.5 8.5,2" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500 }}>Lançamento recorrente</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)' }}>Marcar como gasto fixo mensal</div>
              </div>
            </div>

            {erro && <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#f87171', marginBottom: 12 }}>{erro}</div>}
            {sucesso && (
              <div style={{ background: 'rgba(74,222,128,.1)', border: '1px solid rgba(74,222,128,.3)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#4ade80', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><polyline points="2,7 5.5,10.5 12,3" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Lançamento salvo com sucesso!
              </div>
            )}

            <button type="submit" disabled={salvando} style={{
              width: '100%', padding: 13,
              background: tipo === 'debito' ? 'rgba(239,68,68,.2)' : '#16a34a',
              border: `1px solid ${tipo === 'debito' ? 'rgba(239,68,68,.4)' : '#16a34a'}`,
              borderRadius: 10, color: tipo === 'debito' ? '#f87171' : '#fff',
              fontSize: 14, fontWeight: 600, cursor: salvando ? 'default' : 'pointer', opacity: salvando ? 0.6 : 1, transition: 'all .15s',
            }}>
              {salvando ? 'Salvando...' : `Lançar ${tipo === 'debito' ? 'despesa' : 'receita'}${valor ? ' de R$ ' + valor : ''}`}
            </button>
          </form>

          {/* Upload */}
          <div style={{ marginTop: '2rem', borderTop: '1px solid #1a3a1a', paddingTop: '1.5rem' }}>

            {/* Cabeçalho da seção */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>📎 Importar extrato ou fatura</div>
              <span style={{ fontSize: 10, background: 'rgba(74,222,128,.1)', border: '1px solid rgba(74,222,128,.2)', color: '#4ade80', padding: '2px 8px', borderRadius: 10 }}>IA</span>
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', marginBottom: 14 }}>
              A IA lê o documento e lança todas as transações automaticamente — sem digitar nada.
            </div>

            {/* Tip principal do upload — mostrada apenas antes do primeiro uso */}
            <TipCard id="tip-upload-intro" icon="✨" tips={tips} accent="#a78bfa"
              text="<strong>Dica de primeiro uso:</strong> Vá ao app do seu banco → Extrato → Baixar PDF, depois arraste o arquivo aqui. A IA detecta banco, datas, valores e categorias automaticamente." />

            {/* 4 passos — só aparece quando não há transações detectadas e não está processando */}
            {transacoesDetectadas.length === 0 && !processando && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 14 }}>
                {[
                  { n: '1', label: 'Envie', desc: 'PDF, imagem ou CSV', icon: '📤' },
                  { n: '2', label: 'IA analisa', desc: 'Detecta e categoriza', icon: '🤖' },
                  { n: '3', label: 'Revise', desc: 'Edite ou remova', icon: '✏️' },
                  { n: '4', label: 'Confirme', desc: 'Lança tudo de uma vez', icon: '✅' },
                ].map((step, i) => (
                  <div key={step.n} style={{
                    textAlign: 'center', padding: '10px 6px',
                    background: 'rgba(255,255,255,.02)',
                    border: '1px solid #1a3a1a',
                    borderRadius: 10,
                    position: 'relative',
                  }}>
                    {i < 3 && (
                      <div style={{ position: 'absolute', right: -4, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'rgba(255,255,255,.2)', zIndex: 1 }}>›</div>
                    )}
                    <div style={{ fontSize: 18, marginBottom: 4 }}>{step.icon}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#4ade80', marginBottom: 2, letterSpacing: '.03em' }}>{step.label}</div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,.3)', lineHeight: 1.3 }}>{step.desc}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Drop zone */}
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files[0]) }}
              style={{
                border: `2px dashed ${dragOver ? '#4ade80' : '#1e3a1e'}`,
                borderRadius: 14,
                padding: dragOver ? '2rem 1.5rem' : '1.5rem',
                textAlign: 'center',
                cursor: 'pointer',
                background: dragOver ? 'rgba(74,222,128,.06)' : 'rgba(255,255,255,.01)',
                transition: 'all .2s',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Glow de fundo animado quando hovering */}
              {dragOver && (
                <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 50%, rgba(74,222,128,.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
              )}
              <div style={{ fontSize: dragOver ? 40 : 34, marginBottom: 10, transition: 'font-size .2s' }}>
                {dragOver ? '📂' : '📄'}
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, color: dragOver ? '#4ade80' : 'rgba(255,255,255,.6)', marginBottom: 4, transition: 'color .2s' }}>
                {dragOver ? 'Solte para enviar' : 'Clique ou arraste o arquivo aqui'}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.25)', marginBottom: 10 }}>
                PDF · JPG · PNG · WEBP · CSV — máx 15MB
              </div>
              {/* Tipos de documento */}
              <div style={{ display: 'flex', gap: 5, justifyContent: 'center', flexWrap: 'wrap' }}>
                {[
                  { label: 'Extrato', icon: '🏦' },
                  { label: 'Fatura', icon: '💳' },
                  { label: 'Holerite', icon: '📋' },
                  { label: 'Nota fiscal', icon: '🧾' },
                  { label: 'Cupom', icon: '🏷️' },
                  { label: 'Recibo', icon: '📝' },
                ].map(t => (
                  <span key={t.label} style={{
                    fontSize: 10, padding: '3px 9px', borderRadius: 20,
                    background: 'rgba(255,255,255,.04)',
                    border: '1px solid rgba(255,255,255,.08)',
                    color: 'rgba(255,255,255,.45)',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    <span style={{ fontSize: 11 }}>{t.icon}</span>{t.label}
                  </span>
                ))}
              </div>
              <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.csv" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) { handleUpload(e.target.files[0]); e.target.value = '' } }} />
            </div>

            {/* Processando */}
            {processando && (
              <div style={{ marginTop: 14, padding: '14px 16px', background: 'rgba(167,139,250,.06)', border: '1px solid rgba(167,139,250,.2)', borderRadius: 10 }}>
                <style>{`
                  @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
                  @keyframes pulse { 0%,100% { transform: scale(1); opacity:.8 } 50% { transform: scale(1.12); opacity:1 } }
                  @keyframes blink { 0%,100% { opacity: 1 } 50% { opacity: .4 } }
                `}</style>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: etapaUpload ? 10 : 0 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(167,139,250,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, animation: 'pulse 1.5s ease-in-out infinite' }}>
                    🤖
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#a78bfa' }}>
                      {etapaUpload || 'Analisando com IA...'}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', marginTop: 2 }}>Aguarde, este processo pode levar alguns segundos</div>
                  </div>
                </div>
                {/* Barra de progresso animada */}
                <div style={{ height: 3, background: 'rgba(167,139,250,.15)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: 'linear-gradient(90deg, #7c3aed, #a78bfa, #7c3aed)', backgroundSize: '200% 100%', animation: 'slide 1.8s linear infinite', borderRadius: 2 }} />
                </div>
                <style>{`@keyframes slide { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>
              </div>
            )}

            {transacoesDetectadas.length > 0 && !processando && (
              <div style={{ marginTop: 14 }}>

                {/* Banner de sucesso da detecção */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'rgba(74,222,128,.07)', border: '1px solid rgba(74,222,128,.2)', borderRadius: 10, marginBottom: 14 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(74,222,128,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>✅</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#4ade80' }}>{resumoDetectado}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>Revise, edite categorias e confirme a conta destino antes de lançar</div>
                  </div>
                </div>

                {csvDebug && (
                  <details style={{ marginBottom: 14 }}>
                    <summary style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', cursor: 'pointer', userSelect: 'none', marginBottom: 6 }}>
                      🔍 CSV bruto gerado pela IA ({csvDebug.split('\n').length - 1} linhas)
                    </summary>
                    <pre style={{
                      fontSize: 10, color: 'rgba(255,255,255,.55)', background: 'rgba(0,0,0,.3)',
                      border: '1px solid rgba(255,255,255,.08)', borderRadius: 6,
                      padding: '8px 10px', overflowX: 'auto', maxHeight: 300,
                      overflowY: 'auto', whiteSpace: 'pre', lineHeight: 1.6,
                    }}>{csvDebug}</pre>
                  </details>
                )}

                {/* Banco detectado + tipo de documento */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                  {bancoDetectado && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: '#0a1a0a', border: '1px solid #1a3a1a', borderRadius: 8 }}>
                      <div style={{ width: 18, height: 18, borderRadius: 3, background: bancoDetectado.cor || '#4ade80', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                        {bancoDetectado.nome_curto[0]}
                      </div>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,.7)' }}>{bancoDetectado.nome_curto}</span>
                    </div>
                  )}
                  {tipoDocumento && (
                    <div style={{ display: 'flex', alignItems: 'center', padding: '5px 10px', background: 'rgba(74,222,128,.07)', border: '1px solid rgba(74,222,128,.15)', borderRadius: 8 }}>
                      <span style={{ fontSize: 11, color: 'rgba(74,222,128,.8)' }}>
                        {{ extrato_bancario: '🏦 Extrato', fatura_cartao: '💳 Fatura', nota_fiscal: '🧾 Nota fiscal', holerite: '📋 Holerite', recibo: '🧾 Recibo', outro: '📄 Documento' }[tipoDocumento] || tipoDocumento}
                      </span>
                    </div>
                  )}
                </div>

                {/* Vincular conta */}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,.4)', marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: '.05em' }}>Vincular à conta</label>
                  <TipCard id="tip-conta-upload" icon="💡" tips={tips} accent="#fbbf24"
                    text="Selecione a conta do extrato importado. Isso mantém o saldo da conta sempre correto. Ainda não tem? Cadastre uma clicando em <strong>＋ Cadastrar nova conta</strong> abaixo." />
                  <select
                    value={contaUpload}
                    onChange={e => {
                      if (e.target.value === '__nova__') {
                        setContaInlineAberta(true)
                        setContaUpload('')
                        setEtapaConfirmacao(false)
                        if (bancosLista.length === 0) fetch('/api/bancos').then(r => r.json()).then(d => setBancosLista(d.bancos || []))
                        setErroNovaConta('')
                        setFormNovaConta({ banco_id: '', nome: '', tipo: 'corrente', numero: '', agencia: '', mostrar_saldo: true, saldo_inicial: '' })
                        setBuscaBancoModal('')
                      } else {
                        setContaUpload(e.target.value)
                        setContaInlineAberta(false)
                        setEtapaConfirmacao(false)
                      }
                    }}
                    style={{ width: '100%', padding: '9px 12px', background: '#111', border: `1px solid ${contaInlineAberta ? '#4ade80' : '#1a3a1a'}`, borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="">Sem conta específica</option>
                    {contas.filter(c => !bancoDetectado || c.bancos?.id === bancoDetectado.id).map(c => (
                      <option key={c.id} value={c.id}>{c.bancos?.nome_curto || '—'} — {c.nome}</option>
                    ))}
                    <option value="__nova__">＋ Cadastrar nova conta</option>
                  </select>

                  {/* ── Formulário inline de nova conta ── */}
                  {contaInlineAberta && (
                    <div style={{ marginTop: 10, background: '#0a1a0a', border: '1px solid #1a5a1a', borderRadius: 10, padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#4ade80' }}>Nova conta</span>
                        <button type="button" onClick={() => setContaInlineAberta(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.3)', fontSize: 16, lineHeight: 1 }}>×</button>
                      </div>
                      <form onSubmit={salvarNovaConta} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

                        {/* Busca banco */}
                        <div>
                          <label style={{ display: 'block', fontSize: 10, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Banco</label>
                          <input
                            value={buscaBancoModal}
                            onChange={e => setBuscaBancoModal(e.target.value)}
                            placeholder="Buscar pelo nome ou código..."
                            style={{ width: '100%', padding: '8px 10px', background: '#111', border: '1px solid #1a3a1a', borderRadius: 8, color: '#fff', fontSize: 12, outline: 'none', marginBottom: 6 }}
                          />
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5, maxHeight: 130, overflowY: 'auto' }}>
                            {bancosLista
                              .filter(b => !buscaBancoModal || b.nome_curto.toLowerCase().includes(buscaBancoModal.toLowerCase()) || b.codigo.includes(buscaBancoModal))
                              .slice(0, 20)
                              .map(b => (
                                <button key={b.id} type="button"
                                  onClick={() => setFormNovaConta(p => ({ ...p, banco_id: b.id }))}
                                  style={{
                                    padding: '6px 4px', borderRadius: 7, cursor: 'pointer', fontSize: 10, fontWeight: 500, textAlign: 'center',
                                    background: formNovaConta.banco_id === b.id ? `${b.cor || '#4ade80'}22` : 'rgba(255,255,255,.03)',
                                    border: `1px solid ${formNovaConta.banco_id === b.id ? b.cor || '#4ade80' : '#1a3a1a'}`,
                                    color: formNovaConta.banco_id === b.id ? b.cor || '#4ade80' : 'rgba(255,255,255,.5)',
                                  }}
                                >{b.nome_curto}</button>
                              ))}
                          </div>
                        </div>

                        {/* Nome da conta */}
                        <div>
                          <label style={{ display: 'block', fontSize: 10, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Nome da conta</label>
                          <input
                            value={formNovaConta.nome}
                            onChange={e => setFormNovaConta(p => ({ ...p, nome: e.target.value }))}
                            placeholder="Ex: Nubank pessoal..."
                            required
                            style={{ width: '100%', padding: '8px 10px', background: '#111', border: '1px solid #1a3a1a', borderRadius: 8, color: '#fff', fontSize: 12, outline: 'none' }}
                          />
                        </div>

                        {/* Tipo */}
                        <div>
                          <label style={{ display: 'block', fontSize: 10, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Tipo</label>
                          <div style={{ display: 'flex', gap: 5 }}>
                            {(['corrente', 'poupança', 'crédito', 'investimento'] as const).map(t => (
                              <button key={t} type="button" onClick={() => setFormNovaConta(p => ({ ...p, tipo: t }))} style={{
                                flex: 1, padding: '6px 3px', borderRadius: 7, border: `1px solid ${formNovaConta.tipo === t ? '#4ade80' : '#1a3a1a'}`,
                                background: formNovaConta.tipo === t ? 'rgba(74,222,128,.12)' : 'transparent',
                                color: formNovaConta.tipo === t ? '#4ade80' : 'rgba(255,255,255,.4)', fontSize: 10, cursor: 'pointer',
                              }}>{t}</button>
                            ))}
                          </div>
                        </div>

                        {/* Saldo inicial */}
                        <div>
                          <label style={{ display: 'block', fontSize: 10, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Saldo inicial (opcional)</label>
                          <input type="number" value={formNovaConta.saldo_inicial} onChange={e => setFormNovaConta(p => ({ ...p, saldo_inicial: e.target.value }))}
                            placeholder="0,00" step="0.01" min="0"
                            style={{ width: '100%', padding: '8px 10px', background: '#111', border: '1px solid #1a3a1a', borderRadius: 8, color: '#fff', fontSize: 12, outline: 'none' }} />
                        </div>

                        {erroNovaConta && (
                          <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 7, padding: '7px 10px', fontSize: 11, color: '#f87171' }}>{erroNovaConta}</div>
                        )}

                        <div style={{ display: 'flex', gap: 7 }}>
                          <button type="button" onClick={() => setContaInlineAberta(false)}
                            style={{ flex: 1, padding: '8px', background: 'transparent', border: '1px solid #1a3a1a', borderRadius: 8, color: 'rgba(255,255,255,.4)', fontSize: 12, cursor: 'pointer' }}>
                            Cancelar
                          </button>
                          <button type="submit" disabled={salvandoConta}
                            style={{ flex: 2, padding: '8px', background: '#16a34a', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 600, cursor: salvandoConta ? 'default' : 'pointer', opacity: salvandoConta ? 0.7 : 1 }}>
                            {salvandoConta ? 'Cadastrando...' : 'Cadastrar e vincular'}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>

                {/* ── Transações categorizadas ─────────────────────────── */}
                {transacoesDetectadas.filter(t => !t.nao_categorizado).length > 0 && (
                  <>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>
                      ✅ Categorizados ({transacoesDetectadas.filter(t => !t.nao_categorizado).length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 240, overflowY: 'auto', marginBottom: 10 }}>
                      {transacoesDetectadas.map((t, i) => t.nao_categorizado ? null : (
                        <div key={i} style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 8, padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button onClick={() => removerTransacao(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.25)', fontSize: 13, flexShrink: 0, lineHeight: 1 }}>✕</button>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <input value={t.descricao} onChange={e => editarTransacao(i, 'descricao', e.target.value)}
                              style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 12, fontWeight: 500, width: '100%', outline: 'none' }} />
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                              <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: `${CORES[t.categoria] || '#6b7280'}18`, color: CORES[t.categoria] || '#6b7280', border: `1px solid ${CORES[t.categoria] || '#6b7280'}33`, cursor: 'pointer' }}
                                onClick={() => setEditandoCategoriaIdx(editandoCategoriaIdx === i ? null : i)}>
                                {t.categoria} ▾
                              </span>
                              {editandoCategoriaIdx === i && (
                                <select autoFocus value={t.categoria}
                                  onChange={e => { editarTransacao(i, 'categoria', e.target.value); setEditandoCategoriaIdx(null) }}
                                  onBlur={() => setEditandoCategoriaIdx(null)}
                                  style={{ fontSize: 11, padding: '2px 6px', background: '#0a0a0a', border: '1px solid #1a3a1a', borderRadius: 6, color: '#fff', outline: 'none' }}>
                                  {TODAS_CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                              )}
                              {t.tipo_pagamento && (
                                <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 6, background: 'rgba(255,255,255,.05)', color: 'rgba(255,255,255,.35)', border: '1px solid rgba(255,255,255,.1)' }}>
                                  {t.tipo_pagamento}
                                </span>
                              )}
                              <span style={{ fontSize: 9, color: 'rgba(255,255,255,.3)' }}>{new Date(t.data_hora).toLocaleDateString('pt-BR')}</span>
                            </div>
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: t.tipo === 'credito' ? '#4ade80' : '#f87171', whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {t.tipo === 'credito' ? '+' : '-'}R$ {Math.abs(t.valor).toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* ── Possíveis duplicatas ────────────────────────────── */}
                {transacoesDetectadas.filter(t => t.potencial_duplicata).length > 0 && (
                  <div style={{ background: 'rgba(249,115,22,.04)', border: '1px solid rgba(249,115,22,.25)', borderRadius: 10, padding: '10px', marginBottom: 10 }}>
                    <TipCard id="tip-duplicatas" icon="🔁" tips={tips} accent="#f97316"
                      text="Detectamos lançamentos que podem ser <strong>duplicados</strong> — mesmo valor, descrição e data próxima de um registro já existente ou de outro item neste lote. Revise e descarte os que forem repetição." />
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ fontSize: 10, color: '#f97316', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>
                        🔁 Possíveis duplicatas ({transacoesDetectadas.filter(t => t.potencial_duplicata).length})
                      </div>
                      <button
                        onClick={descartarDuplicatas}
                        style={{ fontSize: 10, padding: '3px 10px', background: 'rgba(249,115,22,.12)', border: '1px solid rgba(249,115,22,.3)', borderRadius: 6, color: '#f97316', cursor: 'pointer' }}
                      >
                        Descartar todas duplicatas
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 200, overflowY: 'auto' }}>
                      {transacoesDetectadas.map((t, i) => !t.potencial_duplicata ? null : (
                        <div key={i} style={{ background: 'rgba(0,0,0,.3)', border: '1px solid rgba(249,115,22,.2)', borderRadius: 8, padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button onClick={() => removerTransacao(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(249,115,22,.5)', fontSize: 13, flexShrink: 0, lineHeight: 1 }} title="Descartar">✕</button>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,.85)' }}>{t.descricao}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                              <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: 'rgba(249,115,22,.12)', color: '#f97316', border: '1px solid rgba(249,115,22,.25)' }}>
                                {t.duplicata_origem === 'historico' ? 'já lançado' : 'repete no lote'}
                              </span>
                              <span style={{ fontSize: 9, color: 'rgba(255,255,255,.3)' }}>{new Date(t.data_hora).toLocaleDateString('pt-BR')}</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: t.tipo === 'credito' ? '#4ade80' : '#f87171' }}>
                              {t.tipo === 'credito' ? '+' : '-'}R$ {Math.abs(t.valor).toFixed(2)}
                            </div>
                            <button onClick={() => desmarcarDuplicata(i)}
                              style={{ fontSize: 9, padding: '2px 7px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 5, color: 'rgba(255,255,255,.4)', cursor: 'pointer' }}>
                              Manter assim mesmo
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Transações não categorizadas ─────────────────────── */}
                {transacoesDetectadas.filter(t => t.nao_categorizado).length > 0 && (
                  <div style={{ background: 'rgba(251,191,36,.04)', border: '1px solid rgba(251,191,36,.2)', borderRadius: 10, padding: '10px', marginBottom: 10 }}>
                    <TipCard id="tip-sem-categoria" icon="🏷️" tips={tips} accent="#fbbf24"
                      text="Clique no <strong>select de categoria</strong> ao lado de cada item ou use <strong>&quot;Lançar todos como Outros&quot;</strong> para categorizar em lote. Você pode alterar depois." />
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ fontSize: 10, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>
                        ⚠ Sem categoria ({transacoesDetectadas.filter(t => t.nao_categorizado).length})
                      </div>
                      <button
                        onClick={categorizarNaoCategorizadosComoOutros}
                        style={{ fontSize: 10, padding: '3px 10px', background: 'rgba(251,191,36,.12)', border: '1px solid rgba(251,191,36,.3)', borderRadius: 6, color: '#fbbf24', cursor: 'pointer' }}
                      >
                        Lançar todos como &quot;Outros&quot;
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 200, overflowY: 'auto' }}>
                      {transacoesDetectadas.map((t, i) => !t.nao_categorizado ? null : (
                        <div key={i} style={{ background: 'rgba(0,0,0,.3)', border: '1px solid rgba(251,191,36,.15)', borderRadius: 8, padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button onClick={() => removerTransacao(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.25)', fontSize: 13, flexShrink: 0, lineHeight: 1 }}>✕</button>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <input value={t.descricao} onChange={e => editarTransacao(i, 'descricao', e.target.value)}
                              style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 12, fontWeight: 500, width: '100%', outline: 'none' }} />
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                              <select
                                value={t.categoria}
                                onChange={e => editarTransacao(i, 'categoria', e.target.value)}
                                style={{ fontSize: 11, padding: '2px 8px', background: '#0a0a0a', border: '1px solid rgba(251,191,36,.3)', borderRadius: 6, color: '#fbbf24', outline: 'none', cursor: 'pointer' }}>
                                {TODAS_CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                              {t.tipo_pagamento && (
                                <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 6, background: 'rgba(255,255,255,.05)', color: 'rgba(255,255,255,.35)', border: '1px solid rgba(255,255,255,.1)' }}>
                                  {t.tipo_pagamento}
                                </span>
                              )}
                              <span style={{ fontSize: 9, color: 'rgba(255,255,255,.3)' }}>{new Date(t.data_hora).toLocaleDateString('pt-BR')}</span>
                            </div>
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: t.tipo === 'credito' ? '#4ade80' : '#f87171', whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {t.tipo === 'credito' ? '+' : '-'}R$ {Math.abs(t.valor).toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Etapa de confirmação de conta ── */}
                {etapaConfirmacao ? (
                  <div style={{ marginTop: 4, background: '#0a1a0a', border: '1px solid #1a5a1a', borderRadius: 10, padding: '14px' }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>Confirmar conta destino</div>
                    {(() => {
                      const contaSel = contas.find(c => c.id === contaUpload)
                      return contaSel ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'rgba(74,222,128,.07)', border: '1px solid rgba(74,222,128,.2)', borderRadius: 8, marginBottom: 12 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: contaSel.bancos?.cor || '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                            {(contaSel.bancos?.nome_curto || contaSel.nome)[0]}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#4ade80' }}>{contaSel.bancos?.nome_curto || '—'} — {contaSel.nome}</div>
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', marginTop: 1 }}>{transacoesDetectadas.length} lançamento{transacoesDetectadas.length > 1 ? 's' : ''} serão vinculados a esta conta</div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'rgba(251,191,36,.06)', border: '1px solid rgba(251,191,36,.2)', borderRadius: 8, marginBottom: 12 }}>
                          <span style={{ fontSize: 18 }}>⚠️</span>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#fbbf24' }}>Sem conta vinculada</div>
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', marginTop: 1 }}>Os lançamentos não serão associados a nenhuma conta</div>
                          </div>
                        </div>
                      )
                    })()}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setEtapaConfirmacao(false)}
                        style={{ flex: 1, padding: '9px', background: 'transparent', border: '1px solid #1a3a1a', borderRadius: 8, color: 'rgba(255,255,255,.4)', fontSize: 12, cursor: 'pointer' }}>
                        ← Alterar conta
                      </button>
                      <button onClick={confirmarLancamentos} disabled={confirmando}
                        style={{ flex: 2, padding: '9px', background: '#16a34a', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: confirmando ? 'default' : 'pointer', opacity: confirmando ? 0.7 : 1 }}>
                        {confirmando ? 'Lançando...' : `✓ Confirmar ${transacoesDetectadas.length} lançamento${transacoesDetectadas.length > 1 ? 's' : ''}`}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button onClick={() => { setTransacoesDetectadas([]); setBancoDetectado(null); setContaUpload(''); setTipoDocumento(''); setEtapaConfirmacao(false); setContaInlineAberta(false) }}
                      style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid #1a3a1a', borderRadius: 8, color: 'rgba(255,255,255,.4)', fontSize: 13, cursor: 'pointer' }}>
                      Cancelar
                    </button>
                    <button
                      onClick={() => { if (!transacoesDetectadas.some(t => t.nao_categorizado)) setEtapaConfirmacao(true) }}
                      disabled={transacoesDetectadas.some(t => t.nao_categorizado)}
                      title={transacoesDetectadas.some(t => t.nao_categorizado) ? 'Categorize todos os itens antes de confirmar' : ''}
                      style={{ flex: 2, padding: '10px', background: transacoesDetectadas.some(t => t.nao_categorizado) ? '#374151' : '#16a34a', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: transacoesDetectadas.some(t => t.nao_categorizado) ? 'not-allowed' : 'pointer' }}>
                      {transacoesDetectadas.some(t => t.nao_categorizado)
                        ? `Categorize os ${transacoesDetectadas.filter(t => t.nao_categorizado).length} itens pendentes`
                        : `Avançar — ${transacoesDetectadas.length} lançamento${transacoesDetectadas.length > 1 ? 's' : ''}`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ─── Histórico ─── */}
        <div style={{ padding: '1.5rem', overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Lançamentos recentes</div>
            <button onClick={() => router.push('/dashboard/gastos')} style={{ fontSize: 11, color: '#4ade80', background: 'none', border: 'none', cursor: 'pointer' }}>ver todos →</button>
          </div>

          {/* Filtro por conta */}
          {contas.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0, color: 'rgba(255,255,255,.35)' }}>
                <path d="M1 3h11M3 6.5h7M5 10h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              <select
                value={filtroContaId}
                onChange={e => setFiltroContaId(e.target.value)}
                style={{ flex: 1, padding: '6px 10px', background: '#111', border: '1px solid #1a3a1a', borderRadius: 8, color: filtroContaId ? '#fff' : 'rgba(255,255,255,.4)', fontSize: 12, outline: 'none', cursor: 'pointer' }}
              >
                <option value="">Todas as contas</option>
                {contas.map(c => (
                  <option key={c.id} value={c.id}>{c.bancos?.nome_curto || '—'} · {c.nome}</option>
                ))}
                <option value="__sem_conta__">Sem conta vinculada</option>
              </select>
              {filtroContaId && (
                <button onClick={() => setFiltroContaId('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.3)', fontSize: 16, lineHeight: 1, padding: '0 4px' }}>×</button>
              )}
            </div>
          )}

          {/* Barra de ações em lote */}
          {selecionados.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '10px 14px', background: '#0a1a0a', border: '1px solid #1a5a1a', borderRadius: 10 }}>
              <span style={{ fontSize: 12, color: '#4ade80', fontWeight: 500 }}>{selecionados.length} selecionado{selecionados.length > 1 ? 's' : ''}</span>
              <div style={{ flex: 1 }} />
              <select value={contaDestino} onChange={e => setContaDestino(e.target.value)}
                style={{ padding: '5px 10px', background: '#111', border: '1px solid #1a3a1a', borderRadius: 6, color: '#fff', fontSize: 12, outline: 'none', cursor: 'pointer' }}>
                <option value="">Mover para conta...</option>
                {contas.map(c => <option key={c.id} value={c.id}>{c.bancos?.nome_curto || '—'} · {c.nome}</option>)}
              </select>
              <button onClick={moverParaConta} disabled={!contaDestino || movendo}
                style={{ padding: '5px 12px', background: 'rgba(74,222,128,.15)', border: '1px solid rgba(74,222,128,.3)', borderRadius: 6, color: '#4ade80', fontSize: 12, cursor: contaDestino ? 'pointer' : 'default', opacity: !contaDestino ? 0.4 : 1 }}>
                {movendo ? 'Movendo...' : 'Mover'}
              </button>
              <button onClick={excluirSelecionados} disabled={excluindoLote}
                style={{ padding: '5px 12px', background: 'rgba(239,68,68,.15)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 6, color: '#f87171', fontSize: 12, cursor: 'pointer' }}>
                {excluindoLote ? 'Excluindo...' : 'Excluir'}
              </button>
              <button onClick={() => setSelecionados([])}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.3)', fontSize: 18, lineHeight: 1 }}>×</button>
            </div>
          )}

          {historico.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'rgba(255,255,255,.3)', fontSize: 13 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
              Nenhum lançamento ainda.<br />Use o formulário ao lado para começar.
            </div>
          ) : (
            <>
              {/* Selecionar todos */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, paddingLeft: 4 }}>
                <input type="checkbox" checked={selecionados.length === historico.length && historico.length > 0}
                  onChange={toggleTodos}
                  style={{ cursor: 'pointer', accentColor: '#4ade80', width: 14, height: 14 }} />
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>Selecionar todos</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {historico.map(t => (
                  <div key={t.id} style={{
                    background: selecionados.includes(t.id) ? '#0d2a0d' : '#111',
                    border: `1px solid ${selecionados.includes(t.id) ? '#1a5a1a' : '#1a3a1a'}`,
                    borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, transition: 'all .15s',
                  }}>
                    {/* Checkbox */}
                    <input type="checkbox" checked={selecionados.includes(t.id)} onChange={() => toggleSelecionado(t.id)}
                      onClick={e => e.stopPropagation()}
                      style={{ cursor: 'pointer', accentColor: '#4ade80', width: 14, height: 14, flexShrink: 0 }} />

                    {/* Ícone categoria — clicável para editar */}
                    <div onClick={() => abrirEdicao(t)} style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: `${CORES[t.categoria] || '#6b7280'}18`, border: `1px solid ${CORES[t.categoria] || '#6b7280'}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: CORES[t.categoria] || '#6b7280' }} />
                    </div>

                    {/* Conteúdo — clicável para editar */}
                    <div onClick={() => abrirEdicao(t)} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.descricao}</span>
                        {t.origem === 'manual' && <span style={{ fontSize: 9, background: 'rgba(255,255,255,.07)', color: 'rgba(255,255,255,.35)', padding: '1px 5px', borderRadius: 3, flexShrink: 0 }}>manual</span>}
                        {t.origem === 'webhook' && <span style={{ fontSize: 9, background: 'rgba(74,222,128,.1)', color: '#4ade80', padding: '1px 5px', borderRadius: 3, flexShrink: 0 }}>auto</span>}
                      </div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', marginTop: 2 }}>{t.categoria} · {fmtDataHora(t.data_hora)}</div>
                    </div>

                    <div style={{ fontSize: 14, fontWeight: 600, color: t.tipo === 'credito' ? '#4ade80' : '#f87171', whiteSpace: 'nowrap' }}>
                      {t.tipo === 'credito' ? '+' : '-'}{fmtBRL(Math.abs(t.valor))}
                    </div>

                    {/* Lixeira */}
                    <button onClick={() => deletar(t.id)} disabled={deletando === t.id}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.2)', padding: 4, flexShrink: 0, opacity: deletando === t.id ? 0.4 : 1 }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,.2)')}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 4h10M5 4V3a1 1 0 011-1h2a1 1 0 011 1v1M6 7v3M8 7v3M3 4l1 7a1 1 0 001 1h4a1 1 0 001-1l1-7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ─── Modal edição ─── */}
      {modalAberto && transacaoEditando && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
          onClick={e => { if (e.target === e.currentTarget) setModalAberto(false) }}>
          <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 16, padding: '1.5rem', width: 400, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Editar lançamento</div>

            <div>
              <label style={{ display: 'block', fontSize: 10, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Descrição</label>
              <input value={editDescricao} onChange={e => setEditDescricao(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', background: '#0a0a0a', border: '1px solid #1a3a1a', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none' }} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 10, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Categoria</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {TODAS_CATEGORIAS.map(c => (
                  <button key={c} type="button" onClick={() => setEditCategoria(c)} style={{
                    padding: '4px 10px', borderRadius: 20, border: `1px solid ${editCategoria === c ? CORES[c] || '#4ade80' : '#1a3a1a'}`,
                    background: editCategoria === c ? `${CORES[c] || '#4ade80'}18` : 'transparent',
                    color: editCategoria === c ? CORES[c] || '#4ade80' : 'rgba(255,255,255,.4)',
                    fontSize: 11, cursor: 'pointer',
                  }}>{c}</button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 10, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Conta</label>
              <select value={editContaId} onChange={e => setEditContaId(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', background: '#0a0a0a', border: '1px solid #1a3a1a', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none', cursor: 'pointer' }}>
                <option value="">Sem conta específica</option>
                {contas.map(c => <option key={c.id} value={c.id}>{c.bancos?.nome_curto || '—'} · {c.nome}</option>)}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 10, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Data e hora</label>
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

      {/* ─── Modal nova conta ─── */}
      {modalNovaConta && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}
          onClick={e => { if (e.target === e.currentTarget) setModalNovaConta(false) }}>
          <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 16, padding: '1.5rem', width: 460, maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Cadastrar nova conta</div>
              <button onClick={() => setModalNovaConta(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.35)', fontSize: 20, lineHeight: 1 }}>×</button>
            </div>

            <form onSubmit={salvarNovaConta} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Busca banco */}
              <div>
                <label style={{ display: 'block', fontSize: 10, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Banco</label>
                <input
                  value={buscaBancoModal}
                  onChange={e => setBuscaBancoModal(e.target.value)}
                  placeholder="Buscar banco pelo nome ou código..."
                  style={{ width: '100%', padding: '9px 12px', background: '#0a0a0a', border: '1px solid #1a3a1a', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none', marginBottom: 8 }}
                />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
                  {bancosLista
                    .filter(b =>
                      !buscaBancoModal ||
                      b.nome_curto.toLowerCase().includes(buscaBancoModal.toLowerCase()) ||
                      b.codigo.includes(buscaBancoModal)
                    )
                    .slice(0, 20)
                    .map(b => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setFormNovaConta(p => ({ ...p, banco_id: b.id }))}
                        style={{
                          padding: '8px 6px', borderRadius: 8, cursor: 'pointer', fontSize: 10, fontWeight: 500, textAlign: 'center',
                          background: formNovaConta.banco_id === b.id ? `${b.cor || '#4ade80'}22` : 'rgba(255,255,255,.04)',
                          border: `1px solid ${formNovaConta.banco_id === b.id ? b.cor || '#4ade80' : '#1a3a1a'}`,
                          color: formNovaConta.banco_id === b.id ? b.cor || '#4ade80' : 'rgba(255,255,255,.6)',
                        }}
                      >
                        {b.nome_curto}
                      </button>
                    ))
                  }
                </div>
              </div>

              {/* Nome */}
              <div>
                <label style={{ display: 'block', fontSize: 10, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Nome da conta</label>
                <input
                  value={formNovaConta.nome}
                  onChange={e => setFormNovaConta(p => ({ ...p, nome: e.target.value }))}
                  placeholder="Ex: Conta corrente, Nubank pessoal..."
                  required
                  style={{ width: '100%', padding: '9px 12px', background: '#0a0a0a', border: '1px solid #1a3a1a', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none' }}
                />
              </div>

              {/* Tipo */}
              <div>
                <label style={{ display: 'block', fontSize: 10, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Tipo</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['corrente', 'poupança', 'crédito', 'investimento'].map(t => (
                    <button key={t} type="button" onClick={() => setFormNovaConta(p => ({ ...p, tipo: t }))} style={{
                      flex: 1, padding: '7px 4px', borderRadius: 8, border: `1px solid ${formNovaConta.tipo === t ? '#4ade80' : '#1a3a1a'}`,
                      background: formNovaConta.tipo === t ? 'rgba(74,222,128,.12)' : 'transparent',
                      color: formNovaConta.tipo === t ? '#4ade80' : 'rgba(255,255,255,.4)', fontSize: 11, cursor: 'pointer',
                    }}>{t}</button>
                  ))}
                </div>
              </div>

              {/* Saldo inicial */}
              <div>
                <label style={{ display: 'block', fontSize: 10, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Saldo inicial (opcional)</label>
                <input
                  type="number"
                  value={formNovaConta.saldo_inicial}
                  onChange={e => setFormNovaConta(p => ({ ...p, saldo_inicial: e.target.value }))}
                  placeholder="0,00"
                  step="0.01"
                  min="0"
                  style={{ width: '100%', padding: '9px 12px', background: '#0a0a0a', border: '1px solid #1a3a1a', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none' }}
                />
              </div>

              {erroNovaConta && (
                <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#f87171' }}>
                  {erroNovaConta}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => setModalNovaConta(false)}
                  style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid #1a3a1a', borderRadius: 8, color: 'rgba(255,255,255,.4)', fontSize: 13, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={salvandoConta}
                  style={{ flex: 2, padding: '10px', background: '#16a34a', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: salvandoConta ? 'default' : 'pointer', opacity: salvandoConta ? 0.7 : 1 }}>
                  {salvandoConta ? 'Salvando...' : 'Cadastrar conta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal banco não encontrado ─── */}
      {modalContaNaoEncontrada && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 16, padding: '1.5rem', width: 380, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Conta não encontrada</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', lineHeight: 1.6 }}>
              O banco <strong style={{ color: '#fff' }}>{bancoNaoEncontrado}</strong> foi detectado no extrato, mas você não tem nenhuma conta cadastrada com esse nome.
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)' }}>O que deseja fazer?</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={() => setModalContaNaoEncontrada(false)}
                style={{ padding: '10px', background: 'rgba(74,222,128,.1)', border: '1px solid rgba(74,222,128,.3)', borderRadius: 8, color: '#4ade80', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}>
                Continuar sem conta específica e escolher depois
              </button>
              <button onClick={() => { setModalContaNaoEncontrada(false); abrirModalNovaConta() }}
                style={{ padding: '10px', background: 'transparent', border: '1px solid #1a3a1a', borderRadius: 8, color: 'rgba(255,255,255,.5)', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}>
                Cadastrar nova conta agora
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}