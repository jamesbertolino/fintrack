'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCores } from '@/components/ThemeProvider'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

interface Categoria { nome: string; valor: number; limite: number | null; pct: number | null }
interface Meta { nome: string; valor_total: number; valor_atual: number; contribuicao_mensal: number; prazo: string | null }
interface Transacao { descricao: string; valor: number; tipo: string; categoria: string; data_hora: string }
interface Dados {
  periodo: { ano: number; mes: number }
  usuario: { nome: string; plano: string }
  resumo: { receitas: number; despesas: number; saldo: number }
  categorias: Categoria[]
  transacoes: Transacao[]
  metas: Meta[]
}

export default function RelatorioPage() {
  const router = useRouter()
  const cores  = useCores()

  const now = new Date()
  const [ano, setAno] = useState(now.getFullYear())
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [dados, setDados]     = useState<Dados | null>(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro]       = useState('')

  const buscar = useCallback(async () => {
    setLoading(true); setErro('')
    try {
      const res = await fetch(`/api/relatorio?ano=${ano}&mes=${mes}`)
      if (!res.ok) { setErro('Erro ao carregar relatório'); return }
      setDados(await res.json())
    } catch { setErro('Erro de conexão') }
    finally { setLoading(false) }
  }, [ano, mes])

  useEffect(() => { buscar() }, [buscar]) // eslint-disable-line react-hooks/set-state-in-effect

  const maxCat = dados?.categorias[0]?.valor || 1

  return (
    <>
      {/* ── CSS de impressão ── */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-page { background: #fff !important; color: #000 !important; padding: 0 !important; }
          .print-card { border: 1px solid #ddd !important; background: #fff !important; box-shadow: none !important; break-inside: avoid; }
          .print-header { background: #16a34a !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { margin: 1.5cm; size: A4; }
        }
      `}</style>

      <div className="print-page" style={{ minHeight: '100vh', background: cores.pageBg, fontFamily: 'system-ui, sans-serif', fontSize: 13, color: cores.text }}>

        {/* Topbar — oculta na impressão */}
        <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '.875rem 1.5rem', borderBottom: `1px solid ${cores.border}`, background: cores.topbarBg }}>
          <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: cores.textMuted, display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Dashboard
          </button>
          <span style={{ color: cores.textFaint }}>/</span>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Relatório mensal</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Seletor de mês/ano */}
            <select value={mes} onChange={e => setMes(+e.target.value)} style={{ padding: '5px 8px', borderRadius: 7, border: `1px solid ${cores.border}`, background: cores.surface, color: cores.text, fontSize: 12 }}>
              {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <select value={ano} onChange={e => setAno(+e.target.value)} style={{ padding: '5px 8px', borderRadius: 7, border: `1px solid ${cores.border}`, background: cores.surface, color: cores.text, fontSize: 12 }}>
              {[now.getFullYear() - 1, now.getFullYear()].map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <button onClick={() => window.print()} style={{ padding: '6px 16px', borderRadius: 8, border: 'none', background: cores.accent, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Baixar PDF
            </button>
          </div>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '4rem', color: cores.textMuted }}>Carregando...</div>
        )}
        {erro && (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#f87171' }}>{erro}</div>
        )}

        {dados && !loading && (
          <div style={{ maxWidth: 860, margin: '0 auto', padding: '2rem 1.5rem' }}>

            {/* ── Cabeçalho do relatório ── */}
            <div className="print-header" style={{ background: 'linear-gradient(135deg, #16a34a, #4ade80)', borderRadius: 14, padding: '1.75rem 2rem', marginBottom: '1.5rem', color: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, opacity: .75, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Relatório Financeiro Mensal</div>
                  <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5 }}>{MESES[dados.periodo.mes - 1]} {dados.periodo.ano}</div>
                  <div style={{ fontSize: 13, opacity: .8, marginTop: 4 }}>{dados.usuario.nome}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, opacity: .7 }}>Saldo do período</div>
                  <div style={{ fontSize: 32, fontWeight: 800 }}>{fmt(dados.resumo.saldo)}</div>
                  <div style={{ fontSize: 11, opacity: .7, marginTop: 2 }}>
                    {dados.resumo.saldo >= 0 ? '✅ Positivo' : '⚠️ Negativo'}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Cards de resumo ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: '1.5rem' }}>
              {[
                { label: 'Receitas', valor: dados.resumo.receitas, cor: '#4ade80', icon: '↑' },
                { label: 'Despesas', valor: dados.resumo.despesas, cor: '#f87171', icon: '↓' },
                { label: 'Saldo',    valor: dados.resumo.saldo,    cor: dados.resumo.saldo >= 0 ? '#4ade80' : '#f87171', icon: '=' },
              ].map(c => (
                <div key={c.label} className="print-card" style={{ background: cores.surface, border: `1px solid ${cores.border}`, borderRadius: 12, padding: '1rem 1.25rem' }}>
                  <div style={{ fontSize: 11, color: cores.textMuted, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ color: c.cor, fontWeight: 700 }}>{c.icon}</span> {c.label}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: c.cor }}>{fmt(c.valor)}</div>
                </div>
              ))}
            </div>

            {/* ── Gastos por categoria ── */}
            {dados.categorias.length > 0 && (
              <div className="print-card" style={{ background: cores.surface, border: `1px solid ${cores.border}`, borderRadius: 12, padding: '1.25rem', marginBottom: '1.5rem' }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: '1rem' }}>💸 Gastos por categoria</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {dados.categorias.map(cat => (
                    <div key={cat.nome}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: cores.text }}>{cat.nome}</span>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          {cat.limite && (
                            <span style={{ fontSize: 10, color: cat.pct! > 100 ? '#f87171' : cores.textMuted }}>
                              limite {fmt(cat.limite)} · {cat.pct}%
                            </span>
                          )}
                          <span style={{ fontSize: 12, fontWeight: 600, color: cat.pct && cat.pct > 100 ? '#f87171' : cores.text }}>{fmt(cat.valor)}</span>
                        </div>
                      </div>
                      <div style={{ height: 5, background: cores.border, borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: 3,
                          width: `${Math.min(100, (cat.valor / maxCat) * 100)}%`,
                          background: cat.pct && cat.pct > 100 ? '#f87171' : cores.accent,
                          transition: 'width .4s',
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Metas ── */}
            {dados.metas.length > 0 && (
              <div className="print-card" style={{ background: cores.surface, border: `1px solid ${cores.border}`, borderRadius: 12, padding: '1.25rem', marginBottom: '1.5rem' }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: '1rem' }}>🎯 Metas em andamento</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {dados.metas.map(meta => {
                    const pct = Math.min(100, Math.round((meta.valor_atual / meta.valor_total) * 100))
                    return (
                      <div key={meta.nome}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 600 }}>{meta.nome}</span>
                          <span style={{ fontSize: 11, color: cores.textMuted }}>{fmt(meta.valor_atual)} / {fmt(meta.valor_total)} · {pct}%</span>
                        </div>
                        <div style={{ height: 5, background: cores.border, borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#4ade80' : cores.accent, borderRadius: 3 }} />
                        </div>
                        {meta.contribuicao_mensal > 0 && (
                          <div style={{ fontSize: 10, color: cores.textFaint, marginTop: 3 }}>
                            Aporte mensal: {fmt(meta.contribuicao_mensal)}
                            {meta.prazo && ` · Prazo: ${new Date(meta.prazo).toLocaleDateString('pt-BR')}`}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Extrato detalhado ── */}
            {dados.transacoes.length > 0 && (
              <div className="print-card" style={{ background: cores.surface, border: `1px solid ${cores.border}`, borderRadius: 12, padding: '1.25rem', marginBottom: '1.5rem' }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: '1rem' }}>📋 Extrato do período ({dados.transacoes.length} lançamentos)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '6px 12px', alignItems: 'center' }}>
                  {/* Header */}
                  {['Descrição','Categoria','Data','Valor'].map(h => (
                    <div key={h} style={{ fontSize: 10, fontWeight: 700, color: cores.textFaint, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: `1px solid ${cores.border}`, paddingBottom: 6, marginBottom: 2 }}>{h}</div>
                  ))}
                  {/* Linhas */}
                  {dados.transacoes.map((t, i) => (
                    <>
                      <div key={`d${i}`} style={{ fontSize: 12, color: cores.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.descricao || '—'}</div>
                      <div key={`c${i}`} style={{ fontSize: 11, color: cores.textMuted }}>{t.categoria || '—'}</div>
                      <div key={`dt${i}`} style={{ fontSize: 11, color: cores.textMuted, whiteSpace: 'nowrap' }}>{new Date(t.data_hora).toLocaleDateString('pt-BR')}</div>
                      <div key={`v${i}`} style={{ fontSize: 12, fontWeight: 600, color: t.tipo === 'credito' ? '#4ade80' : '#f87171', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {t.tipo === 'credito' ? '+' : '-'}{fmt(Math.abs(t.valor))}
                      </div>
                    </>
                  ))}
                </div>
              </div>
            )}

            {/* ── Rodapé ── */}
            <div style={{ textAlign: 'center', fontSize: 11, color: cores.textFaint, marginTop: '1rem', paddingTop: '1rem', borderTop: `1px solid ${cores.border}` }}>
              Gerado em {new Date().toLocaleDateString('pt-BR', { dateStyle: 'long' })} · PoupaUp · poupaup.com.br
            </div>

          </div>
        )}

        {dados && dados.transacoes.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: '3rem', color: cores.textMuted }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
            <div>Nenhum lançamento em {MESES[mes - 1]} {ano}</div>
          </div>
        )}
      </div>
    </>
  )
}
