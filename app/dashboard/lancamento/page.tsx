'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

interface Transacao {
  id: string
  descricao: string
  valor: number
  tipo: 'debito' | 'credito'
  categoria: string
  data_hora: string
  origem: string
}

const CATEGORIAS_DESPESA = ['Alimentação','Transporte','Lazer','Saúde','Moradia','Educação','Outros']
const CATEGORIAS_RECEITA = ['Salário','Freelance','Investimento','Presente','Outros']

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

function fmtData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function LancamentoPage() {
  const router = useRouter()
  const supabase = createClient()

  const [tipo, setTipo]             = useState<'debito' | 'credito'>('debito')
  const [valor, setValor]           = useState('')
  const [descricao, setDescricao]   = useState('')
  const [categoria, setCategoria]   = useState('Alimentação')
  const [dataHora, setDataHora]     = useState(() => new Date().toISOString().slice(0, 16))
  const [recorrente, setRecorrente] = useState(false)
  const [salvando, setSalvando]     = useState(false)
  const [erro, setErro]             = useState('')
  const [sucesso, setSucesso]       = useState(false)
  const [historico, setHistorico]   = useState<Transacao[]>([])
  const [deletando, setDeletando]   = useState<string | null>(null)

  // useCallback declarado ANTES do useEffect que o chama
  const carregarHistorico = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('data_hora', { ascending: false })
      .limit(15)

    if (data) setHistorico(data)
  }, [supabase, router])

  useEffect(() => {
    carregarHistorico()
  }, [carregarHistorico])

  // Trocar tipo e categoria juntos — sem useEffect
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
      data_hora: new Date(dataHora).toISOString(),
      origem: 'manual',
    })

    if (error) { setErro('Erro ao salvar: ' + error.message); setSalvando(false); return }

    setSalvando(false)
    setSucesso(true)
    setValor('')
    setDescricao('')
    setDataHora(new Date().toISOString().slice(0, 16))
    carregarHistorico()
    setTimeout(() => setSucesso(false), 2500)
  }

  async function deletar(id: string) {
    setDeletando(id)
    await supabase.from('transactions').delete().eq('id', id)
    setDeletando(null)
    carregarHistorico()
  }

  const categorias = tipo === 'debito' ? CATEGORIAS_DESPESA : CATEGORIAS_RECEITA

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: 'system-ui, sans-serif', fontSize: 13, color: '#fff' }}>

      <div style={{ display: 'flex', alignItems: 'center', padding: '.875rem 1.5rem', borderBottom: '1px solid #1a3a1a', background: '#0a1a0a', gap: 12 }}>
        <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.4)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Dashboard
        </button>
        <span style={{ color: 'rgba(255,255,255,.2)' }}>/</span>
        <span style={{ fontSize: 15, fontWeight: 500 }}>Lançamento</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', minHeight: 'calc(100vh - 53px)' }}>

        {/* Formulário */}
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
        </div>

        {/* Histórico */}
        <div style={{ padding: '1.5rem', overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Lançamentos recentes</div>
            <button onClick={() => router.push('/dashboard/gastos')} style={{ fontSize: 11, color: '#4ade80', background: 'none', border: 'none', cursor: 'pointer' }}>ver todos →</button>
          </div>

          {historico.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'rgba(255,255,255,.3)', fontSize: 13 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
              Nenhum lançamento ainda.<br />Use o formulário ao lado para começar.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {historico.map(t => (
                <div key={t.id} style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#1a5a1a')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#1a3a1a')}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: `${CORES[t.categoria] || '#6b7280'}18`, border: `1px solid ${CORES[t.categoria] || '#6b7280'}33`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: CORES[t.categoria] || '#6b7280' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.descricao}</span>
                      {t.origem === 'manual' && <span style={{ fontSize: 9, background: 'rgba(255,255,255,.07)', color: 'rgba(255,255,255,.35)', padding: '1px 5px', borderRadius: 3, flexShrink: 0 }}>manual</span>}
                      {t.origem === 'webhook' && <span style={{ fontSize: 9, background: 'rgba(74,222,128,.1)', color: '#4ade80', padding: '1px 5px', borderRadius: 3, flexShrink: 0 }}>auto</span>}
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', marginTop: 2 }}>{t.categoria} · {fmtData(t.data_hora)}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: t.tipo === 'credito' ? '#4ade80' : '#f87171', whiteSpace: 'nowrap' }}>
                    {t.tipo === 'credito' ? '+' : '-'}{fmtBRL(Math.abs(t.valor))}
                  </div>
                  <button onClick={() => deletar(t.id)} disabled={deletando === t.id} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.2)', padding: 4, flexShrink: 0, opacity: deletando === t.id ? 0.4 : 1 }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,.2)')}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 4h10M5 4V3a1 1 0 011-1h2a1 1 0 011 1v1M6 7v3M8 7v3M3 4l1 7a1 1 0 001 1h4a1 1 0 001-1l1-7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}