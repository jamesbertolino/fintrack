'use client'

import { useCallback, useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
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
}

const CORES: Record<string, string> = {
  'Alimentação': '#4ade80',
  'Transporte':  '#22d3ee',
  'Lazer':       '#f97316',
  'Saúde':       '#a78bfa',
  'Moradia':     '#fbbf24',
  'Educação':    '#60a5fa',
  'Receita':     '#4ade80',
  'Outros':      '#6b7280',
}

const CATEGORIAS = ['Todas', 'Alimentação', 'Transporte', 'Lazer', 'Saúde', 'Moradia', 'Educação', 'Receita', 'Outros']

function fmtBRL(v: number) {
  return 'R$ ' + Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function GastosPage() {
  const router = useRouter()
  const supabase = createClient()
  const { fmtData, fmtMes } = usePerfil()

  const [transacoes, setTransacoes] = useState<Transacao[]>([])
  const [loading, setLoading]       = useState(true)
  const [catFiltro, setCatFiltro]   = useState('Todas')
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | 'debito' | 'credito'>('todos')
  const [busca, setBusca]           = useState('')
  const [periodo, setPeriodo]       = useState('30')
  const [abaGrafico, setAbaGrafico] = useState<'categoria' | 'evolucao'>('categoria')
  const [userId, setUserId]         = useState('')

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setUserId(user.id)

    const dias = parseInt(periodo)
    const desde = new Date()
    desde.setDate(desde.getDate() - dias)

    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .gte('data_hora', desde.toISOString())
      .order('data_hora', { ascending: false })

    if (data) setTransacoes(data)
    setLoading(false)
  }, [supabase, router, periodo])

  useEffect(() => {
    carregar()
  }, [carregar])

  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel('gastos-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${userId}` }, () => { carregar() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  // Filtros aplicados
  const filtradas = useMemo(() => transacoes.filter(t => {
    if (catFiltro !== 'Todas' && t.categoria !== catFiltro) return false
    if (tipoFiltro !== 'todos' && t.tipo !== tipoFiltro) return false
    if (busca && !t.descricao.toLowerCase().includes(busca.toLowerCase())) return false
    return true
  }), [transacoes, catFiltro, tipoFiltro, busca])

  // Métricas
  const totalReceitas = filtradas.filter(t => t.tipo === 'credito').reduce((a, t) => a + t.valor, 0)
  const totalDespesas = filtradas.filter(t => t.tipo === 'debito').reduce((a, t) => a + Math.abs(t.valor), 0)
  const saldo         = totalReceitas - totalDespesas

  // Gastos por categoria
  const porCategoria = useMemo(() => {
    const acc: Record<string, number> = {}
    filtradas.filter(t => t.tipo === 'debito').forEach(t => {
      acc[t.categoria] = (acc[t.categoria] || 0) + Math.abs(t.valor)
    })
    return Object.entries(acc).sort((a, b) => b[1] - a[1])
  }, [filtradas])

  const maxCat = porCategoria[0]?.[1] || 1

  // Evolução por mês
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

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <PoupaUpLogo mode="compact" />
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)' }}>Carregando gastos...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: 'system-ui, sans-serif', fontSize: 13, color: '#fff' }}>

      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.875rem 1.5rem', borderBottom: '1px solid #1a3a1a', background: '#0a1a0a' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.4)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Dashboard
          </button>
          <span style={{ color: 'rgba(255,255,255,.2)' }}>/</span>
          <span style={{ fontSize: 15, fontWeight: 500 }}>Gastos</span>
        </div>

        {/* Período */}
        <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,.3)', border: '1px solid #1a3a1a', borderRadius: 8, padding: 3 }}>
          {[['7', '7d'], ['30', '30d'], ['90', '90d'], ['365', '1 ano']].map(([v, l]) => (
            <button key={v} onClick={() => setPeriodo(v)} style={{
              padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 500,
              background: periodo === v ? '#16a34a' : 'transparent',
              color: periodo === v ? '#fff' : 'rgba(255,255,255,.4)',
            }}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: '1.5rem' }}>

        {/* Métricas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 10, marginBottom: '1.25rem' }}>
          {[
            { label: 'Receitas',     val: fmtBRL(totalReceitas), cor: '#4ade80' },
            { label: 'Despesas',     val: fmtBRL(totalDespesas), cor: '#f87171' },
            { label: 'Saldo',        val: fmtBRL(saldo),         cor: saldo >= 0 ? '#4ade80' : '#f87171' },
            { label: 'Transações',   val: String(filtradas.length), cor: '#fff' },
          ].map(m => (
            <div key={m.label} style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>{m.label}</div>
              <div style={{ fontSize: 20, fontWeight: 500, color: m.cor }}>{m.val}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: '1.25rem' }}>

          {/* Gráficos */}
          <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 12, padding: '1rem' }}>
            <div style={{ display: 'flex', gap: 4, marginBottom: '1rem' }}>
              {(['categoria', 'evolucao'] as const).map(a => (
                <button key={a} onClick={() => setAbaGrafico(a)} style={{
                  padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 500,
                  background: abaGrafico === a ? '#16a34a' : 'rgba(255,255,255,.06)',
                  color: abaGrafico === a ? '#fff' : 'rgba(255,255,255,.4)',
                }}>
                  {a === 'categoria' ? 'Por categoria' : 'Evolução mensal'}
                </button>
              ))}
            </div>

            {/* Gráfico por categoria */}
            {abaGrafico === 'categoria' && (
              <div>
                {porCategoria.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'rgba(255,255,255,.3)', fontSize: 12 }}>Sem despesas no período</div>
                ) : porCategoria.map(([cat, val]) => (
                  <div key={cat} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: CORES[cat] || '#6b7280' }} />
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,.7)' }}>{cat}</span>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 500 }}>{fmtBRL(val)}</span>
                    </div>
                    <div style={{ height: 6, background: 'rgba(255,255,255,.06)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(val / maxCat) * 100}%`, background: CORES[cat] || '#6b7280', borderRadius: 3, transition: 'width .5s' }} />
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', marginTop: 2 }}>
                      {totalDespesas > 0 ? Math.round((val / totalDespesas) * 100) : 0}% do total
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Gráfico evolução mensal */}
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
          </div>

          {/* Insights */}
          <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 12, padding: '1rem' }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,.5)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>Insights do período</div>
            {filtradas.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'rgba(255,255,255,.3)', fontSize: 12 }}>Sem dados no período selecionado</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Maior gasto */}
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

                {/* Taxa de poupança */}
                {totalReceitas > 0 && (
                  <div style={{ background: '#0a1a0a', borderRadius: 8, padding: '10px 12px', display: 'flex', gap: 8 }}>
                    <div style={{ width: 20, height: 20, borderRadius: 5, background: 'rgba(74,222,128,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 11 }}>💰</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,.7)', lineHeight: 1.5 }}>
                      Taxa de poupança: <strong style={{ color: saldo >= 0 ? '#4ade80' : '#f87171' }}>
                        {Math.round(((totalReceitas - totalDespesas) / totalReceitas) * 100)}%
                      </strong> das receitas
                    </div>
                  </div>
                )}

                {/* Ticket médio */}
                {filtradas.filter(t => t.tipo === 'debito').length > 0 && (
                  <div style={{ background: '#0a1a0a', borderRadius: 8, padding: '10px 12px', display: 'flex', gap: 8 }}>
                    <div style={{ width: 20, height: 20, borderRadius: 5, background: 'rgba(34,211,238,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 11 }}>🧾</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,.7)', lineHeight: 1.5 }}>
                      Ticket médio por gasto: <strong style={{ color: '#22d3ee' }}>
                        {fmtBRL(totalDespesas / filtradas.filter(t => t.tipo === 'debito').length)}
                      </strong>
                    </div>
                  </div>
                )}

                {/* Alerta estouro */}
                {totalDespesas > totalReceitas && totalReceitas > 0 && (
                  <div style={{ background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 8, padding: '10px 12px', display: 'flex', gap: 8 }}>
                    <div style={{ width: 20, height: 20, borderRadius: 5, background: 'rgba(239,68,68,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 11 }}>⚠️</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#f87171', lineHeight: 1.5 }}>
                      Despesas superam receitas em <strong>{fmtBRL(totalDespesas - totalReceitas)}</strong> no período
                    </div>
                  </div>
                )}

                {/* Número de categorias */}
                <div style={{ background: '#0a1a0a', borderRadius: 8, padding: '10px 12px', display: 'flex', gap: 8 }}>
                  <div style={{ width: 20, height: 20, borderRadius: 5, background: 'rgba(167,139,250,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 11 }}>🏷️</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,.7)', lineHeight: 1.5 }}>
                    <strong style={{ color: '#a78bfa' }}>{porCategoria.length}</strong> categorias de gastos em {periodo === '365' ? '1 ano' : `${periodo} dias`}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Filtros + tabela */}
        <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 12, padding: '1rem' }}>
          {/* Filtros */}
          <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Busca */}
            <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,.3)' }}>
                <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M9 9l2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              <input
                value={busca} onChange={e => setBusca(e.target.value)}
                placeholder="Buscar transação..."
                style={{ width: '100%', padding: '7px 10px 7px 28px', background: '#0a1a0a', border: '1px solid #1a3a1a', borderRadius: 8, color: '#fff', fontSize: 12, outline: 'none' }}
              />
            </div>

            {/* Tipo */}
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

            {/* Categoria */}
            <select value={catFiltro} onChange={e => setCatFiltro(e.target.value)} style={{
              padding: '7px 10px', background: '#0a1a0a', border: '1px solid #1a3a1a',
              borderRadius: 8, color: catFiltro === 'Todas' ? 'rgba(255,255,255,.5)' : '#fff',
              fontSize: 12, outline: 'none', cursor: 'pointer',
            }}>
              {CATEGORIAS.map(c => <option key={c} value={c} style={{ background: '#111' }}>{c}</option>)}
            </select>

            {/* Limpar filtros */}
            {(catFiltro !== 'Todas' || tipoFiltro !== 'todos' || busca) && (
              <button onClick={() => { setCatFiltro('Todas'); setTipoFiltro('todos'); setBusca('') }} style={{
                padding: '6px 10px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)',
                borderRadius: 8, color: '#f87171', fontSize: 11, cursor: 'pointer',
              }}>
                Limpar filtros
              </button>
            )}

            <div style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(255,255,255,.35)' }}>
              {filtradas.length} de {transacoes.length} transações
            </div>
          </div>

          {/* Tabela */}
          {filtradas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'rgba(255,255,255,.3)', fontSize: 13 }}>
              Nenhuma transação encontrada com os filtros aplicados
            </div>
          ) : (
            <div>
              {/* Header */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 110px', gap: 10, padding: '6px 8px', borderBottom: '1px solid #1a3a1a', marginBottom: 4 }}>
                {['Descrição', 'Categoria', 'Data', 'Valor'].map(h => (
                  <div key={h} style={{ fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.05em', textAlign: h === 'Valor' ? 'right' : 'left' }}>{h}</div>
                ))}
              </div>

              {filtradas.map(t => (
                <div key={t.id} style={{
                  display: 'grid', gridTemplateColumns: '1fr 120px 120px 110px', gap: 10,
                  padding: '8px', borderRadius: 6, transition: 'background .12s',
                  borderBottom: '1px solid rgba(255,255,255,.04)',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.03)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: CORES[t.categoria] || '#6b7280', flexShrink: 0 }} />
                    <div style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.descricao}</div>
                    {t.origem === 'webhook' && (
                      <span style={{ fontSize: 9, background: 'rgba(74,222,128,.1)', color: '#4ade80', padding: '1px 5px', borderRadius: 3, flexShrink: 0 }}>auto</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', alignSelf: 'center' }}>{t.categoria}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', alignSelf: 'center' }}>{fmtData(t.data_hora)}</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: t.tipo === 'credito' ? '#4ade80' : '#f87171', textAlign: 'right', alignSelf: 'center' }}>
                    {t.tipo === 'credito' ? '+' : '-'}{fmtBRL(Math.abs(t.valor))}
                  </div>
                </div>
              ))}

              {/* Total */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 110px', gap: 10, padding: '10px 8px', borderTop: '1px solid #1a3a1a', marginTop: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,.5)' }}>Total filtrado</div>
                <div /><div />
                <div style={{ fontSize: 13, fontWeight: 500, color: saldo >= 0 ? '#4ade80' : '#f87171', textAlign: 'right' }}>
                  {saldo >= 0 ? '+' : '-'}{fmtBRL(Math.abs(saldo))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}