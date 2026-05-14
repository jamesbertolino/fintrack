'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import PoupaUpLogo from '@/components/PoupaUpLogo'

type Passo   = 'carregando' | 1 | 2 | 3
type Objetivo = 'poupar' | 'quitar' | 'investir'

const OBJETIVOS: { id: Objetivo; emoji: string; titulo: string; descricao: string }[] = [
  { id: 'poupar',   emoji: '🏰', titulo: 'Guardar dinheiro',   descricao: 'Quero construir uma reserva e ter controle dos meus gastos' },
  { id: 'quitar',   emoji: '⚔️', titulo: 'Quitar dívidas',     descricao: 'Quero organizar e eliminar minhas dívidas de uma vez por todas' },
  { id: 'investir', emoji: '👑', titulo: 'Investir e crescer', descricao: 'Quero fazer meu dinheiro render e alcançar independência financeira' },
]


export default function SetupPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [passo, setPasso]               = useState<Passo>('carregando')
  const [objetivo, setObjetivo]         = useState<Objetivo | null>(null)
  const [nomeConta, setNomeConta]       = useState('Conta Principal')
  const [tipoConta, setTipoConta]       = useState<'corrente' | 'poupanca' | 'carteira'>('corrente')
  const [saldoInicial, setSaldoInicial] = useState('')
  const [txDesc, setTxDesc]             = useState('')
  const [txValor, setTxValor]           = useState('')
  const [txTipo, setTxTipo]             = useState<'debito' | 'credito'>('debito')
  const [txData, setTxData]             = useState(new Date().toISOString().slice(0, 10))
  const [salvando, setSalvando]         = useState(false)
  const [erro, setErro]                 = useState('')
  const [userId, setUserId]             = useState('')
  const [contaId, setContaId]           = useState('')

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('setup_completo, nome')
        .eq('id', user.id)
        .single()

      if (profile?.setup_completo) { router.push('/dashboard'); return }

      setPasso(1)
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function avancarPara2() {
    if (!objetivo) return
    // Salva objetivo no profile (ignora erro se coluna não existir)
    await supabase.from('profiles').update({ objetivo } as Record<string, string>).eq('id', userId).then(() => {})
    setPasso(2)
    setErro('')
  }

  async function criarConta() {
    if (!nomeConta.trim()) return
    setSalvando(true)
    setErro('')

    try {
      const res = await fetch('/api/contas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome:          nomeConta.trim(),
          tipo:          tipoConta,
          saldo_inicial: saldoInicial ? parseFloat(saldoInicial.replace(',', '.')) : 0,
          mostrar_saldo: true,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao criar conta')
      setContaId(data.conta?.id || '')
      setPasso(3)
      setErro('')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setSalvando(false)
    }
  }

  async function concluir(comTransacao = false) {
    setSalvando(true)
    setErro('')

    try {
      if (comTransacao && txDesc.trim() && txValor) {
        const val = parseFloat(txValor.replace(',', '.'))
        if (!isNaN(val) && val > 0) {
          await supabase.from('transactions').insert({
            user_id:     userId,
            conta_id:    contaId || null,
            descricao:   txDesc.trim(),
            valor:       txTipo === 'debito' ? -Math.abs(val) : Math.abs(val),
            data:        txData,
            categoria:   'Outros',
            tipo:        txTipo,
          })
        }
      }

      await supabase.from('profiles').update({ setup_completo: true }).eq('id', userId)
      router.push('/dashboard')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro desconhecido')
      setSalvando(false)
    }
  }

  // ── Estilos ────────────────────────────────────────────────────────────────
  const wrap: React.CSSProperties = {
    minHeight: '100vh', background: '#0a0a0a', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif',
    color: '#fff', padding: '1.5rem',
  }
  const card: React.CSSProperties = {
    width: '100%', maxWidth: 460, background: '#111',
    border: '1px solid #1a3a1a', borderRadius: 16, padding: '2rem',
  }
  const btnPrimary = (active: boolean): React.CSSProperties => ({
    width: '100%', padding: '12px', borderRadius: 10, border: 'none',
    background: active ? '#16a34a' : 'rgba(22,163,74,.2)',
    color: '#fff', fontSize: 14, fontWeight: 600,
    cursor: active ? 'pointer' : 'default', opacity: active ? 1 : 0.5,
    transition: 'all .2s',
  })
  const btnSecondary: React.CSSProperties = {
    width: '100%', padding: '11px', borderRadius: 10,
    border: '1px solid rgba(255,255,255,.1)', background: 'transparent',
    color: 'rgba(255,255,255,.45)', fontSize: 13, cursor: 'pointer',
  }
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', background: '#0a1a0a',
    border: '1px solid #1a3a1a', borderRadius: 8, color: '#fff',
    fontSize: 14, outline: 'none', boxSizing: 'border-box',
  }
  const label: React.CSSProperties = {
    display: 'block', fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,.4)',
    marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em',
  }

  // ── Carregando ─────────────────────────────────────────────────────────────
  if (passo === 'carregando') {
    return (
      <div style={wrap}>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,.3)' }}>Carregando...</div>
      </div>
    )
  }

  const totalPassos = 3
  const passoNum = passo as number

  return (
    <div style={wrap}>
      <div style={{ marginBottom: '1.75rem' }}>
        <PoupaUpLogo mode="compact" />
      </div>

      {/* Barra de progresso */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: '2rem' }}>
        {Array.from({ length: totalPassos }).map((_, i) => {
          const n = i + 1
          const done    = passoNum > n
          const active  = passoNum === n
          return (
            <div key={n} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700,
                background: done ? '#16a34a' : active ? '#0f5132' : 'rgba(255,255,255,.07)',
                color: done || active ? '#fff' : 'rgba(255,255,255,.3)',
                border: `2px solid ${done ? '#4ade80' : active ? '#16a34a' : 'rgba(255,255,255,.1)'}`,
                transition: 'all .3s',
              }}>
                {done ? '✓' : n}
              </div>
              {i < totalPassos - 1 && (
                <div style={{ width: 52, height: 2, background: done ? '#16a34a' : 'rgba(255,255,255,.08)', transition: 'background .3s' }} />
              )}
            </div>
          )
        })}
      </div>

      <div style={card}>

        {/* ── PASSO 1: Objetivo financeiro ──────────────────────────────────── */}
        {passo === 1 && (
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Qual é seu objetivo?</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              Isso nos ajuda a personalizar sua experiência no PoupaUp.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: '1.5rem' }}>
              {OBJETIVOS.map(obj => {
                const sel = objetivo === obj.id
                return (
                  <button
                    key={obj.id}
                    onClick={() => setObjetivo(obj.id)}
                    style={{
                      background: sel ? 'rgba(22,163,74,.12)' : 'rgba(255,255,255,.03)',
                      border: `1.5px solid ${sel ? '#16a34a' : 'rgba(255,255,255,.1)'}`,
                      borderRadius: 12, padding: '14px 16px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left',
                      transition: 'all .2s',
                    }}
                  >
                    <div style={{ fontSize: 28, flexShrink: 0 }}>{obj.emoji}</div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: sel ? '#4ade80' : '#fff', marginBottom: 2 }}>{obj.titulo}</div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', lineHeight: 1.4 }}>{obj.descricao}</div>
                    </div>
                    {sel && <div style={{ marginLeft: 'auto', fontSize: 18, color: '#4ade80', flexShrink: 0 }}>✓</div>}
                  </button>
                )
              })}
            </div>

            <button onClick={avancarPara2} disabled={!objetivo} style={btnPrimary(!!objetivo)}>
              Continuar →
            </button>
          </div>
        )}

        {/* ── PASSO 2: Conta bancária ──────────────────────────────────────── */}
        {passo === 2 && (
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Sua primeira conta</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              Configure sua conta principal para começar a registrar seus lançamentos.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <span style={label}>Nome da conta</span>
                <input
                  value={nomeConta}
                  onChange={e => setNomeConta(e.target.value)}
                  placeholder="Ex.: Nubank, Bradesco, Carteira"
                  style={inputStyle}
                />
              </div>

              <div>
                <span style={label}>Tipo de conta</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['corrente', 'poupanca', 'carteira'] as const).map(t => {
                    const labels = { corrente: 'Corrente', poupanca: 'Poupança', carteira: 'Carteira' }
                    const sel = tipoConta === t
                    return (
                      <button
                        key={t}
                        onClick={() => setTipoConta(t)}
                        style={{
                          flex: 1, padding: '8px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                          cursor: 'pointer', transition: 'all .2s',
                          background: sel ? 'rgba(22,163,74,.15)' : 'transparent',
                          border: `1px solid ${sel ? '#16a34a' : 'rgba(255,255,255,.12)'}`,
                          color: sel ? '#4ade80' : 'rgba(255,255,255,.5)',
                        }}
                      >
                        {labels[t]}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <span style={label}>Saldo atual (opcional)</span>
                <input
                  value={saldoInicial}
                  onChange={e => setSaldoInicial(e.target.value)}
                  placeholder="0,00"
                  inputMode="decimal"
                  style={inputStyle}
                />
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,.25)', marginTop: 4 }}>
                  Informe quanto você tem nessa conta hoje
                </div>
              </div>
            </div>

            {erro && (
              <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#f87171', marginBottom: 14 }}>
                {erro}
              </div>
            )}

            <button onClick={criarConta} disabled={salvando || !nomeConta.trim()} style={btnPrimary(!salvando && !!nomeConta.trim())}>
              {salvando ? 'Criando...' : 'Continuar →'}
            </button>
            <button style={{ ...btnSecondary, marginTop: 10 }} onClick={() => { setPasso(1); setErro('') }}>
              ← Voltar
            </button>
          </div>
        )}

        {/* ── PASSO 3: Primeiro lançamento ─────────────────────────────────── */}
        {passo === 3 && (
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Primeiro lançamento</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              Registre uma transação recente para começar. Você pode pular e fazer depois.
            </div>

            {/* Toggle débito/crédito */}
            <div style={{ display: 'flex', gap: 0, marginBottom: '1rem', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, overflow: 'hidden' }}>
              {(['debito', 'credito'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTxTipo(t)}
                  style={{
                    flex: 1, padding: '9px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all .2s',
                    background: txTipo === t ? (t === 'debito' ? 'rgba(239,68,68,.2)' : 'rgba(22,163,74,.2)') : 'transparent',
                    color: txTipo === t ? (t === 'debito' ? '#f87171' : '#4ade80') : 'rgba(255,255,255,.35)',
                  }}
                >
                  {t === 'debito' ? '↓ Despesa' : '↑ Receita'}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <span style={label}>Descrição</span>
                <input
                  value={txDesc}
                  onChange={e => setTxDesc(e.target.value)}
                  placeholder="Ex.: Aluguel, Salário, Supermercado"
                  style={inputStyle}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <span style={label}>Valor (R$)</span>
                  <input
                    value={txValor}
                    onChange={e => setTxValor(e.target.value)}
                    placeholder="0,00"
                    inputMode="decimal"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <span style={label}>Data</span>
                  <input
                    type="date"
                    value={txData}
                    onChange={e => setTxData(e.target.value)}
                    style={{ ...inputStyle, colorScheme: 'dark' }}
                  />
                </div>
              </div>
            </div>

            {erro && (
              <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#f87171', marginBottom: 14 }}>
                {erro}
              </div>
            )}

            <button
              onClick={() => concluir(true)}
              disabled={salvando || !txDesc.trim() || !txValor}
              style={btnPrimary(!salvando && !!txDesc.trim() && !!txValor)}
            >
              {salvando ? 'Salvando...' : 'Salvar e ir para o dashboard →'}
            </button>
            <button style={{ ...btnSecondary, marginTop: 10 }} onClick={() => concluir(false)} disabled={salvando}>
              Pular — configurar depois
            </button>
          </div>
        )}

      </div>

      {/* Rodapé discreto */}
      <div style={{ marginTop: '1.5rem', fontSize: 11, color: 'rgba(255,255,255,.2)', textAlign: 'center' }}>
        Você pode alterar tudo isso depois em Configurações
      </div>
    </div>
  )
}
