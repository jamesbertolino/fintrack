'use client'

import { useEffect, useMemo, useState } from 'react'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useRouter } from 'next/navigation'
import PoupaUpLogo from '@/components/PoupaUpLogo'
import { useCores, useTema } from '@/components/ThemeProvider'
import { SkeletonDividas } from '@/components/Skeleton'

interface Divida {
  id: string
  nome: string
  saldo: number
  taxa_juros: number       // % mensal (ex: 0.0299)
  pagamento_minimo: number
}

type Metodo = 'neve' | 'avalanche'

interface MesSimulado {
  mes: number
  saldos: Record<string, number>
  juros:  Record<string, number>
  pago:   Record<string, number>
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function pct(v: number) {
  return (v * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'
}

/** Simula o plano de pagamento. Retorna meses até quitação e total de juros. */
function simular(dividas: Divida[], extra: number, metodo: Metodo) {
  if (!dividas.length) return { meses: [], totalJuros: 0, totalPago: 0, mesesTotal: 0, impagavel: false }

  // Detecta cenário impagável: pagamentos mensais não cobrem os juros do primeiro mês
  const totalPagamentoMensal = dividas.reduce((s, d) => s + d.pagamento_minimo, 0) + extra
  const totalJurosPrimeiro   = dividas.reduce((s, d) => s + d.saldo * d.taxa_juros, 0)
  if (totalPagamentoMensal <= totalJurosPrimeiro && totalJurosPrimeiro > 0) {
    return { meses: [], totalJuros: 0, totalPago: 0, mesesTotal: 0, impagavel: true }
  }

  // Ordena por estratégia
  const ordem = metodo === 'neve'
    ? [...dividas].sort((a, b) => a.saldo - b.saldo)
    : [...dividas].sort((a, b) => b.taxa_juros - a.taxa_juros)

  // Estado mutável
  const saldos: Record<string, number> = {}
  dividas.forEach(d => { saldos[d.id] = d.saldo })

  const meses: MesSimulado[] = []
  let totalJuros = 0
  let totalPago  = 0

  for (let mes = 1; mes <= 600; mes++) {
    const ativas = dividas.filter(d => saldos[d.id] > 0.005)
    if (!ativas.length) break

    const juros: Record<string, number> = {}
    const pago:  Record<string, number> = {}

    // Aplica juros
    ativas.forEach(d => {
      const j = saldos[d.id] * d.taxa_juros
      saldos[d.id] += j
      juros[d.id]   = j
      totalJuros   += j
    })

    // Pagamentos mínimos
    let dispExtra = extra
    ativas.forEach(d => {
      const pg = Math.min(saldos[d.id], d.pagamento_minimo)
      saldos[d.id] -= pg
      pago[d.id]    = pg
      totalPago    += pg
    })

    // Pagamento extra na primeira dívida prioritária ainda ativa
    const alvo = ordem.find(d => saldos[d.id] > 0.005)
    if (alvo && dispExtra > 0) {
      const pg = Math.min(saldos[alvo.id], dispExtra)
      saldos[alvo.id] -= pg
      pago[alvo.id]    = (pago[alvo.id] || 0) + pg
      totalPago       += pg
      dispExtra       -= pg
    }

    meses.push({ mes, saldos: { ...saldos }, juros, pago })
    if (ativas.every(d => saldos[d.id] <= 0.005)) break
  }

  return { meses, totalJuros, totalPago, mesesTotal: meses.length, impagavel: false }
}

export default function DividasPage() {
  const router = useRouter()
  const cores  = useCores()
  const { tema } = useTema()
  const m = tema === 'medieval'

  const [dividas,   setDividas]   = useState<Divida[]>([])
  const [loading,   setLoading]   = useState(true)
  const [metodo,    setMetodo]    = useState<Metodo>('neve')
  const [extra,     setExtra]     = useState(0)
  const [form,      setForm]      = useState({ nome: '', saldo: '', taxa: '', minimo: '' })
  const isMobile = useIsMobile(640)
  const [adicionando, setAdd]     = useState(false)
  const [salvando,  setSalvando]  = useState(false)
  const [erro,      setErro]      = useState('')
  const [tabAberta, setTabAberta]     = useState<string | null>(null)
  const [confirmRemover, setConfirmRem] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/dividas')
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(d => setDividas(d.dividas || []))
      .catch(() => setErro('Erro ao carregar dívidas'))
      .finally(() => setLoading(false))
  }, [])

