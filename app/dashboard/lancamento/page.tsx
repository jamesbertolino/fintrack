'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
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

interface TransacaoDetectada {
  descricao: string
  valor: number
  tipo: string
  categoria: string
  data_hora: string
  nao_categorizado?: boolean
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
  const [confirmando, setConfirman] = useState(false)
  const [transacoesDetectadas, setTransacoesDetectadas] = useState<TransacaoDetectada[]>([])
  const [resumoDetectado, setResumo] = useState('')
  const [tipoDocumento, setTipoDocumento] = useState('')
  const [bancoDetectado, setBancoDetectado] = useState<{ id: string; nome_curto: string; cor: string | null } | null>(null)
  const [contaUpload, setContaUpload] = useState('')
  // Controle de edição inline de categoria (índice do item em edição)
  const [editandoCategoriaIdx, setEditandoCategoriaIdx] = useState<number | null>(null)

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
      descricao: descricao.trim(),
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
    const form = new FormData()
    form.append('arquivo', arquivo)
    const res = await fetch('/api/lancamento/upload', { method: 'POST', body: form })
    const data = await res.json()
    setProcessan(false)
    if (!data.ok || !data.transacoes?.length) {
      setErro(data.error || 'Não foi possível extrair transações do documento')
      return
    }
    setTransacoesDetectadas(data.transacoes)
    setResumo(data.resumo || `${data.transacoes.length} transações encontradas`)
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
    await Promise.all(selecionados.map(id => supabase.from('transactions').delete().eq('id', id)))
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
        descricao: editDescricao,
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
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>📎 Importar documento</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', marginBottom: 12 }}>Extrato bancário, fatura de cartão, holerite, nota fiscal, cupom, recibo — PDF, imagem ou CSV</div>
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files[0]) }}
              style={{ border: `2px dashed ${dragOver ? '#4ade80' : '#1a3a1a'}`, borderRadius: 12, padding: '1.5rem', textAlign: 'center', cursor: 'pointer', background: dragOver ? 'rgba(74,222,128,.05)' : 'transparent', transition: 'all .2s' }}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,.5)' }}>Clique ou arraste o arquivo aqui</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', marginTop: 4 }}>PDF · JPG · PNG · WEBP · CSV — máx 15MB</div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                {['Extrato', 'Fatura', 'Holerite', 'Nota fiscal', 'Cupom', 'Recibo'].map(t => (
                  <span key={t} style={{ fontSize: 9, padding: '2px 7px', borderRadius: 10, background: 'rgba(74,222,128,.08)', border: '1px solid rgba(74,222,128,.15)', color: 'rgba(74,222,128,.7)' }}>{t}</span>
                ))}
              </div>
              <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.csv" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) { handleUpload(e.target.files[0]); e.target.value = '' } }} />
            </div>

            {processando && (
              <div style={{ marginTop: 12, padding: '12px', background: '#111', border: '1px solid #1a3a1a', borderRadius: 8, fontSize: 12, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ animation: 'spin 1s linear infinite' }}>⏳</div>
                Analisando documento com IA...
                <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
              </div>
            )}

            {transacoesDetectadas.length > 0 && !processando && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8, color: '#4ade80' }}>✅ {resumoDetectado} — Revise antes de confirmar:</div>

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
                  <select
                    value={contaUpload}
                    onChange={e => { if (e.target.value === '__nova__') abrirModalNovaConta(); else setContaUpload(e.target.value) }}
                    style={{ width: '100%', padding: '9px 12px', background: '#111', border: '1px solid #1a3a1a', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="">Sem conta específica</option>
                    {contas.filter(c => !bancoDetectado || c.bancos?.id === bancoDetectado.id).map(c => (
                      <option key={c.id} value={c.id}>{c.bancos?.nome_curto || '—'} — {c.nome}</option>
                    ))}
                    <option value="__nova__">＋ Cadastrar nova conta</option>
                  </select>
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

                {/* ── Transações não categorizadas ─────────────────────── */}
                {transacoesDetectadas.filter(t => t.nao_categorizado).length > 0 && (
                  <div style={{ background: 'rgba(251,191,36,.04)', border: '1px solid rgba(251,191,36,.2)', borderRadius: 10, padding: '10px', marginBottom: 10 }}>
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

                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button onClick={() => { setTransacoesDetectadas([]); setBancoDetectado(null); setContaUpload(''); setTipoDocumento('') }}
                    style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid #1a3a1a', borderRadius: 8, color: 'rgba(255,255,255,.4)', fontSize: 13, cursor: 'pointer' }}>
                    Cancelar
                  </button>
                  <button onClick={confirmarLancamentos} disabled={confirmando || transacoesDetectadas.some(t => t.nao_categorizado)}
                    title={transacoesDetectadas.some(t => t.nao_categorizado) ? 'Categorize todos os itens antes de confirmar' : ''}
                    style={{ flex: 2, padding: '10px', background: transacoesDetectadas.some(t => t.nao_categorizado) ? '#374151' : '#16a34a', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: (confirmando || transacoesDetectadas.some(t => t.nao_categorizado)) ? 'not-allowed' : 'pointer', opacity: confirmando ? 0.7 : 1 }}>
                    {confirmando ? 'Lançando...' : transacoesDetectadas.some(t => t.nao_categorizado) ? `Categorize os ${transacoesDetectadas.filter(t => t.nao_categorizado).length} itens pendentes` : `Confirmar ${transacoesDetectadas.length} lançamento${transacoesDetectadas.length > 1 ? 's' : ''}`}
                  </button>
                </div>
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