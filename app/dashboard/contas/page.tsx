'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Banco {
  id: string
  codigo: string
  nome: string
  nome_curto: string
  cor: string | null
  logo_url: string | null
}

interface Conta {
  id: string
  nome: string
  tipo: string
  numero: string | null
  agencia: string | null
  mostrar_saldo: boolean
  saldo: number
  bancos: Banco | null
}

const TIPOS = ['corrente', 'poupança', 'crédito', 'investimento']

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function corBanco(banco: Banco | null) {
  return banco?.cor || '#4ade80'
}

function inicialBanco(banco: Banco | null) {
  return (banco?.nome_curto || 'B')[0].toUpperCase()
}

export default function ContasPage() {
  const router = useRouter()

  const [contas, setContas]       = useState<Conta[]>([])
  const [bancos, setBancos]       = useState<Banco[]>([])
  const [loading, setLoading]     = useState(true)
  const [modalAberto, setModal]   = useState(false)
  const [salvando, setSalvando]   = useState(false)
  const [erro, setErro]           = useState('')
  const [sucesso, setSucesso]     = useState('')
  const [buscaBanco, setBusca]    = useState('')
  const [ocultarSaldos, setOcult] = useState(false)

  const [form, setForm] = useState({
    banco_id:      '',
    nome:          '',
    tipo:          'corrente',
    numero:        '',
    agencia:       '',
    mostrar_saldo: true,
  })

  const carregar = useCallback(async () => {
    const [resContas, resBancos] = await Promise.all([
      fetch('/api/contas'),
      fetch('/api/bancos'),
    ])
    const dContas = await resContas.json()
    const dBancos = await resBancos.json()
    setContas(dContas.contas || [])
    setBancos(dBancos.bancos || [])
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const totalSaldo = contas.reduce((acc, c) => acc + (c.saldo || 0), 0)

  const bancosFiltrados = bancos.filter(b =>
    b.nome_curto.toLowerCase().includes(buscaBanco.toLowerCase()) ||
    b.codigo.includes(buscaBanco)
  )

  async function salvarConta(e: React.FormEvent) {
    e.preventDefault()
    if (!form.banco_id) { setErro('Selecione um banco'); return }
    if (!form.nome.trim()) { setErro('Nome da conta obrigatório'); return }
    setSalvando(true); setErro('')

    const res = await fetch('/api/contas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setSalvando(false)

    if (!data.ok) { setErro(data.error || 'Erro ao salvar'); return }

    setModal(false)
    setForm({ banco_id: '', nome: '', tipo: 'corrente', numero: '', agencia: '', mostrar_saldo: true })
    setBusca('')
    setSucesso('Conta adicionada!')
    carregar()
    setTimeout(() => setSucesso(''), 3000)
  }

  async function excluirConta(id: string) {
    if (!confirm('Excluir esta conta?')) return
    await fetch(`/api/contas/${id}`, { method: 'DELETE' })
    carregar()
  }

  async function toggleSaldoVisivel(id: string, atual: boolean) {
    await fetch(`/api/contas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mostrar_saldo: !atual }),
    })
    setContas(prev => prev.map(c => c.id === id ? { ...c, mostrar_saldo: !atual } : c))
  }

  const inputStyle = {
    width: '100%', padding: '9px 12px', background: '#0a1a0a',
    border: '1px solid #1a3a1a', borderRadius: 8, color: '#fff',
    fontSize: 13, outline: 'none',
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', fontFamily: 'system-ui' }}>Carregando contas...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: 'system-ui, sans-serif', fontSize: 13, color: '#fff' }}>

      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '.875rem 1.5rem', borderBottom: '1px solid #1a3a1a', background: '#0a1a0a' }}>
        <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.4)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Dashboard
        </button>
        <span style={{ color: 'rgba(255,255,255,.2)' }}>/</span>
        <span style={{ fontSize: 15, fontWeight: 500 }}>Contas</span>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setModal(true)}
          style={{ padding: '8px 16px', background: '#16a34a', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
        >
          + Nova conta
        </button>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '1.5rem' }}>

        {/* Total consolidado */}
        <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 14, padding: '1.25rem 1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Saldo total consolidado</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: totalSaldo >= 0 ? '#4ade80' : '#f87171' }}>
              {ocultarSaldos ? '••••••' : fmtBRL(totalSaldo)}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', marginTop: 2 }}>{contas.length} conta{contas.length !== 1 ? 's' : ''}</div>
          </div>
          <button
            onClick={() => setOcult(!ocultarSaldos)}
            style={{ background: 'rgba(255,255,255,.06)', border: '1px solid #1a3a1a', borderRadius: 8, padding: '8px 12px', color: 'rgba(255,255,255,.5)', fontSize: 12, cursor: 'pointer' }}
          >
            {ocultarSaldos ? '👁 Mostrar' : '🙈 Ocultar'}
          </button>
        </div>

        {/* Feedback */}
        {sucesso && <div style={{ background: 'rgba(74,222,128,.1)', border: '1px solid rgba(74,222,128,.3)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#4ade80', marginBottom: 12 }}>{sucesso}</div>}
        {erro && <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#f87171', marginBottom: 12 }}>{erro}</div>}

        {/* Lista de contas */}
        {contas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'rgba(255,255,255,.3)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🏦</div>
            <div style={{ fontSize: 14, marginBottom: 8 }}>Nenhuma conta cadastrada</div>
            <div style={{ fontSize: 12 }}>Adicione suas contas bancárias para controlar seus saldos.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {contas.map(conta => {
              const banco = conta.bancos
              const cor = corBanco(banco)
              const saldoVisivel = conta.mostrar_saldo && !ocultarSaldos
              return (
                <div key={conta.id} style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 12, padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: 14 }}>
                  {/* Ícone banco */}
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: `${cor}22`, border: `1.5px solid ${cor}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18, fontWeight: 700, color: cor }}>
                    {banco?.logo_url
                      ? <img src={banco.logo_url} alt={banco.nome_curto} style={{ width: 28, height: 28, objectFit: 'contain' }} />
                      : inicialBanco(banco)
                    }
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{banco?.nome_curto || '—'}</span>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>·</span>
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,.7)' }}>{conta.nome}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 10, background: 'rgba(255,255,255,.07)', color: 'rgba(255,255,255,.4)', padding: '2px 7px', borderRadius: 6, textTransform: 'capitalize' }}>{conta.tipo}</span>
                      {conta.numero && <span style={{ fontSize: 10, color: 'rgba(255,255,255,.3)' }}>···· {conta.numero}</span>}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', marginRight: 8 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: conta.saldo >= 0 ? '#4ade80' : '#f87171' }}>
                      {saldoVisivel ? fmtBRL(conta.saldo) : '••••'}
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', marginTop: 2 }}>saldo</div>
                  </div>

                  {/* Ações */}
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => toggleSaldoVisivel(conta.id, conta.mostrar_saldo)}
                      title={conta.mostrar_saldo ? 'Ocultar saldo' : 'Mostrar saldo'}
                      style={{ background: 'rgba(255,255,255,.06)', border: '1px solid #1a3a1a', borderRadius: 6, padding: '5px 8px', color: 'rgba(255,255,255,.4)', fontSize: 12, cursor: 'pointer' }}
                    >
                      {conta.mostrar_saldo ? '👁' : '🙈'}
                    </button>
                    <button
                      onClick={() => excluirConta(conta.id)}
                      style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 6, padding: '5px 8px', color: '#f87171', fontSize: 12, cursor: 'pointer' }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal nova conta */}
      {modalAberto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 16, padding: '1.5rem', width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>Nova conta</div>
              <button onClick={() => { setModal(false); setErro('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.4)', fontSize: 18 }}>✕</button>
            </div>

            {erro && <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#f87171', marginBottom: 12 }}>{erro}</div>}

            <form onSubmit={salvarConta}>
              {/* Busca banco */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,.4)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' }}>Banco</label>
                <input
                  value={buscaBanco}
                  onChange={e => setBusca(e.target.value)}
                  placeholder="Buscar banco pelo nome ou código..."
                  style={inputStyle}
                />
                {buscaBanco && (
                  <div style={{ background: '#0a1a0a', border: '1px solid #1a3a1a', borderRadius: 8, marginTop: 4, maxHeight: 180, overflowY: 'auto' }}>
                    {bancosFiltrados.slice(0, 8).map(b => (
                      <div
                        key={b.id}
                        onClick={() => { setForm(p => ({ ...p, banco_id: b.id })); setBusca(b.nome_curto) }}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer', background: form.banco_id === b.id ? 'rgba(74,222,128,.08)' : 'transparent' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.04)')}
                        onMouseLeave={e => (e.currentTarget.style.background = form.banco_id === b.id ? 'rgba(74,222,128,.08)' : 'transparent')}
                      >
                        <div style={{ width: 24, height: 24, borderRadius: 6, background: `${b.cor || '#4ade80'}22`, border: `1px solid ${b.cor || '#4ade80'}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: b.cor || '#4ade80', flexShrink: 0 }}>
                          {b.nome_curto[0]}
                        </div>
                        <span style={{ fontSize: 13 }}>{b.nome_curto}</span>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', marginLeft: 'auto' }}>{b.codigo}</span>
                      </div>
                    ))}
                    {bancosFiltrados.length === 0 && <div style={{ padding: '10px 12px', fontSize: 12, color: 'rgba(255,255,255,.3)' }}>Nenhum banco encontrado</div>}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,.4)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' }}>Nome da conta</label>
                <input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Conta corrente, Nubank, Poupança..." required style={inputStyle} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,.4)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' }}>Tipo</label>
                  <select value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                    {TIPOS.map(t => <option key={t} value={t} style={{ textTransform: 'capitalize' }}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,.4)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' }}>Últimos 4 dígitos</label>
                  <input value={form.numero} onChange={e => setForm(p => ({ ...p, numero: e.target.value.slice(0, 4) }))} placeholder="1234" maxLength={4} style={inputStyle} />
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,.4)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' }}>Agência (opcional)</label>
                <input value={form.agencia} onChange={e => setForm(p => ({ ...p, agencia: e.target.value }))} placeholder="Ex: 0001" style={inputStyle} />
              </div>

              <div
                onClick={() => setForm(p => ({ ...p, mostrar_saldo: !p.mostrar_saldo }))}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#0a1a0a', border: '1px solid #1a3a1a', borderRadius: 8, cursor: 'pointer', marginBottom: '1.25rem' }}
              >
                <div style={{ width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${form.mostrar_saldo ? '#16a34a' : '#1a3a1a'}`, background: form.mostrar_saldo ? '#16a34a' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .15s' }}>
                  {form.mostrar_saldo && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><polyline points="1.5,5 4,7.5 8.5,2" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>Mostrar saldo</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)' }}>Exibir o saldo desta conta no painel</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => { setModal(false); setErro('') }} style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid #1a3a1a', borderRadius: 8, color: 'rgba(255,255,255,.4)', fontSize: 13, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={salvando} style={{ flex: 2, padding: '10px', background: '#16a34a', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: salvando ? 'default' : 'pointer', opacity: salvando ? 0.7 : 1 }}>
                  {salvando ? 'Salvando...' : 'Adicionar conta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