  async function adicionarDivida() {
    const saldo = parseFloat(form.saldo.replace(',', '.'))
    const taxa  = parseFloat(form.taxa.replace(',', '.')) / 100
    const min   = parseFloat(form.minimo.replace(',', '.'))
    if (!form.nome.trim() || isNaN(saldo) || isNaN(taxa) || isNaN(min)) {
      setErro('Preencha todos os campos corretamente.'); return
    }
    if (saldo <= 0) { setErro('O saldo da dívida deve ser maior que zero.'); return }
    if (taxa < 0)   { setErro('A taxa de juros não pode ser negativa.'); return }
    if (min <= 0)   { setErro('O pagamento mínimo deve ser maior que zero.'); return }
    setSalvando(true); setErro('')
    const res = await fetch('/api/dividas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: form.nome.trim(), saldo, taxa_juros: taxa, pagamento_minimo: min }),
    })
    const data = await res.json()
    if (!res.ok) { setErro(data.error || 'Erro'); setSalvando(false); return }
    setDividas(prev => [...prev, data.divida])
    setForm({ nome: '', saldo: '', taxa: '', minimo: '' })
    setAdd(false); setSalvando(false)
  }

  async function removerDivida(id: string) {
    if (confirmRemover !== id) { setConfirmRem(id); return }
    setConfirmRem(null)
    const res = await fetch('/api/dividas', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    if (res.ok) setDividas(prev => prev.filter(d => d.id !== id))
  }

  // Simulações — as mais pesadas do app (até 600 iterações cada)
  const neve      = useMemo(() => simular(dividas, extra, 'neve'),      [dividas, extra])
  const avalanche = useMemo(() => simular(dividas, extra, 'avalanche'), [dividas, extra])
  const atual     = metodo === 'neve' ? neve : avalanche
  const outro     = metodo === 'neve' ? avalanche : neve

  const { totalSaldo, totalMinimo } = useMemo(() => ({
    totalSaldo:  dividas.reduce((a, d) => a + d.saldo, 0),
    totalMinimo: dividas.reduce((a, d) => a + d.pagamento_minimo, 0),
  }), [dividas])

  // Gráfico SVG — saldo total ao longo do tempo
  const W = 600, H = 160, PAD = { t: 16, b: 28, l: 56, r: 16 }
  const iW = W - PAD.l - PAD.r
  const iH = H - PAD.t - PAD.b

  const maxVal = totalSaldo || 1
  const px = (i: number, total: number) => PAD.l + (i / Math.max(total - 1, 1)) * iW
  const py = (v: number) => PAD.t + iH - (v / maxVal) * iH

  const { mesesNeve, mesesAvalanche, linhaA, linhaB } = useMemo(() => {
    const mn = neve.meses.map(m => Object.values(m.saldos).reduce((a, v) => a + v, 0))
    const ma = avalanche.meses.map(m => Object.values(m.saldos).reduce((a, v) => a + v, 0))
    const pxFn = (i: number, total: number) => PAD.l + (i / Math.max(total - 1, 1)) * iW
    const pyFn = (v: number) => PAD.t + iH - (v / (totalSaldo || 1)) * iH
    return {
      mesesNeve:      mn,
      mesesAvalanche: ma,
      linhaA: mn.map((v, i) => `${pxFn(i, mn.length)},${pyFn(v)}`).join(' '),
      linhaB: ma.map((v, i) => `${pxFn(i, ma.length)},${pyFn(v)}`).join(' '),
    }
  }, [neve, avalanche, totalSaldo, iW, iH])

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', background: cores.surface,
    border: `1px solid ${cores.border}`, borderRadius: 8, color: cores.text,
    fontSize: 13, outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{ minHeight: '100vh', background: cores.pageBg, color: cores.text, fontFamily: 'system-ui, sans-serif' }}>

      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '1rem 1.5rem', borderBottom: `1px solid ${cores.border}`, background: cores.surface }}>
        <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: cores.textMuted, fontSize: 18, lineHeight: 1, padding: 4 }}>←</button>
        <PoupaUpLogo mode="compact" />
        <span style={{ fontSize: 13, color: cores.textMuted }}>
          {m ? '⚔️ Batalha contra as Dívidas' : '💳 Simulador de Dívidas'}
        </span>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {loading ? (
          <SkeletonDividas />
        ) : (
          <>
            {/* ── Lista de dívidas ── */}
            <div style={{ background: cores.surface, border: `1px solid ${cores.border}`, borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderBottom: dividas.length ? `1px solid ${cores.border}` : 'none' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>Suas dívidas</div>
                  {dividas.length > 0 && <div style={{ fontSize: 12, color: cores.textMuted, marginTop: 2 }}>Total: {fmt(totalSaldo)} · Mínimo mensal: {fmt(totalMinimo)}</div>}
                </div>
                <button
                  onClick={() => { setAdd(p => !p); setErro('') }}
                  style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  {adicionando ? '✕ Cancelar' : '+ Adicionar'}
                </button>
              </div>

              {/* Formulário de adição */}
              {adicionando && (
                <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${cores.border}`, background: 'rgba(255,255,255,.02)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '2fr 1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                    {[
                      { key: 'nome',   placeholder: 'Ex: Cartão Nubank',  label: 'Nome da dívida' },
                      { key: 'saldo',  placeholder: '5000,00',            label: 'Saldo devedor (R$)' },
                      { key: 'taxa',   placeholder: '2,99',               label: 'Juros mensal (%)' },
                      { key: 'minimo', placeholder: '150,00',             label: 'Pagamento mínimo (R$)' },
                    ].map(f => (
                      <div key={f.key}>
                        <div style={{ fontSize: 10, color: cores.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>{f.label}</div>
                        <input
                          value={form[f.key as keyof typeof form]}
                          onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                          placeholder={f.placeholder}
                          style={inputStyle}
                        />
                      </div>
                    ))}
                  </div>
                  {erro && <div style={{ fontSize: 12, color: '#f87171', marginBottom: 8 }}>{erro}</div>}
                  <button onClick={adicionarDivida} disabled={salvando} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', fontSize: 13, fontWeight: 600, cursor: salvando ? 'default' : 'pointer', opacity: salvando ? 0.6 : 1 }}>
                    {salvando ? 'Salvando...' : 'Salvar dívida'}
                  </button>
                </div>
              )}

              {/* Lista */}
              {dividas.length === 0 && !adicionando ? (
                <div style={{ padding: '2rem' }}>
                  <div style={{ textAlign: 'center', marginBottom: 20 }}>
                    <div style={{ fontSize: 36, marginBottom: 10 }}>💳</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: cores.text, marginBottom: 6 }}>Nenhuma dívida cadastrada</div>
                    <div style={{ fontSize: 12, color: cores.textMuted, lineHeight: 1.6, maxWidth: 320, margin: '0 auto 16px' }}>
                      Registre suas dívidas para simular estratégias de quitação e calcular quando ficará livre delas.
                    </div>
                    <button onClick={() => setAdd(true)} style={{ padding: '9px 22px', background: cores.accent, border: 'none', borderRadius: 8, color: '#000', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      + Adicionar dívida
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 8 }}>
                    {[
                      { emoji: '💳', label: 'Cartão de crédito', desc: 'Rotativo e parcelado' },
                      { emoji: '🏦', label: 'Financiamento',      desc: 'Imóvel ou veículo' },
                      { emoji: '📋', label: 'Crédito pessoal',    desc: 'Empréstimo bancário' },
                    ].map(t => (
                      <div key={t.label} style={{ background: 'rgba(255,255,255,.03)', border: `1px solid ${cores.border}`, borderRadius: 10, padding: '12px', textAlign: 'center', cursor: 'pointer', transition: 'border-color .15s' }}
                        onClick={() => setAdd(true)}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = cores.accent + '55')}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = cores.border)}>
                        <div style={{ fontSize: 22, marginBottom: 6 }}>{t.emoji}</div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: cores.text, marginBottom: 2 }}>{t.label}</div>
                        <div style={{ fontSize: 11, color: cores.textMuted }}>{t.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                dividas.map((d, i) => (
                  <div key={d.id}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.02)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 1.25rem', borderBottom: i < dividas.length - 1 ? `1px solid ${cores.border}` : 'none', transition: 'background .15s' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(239,68,68,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>💳</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{d.nome}</div>
                      <div style={{ fontSize: 12, color: cores.textMuted, marginTop: 2 }}>
                        Juros: {pct(d.taxa_juros)}/mês · Mínimo: {fmt(d.pagamento_minimo)}
                      </div>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#f87171', fontVariantNumeric: 'tabular-nums' }}>{fmt(d.saldo)}</div>
                    {confirmRemover === d.id ? (
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <button onClick={() => removerDivida(d.id)} style={{ padding: '3px 8px', background: '#dc2626', border: 'none', borderRadius: 5, color: '#fff', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>Confirmar</button>
                        <button onClick={() => setConfirmRem(null)} style={{ padding: '3px 6px', background: 'transparent', border: `1px solid ${cores.border}`, borderRadius: 5, color: cores.textMuted, fontSize: 10, cursor: 'pointer' }}>✕</button>
                      </div>
                    ) : (
                      <button onClick={() => removerDivida(d.id)} aria-label="Remover dívida" style={{ background: 'none', border: 'none', cursor: 'pointer', color: cores.textMuted, fontSize: 16, padding: 4 }}>✕</button>
                    )}
                  </div>
                ))
              )}
            </div>

            {dividas.length > 0 && (
              <>
                {/* ── Configurações do simulador ── */}
                <div style={{ background: cores.surface, border: `1px solid ${cores.border}`, borderRadius: 14, padding: '1.25rem' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: '1rem' }}>Configurar simulação</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                    <div>
                      <div style={{ fontSize: 11, color: cores.textMuted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Estratégia de pagamento</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {([
                          { id: 'neve' as Metodo,      label: '❄️ Bola de Neve',  desc: 'Menor saldo primeiro' },
                          { id: 'avalanche' as Metodo, label: '🌊 Avalanche',     desc: 'Maior juros primeiro' },
                        ] as const).map(opt => (
                          <button key={opt.id} onClick={() => setMetodo(opt.id)} style={{
                            flex: 1, padding: '10px', borderRadius: 10, cursor: 'pointer', textAlign: 'left', transition: 'all .2s',
                            background: metodo === opt.id ? 'rgba(74,222,128,.1)' : 'transparent',
                            border: `1.5px solid ${metodo === opt.id ? '#16a34a' : cores.border}`,
                          }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: metodo === opt.id ? '#4ade80' : cores.text }}>{opt.label}</div>
                            <div style={{ fontSize: 11, color: cores.textMuted, marginTop: 2 }}>{opt.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: cores.textMuted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Pagamento extra mensal (R$)</div>
                      <input
                        type="number"
                        value={extra || ''}
                        onChange={e => setExtra(parseFloat(e.target.value) || 0)}
                        placeholder="0,00 — quanto a mais você pode pagar?"
                        style={inputStyle}
                      />
                      <div style={{ fontSize: 11, color: cores.textMuted, marginTop: 4 }}>
                        Valor além dos mínimos. Acelera drasticamente a quitação.
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Alerta cenário impagável ── */}
                {neve.impagavel && (
                  <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.35)', borderRadius: 10, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>🚨</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#f87171', marginBottom: 2 }}>Pagamentos não cobrem os juros</div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', lineHeight: 1.5 }}>
                        Com os pagamentos mínimos atuais, os juros crescem mais rápido do que você paga. Aumente o valor extra ou o pagamento mínimo para viabilizar a quitação.
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Resultado comparativo ── */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {([
                    { id: 'neve' as Metodo,      label: '❄️ Bola de Neve',  sim: neve },
                    { id: 'avalanche' as Metodo, label: '🌊 Avalanche',     sim: avalanche },
                  ] as const).map(({ id, label, sim }) => {
                    const ativo = metodo === id
                    const economiaJuros = Math.max(0, outro.totalJuros - sim.totalJuros)
                    const economiaMeses = Math.max(0, outro.mesesTotal - sim.mesesTotal)
                    return (
                      <div key={id} onClick={() => setMetodo(id)} style={{ background: cores.surface, border: `1.5px solid ${ativo ? '#16a34a' : cores.border}`, borderRadius: 14, padding: '1.25rem', cursor: 'pointer', transition: 'border-color .2s' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
                          {ativo && <div style={{ fontSize: 10, background: '#16a34a', color: '#fff', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>ATIVO</div>}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 12, color: cores.textMuted }}>Meses até quitação</span>
                            <span style={{ fontSize: 14, fontWeight: 700, color: '#4ade80' }}>{sim.mesesTotal} meses</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 12, color: cores.textMuted }}>Total de juros</span>
                            <span style={{ fontSize: 14, fontWeight: 700, color: '#f87171' }}>{fmt(sim.totalJuros)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 12, color: cores.textMuted }}>Total pago</span>
                            <span style={{ fontSize: 14, fontWeight: 600 }}>{fmt(sim.totalPago)}</span>
                          </div>
                          {economiaMeses > 0 && (
                            <div style={{ marginTop: 4, padding: '6px 10px', background: 'rgba(74,222,128,.08)', border: '1px solid rgba(74,222,128,.15)', borderRadius: 8, fontSize: 11, color: '#4ade80' }}>
                              ✓ {economiaMeses} mes{economiaMeses > 1 ? 'es' : ''} mais rápido · economiza {fmt(economiaJuros)} em juros
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* ── Gráfico saldo total ── */}
                {atual.meses.length > 0 && (
                  <div style={{ background: cores.surface, border: `1px solid ${cores.border}`, borderRadius: 14, padding: '1.25rem' }}>
                    <div style={{ fontSize: 11, color: cores.textMuted, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12 }}>
                      Evolução do saldo total das dívidas
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
                        {/* Y labels */}
                        {[0, 0.5, 1].map((r, i) => {
                          const v = totalSaldo * r
                          return <text key={i} x={PAD.l - 6} y={py(v) + 4} textAnchor="end" fontSize="9" fill="rgba(255,255,255,.3)">{v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0)}</text>
                        })}
                        {/* Bola de neve (azul) */}
                        {mesesNeve.length > 1 && <polyline points={linhaA} fill="none" stroke="#60a5fa" strokeWidth="1.5" strokeLinejoin="round" strokeDasharray={metodo === 'neve' ? undefined : '4,3'} opacity={metodo === 'neve' ? 1 : 0.4} />}
                        {/* Avalanche (laranja) */}
                        {mesesAvalanche.length > 1 && <polyline points={linhaB} fill="none" stroke="#fb923c" strokeWidth="1.5" strokeLinejoin="round" strokeDasharray={metodo === 'avalanche' ? undefined : '4,3'} opacity={metodo === 'avalanche' ? 1 : 0.4} />}
                        {/* X labels — a cada ~12 meses */}
                        {atual.meses.filter((_, i) => i % Math.max(1, Math.floor(atual.mesesTotal / 6)) === 0).map((ms) => {
                          const d = new Date()
                          d.setMonth(d.getMonth() + ms.mes)
                          return <text key={ms.mes} x={px(ms.mes - 1, atual.mesesTotal)} y={H - 4} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,.3)">{d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}</text>
                        })}
                      </svg>
                    </div>
                    <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><div style={{ width: 20, height: 2, background: '#60a5fa' }} /><span style={{ color: cores.textMuted }}>Bola de neve ({neve.mesesTotal}m)</span></div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><div style={{ width: 20, height: 2, background: '#fb923c' }} /><span style={{ color: cores.textMuted }}>Avalanche ({avalanche.mesesTotal}m)</span></div>
                    </div>
                  </div>
                )}

                {/* ── Cronograma por dívida ── */}
                <div style={{ background: cores.surface, border: `1px solid ${cores.border}`, borderRadius: 14, overflow: 'hidden' }}>
                  <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${cores.border}`, fontSize: 11, color: cores.textMuted, textTransform: 'uppercase', letterSpacing: '.08em' }}>
                    Previsão de quitação por dívida — {metodo === 'neve' ? '❄️ Bola de Neve' : '🌊 Avalanche'}
                  </div>
                  {dividas.map(d => {
                    // Acha o mês em que esta dívida zera
                    const mesQuitacao = atual.meses.find(ms => (ms.saldos[d.id] ?? 0) <= 0.005)
                    const dataQuit = mesQuitacao ? (() => {
                      const dt = new Date(); dt.setMonth(dt.getMonth() + mesQuitacao.mes)
                      return dt.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
                    })() : 'Não quitada'

                    const jurosTotal = atual.meses.reduce((a, ms) => a + (ms.juros[d.id] || 0), 0)
                    const pagoTotal  = atual.meses.reduce((a, ms) => a + (ms.pago[d.id]  || 0), 0)
                    const mesesDivida = mesQuitacao?.mes ?? atual.mesesTotal

                    const expanded = tabAberta === d.id

                    return (
                      <div key={d.id} style={{ borderBottom: `1px solid ${cores.border}` }}>
                        <button onClick={() => setTabAberta(expanded ? null : d.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '12px 1.25rem', background: 'none', border: 'none', cursor: 'pointer', color: cores.text, textAlign: 'left' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: 500 }}>{d.nome}</div>
                            <div style={{ fontSize: 12, color: cores.textMuted, marginTop: 2 }}>
                              Quitada em {dataQuit} · {mesesDivida} meses
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 13, color: '#f87171' }}>+{fmt(jurosTotal)} em juros</div>
                            <div style={{ fontSize: 12, color: cores.textMuted }}>total pago: {fmt(pagoTotal)}</div>
                          </div>
                          <div style={{ fontSize: 12, color: cores.textMuted, marginLeft: 8 }}>{expanded ? '▲' : '▼'}</div>
                        </button>

                        {expanded && (
                          <div style={{ overflowX: 'auto', maxHeight: 300, overflowY: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                              <thead>
                                <tr style={{ background: 'rgba(255,255,255,.03)', position: 'sticky', top: 0 }}>
                                  {['Mês', 'Saldo inicial', 'Juros', 'Pago', 'Saldo final'].map(h => (
                                    <th key={h} style={{ padding: '8px 14px', textAlign: 'right', color: cores.textMuted, fontWeight: 500, borderBottom: `1px solid ${cores.border}` }}>
                                      {h === 'Mês' ? <span style={{ float: 'left' }}>{h}</span> : h}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {atual.meses.filter(ms => ms.pago[d.id] > 0 || ms.mes === 1).map((ms, idx) => {
                                  const prevSaldo = idx === 0 ? d.saldo : (atual.meses[idx - 1]?.saldos[d.id] ?? 0) + (ms.juros[d.id] ?? 0)
                                  const dt = new Date(); dt.setMonth(dt.getMonth() + ms.mes)
                                  return (
                                    <tr key={ms.mes} style={{ borderBottom: `1px solid ${cores.border}` }}>
                                      <td style={{ padding: '7px 14px', color: cores.textMuted }}>{dt.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}</td>
                                      <td style={{ padding: '7px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(prevSaldo)}</td>
                                      <td style={{ padding: '7px 14px', textAlign: 'right', color: '#f87171', fontVariantNumeric: 'tabular-nums' }}>+{fmt(ms.juros[d.id] ?? 0)}</td>
                                      <td style={{ padding: '7px 14px', textAlign: 'right', color: '#4ade80', fontVariantNumeric: 'tabular-nums' }}>{fmt(ms.pago[d.id] ?? 0)}</td>
                                      <td style={{ padding: '7px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: (ms.saldos[d.id] ?? 0) <= 0.005 ? '#4ade80' : cores.text }}>
                                        {(ms.saldos[d.id] ?? 0) <= 0.005 ? '✓ Quitada' : fmt(ms.saldos[d.id] ?? 0)}
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
