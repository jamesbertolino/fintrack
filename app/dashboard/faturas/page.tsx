'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const MESES_PT_CURTO = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function fmtMes(yyyymm: string) {
  const [y, m] = yyyymm.split('-')
  return `${MESES_PT[parseInt(m) - 1]} ${y}`
}
function fmtMesCurto(yyyymm: string) {
  const [y, m] = yyyymm.split('-')
  return `${MESES_PT_CURTO[parseInt(m) - 1]}/${y.slice(2)}`
}
function fmtBRL(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)
}

type MesDado = { total_tx: number; valor_debito: number; valor_credito: number; importacoes: number }
type Conta   = { id: string; nome: string; tipo: string; bancos: { nome_curto: string; cor: string } | null; meses: Record<string, MesDado> }
type Transferencia = { data: string; descricao: string; valor: number; tx_saida_id: string; tx_entrada_id: string; conta_saida_id: string | null; conta_entrada_id: string | null }

export default function FaturasPage() {
  const router = useRouter()
  const [contas, setContas]             = useState<Conta[]>([])
  const [meses, setMeses]               = useState<string[]>([])
  const [transferencias, setTransferencias] = useState<Transferencia[]>([])
  const [contasMap, setContasMap]       = useState<Record<string, Conta>>({})
  const [loading, setLoading]           = useState(true)
  const [expandidos, setExpandidos]     = useState<Set<string>>(new Set())
  const mesAtual = new Date().toISOString().slice(0, 7)

  useEffect(() => {
    fetch('/api/faturas/cobertura').then(r => r.json()).then(d => {
      setContas(d.contas || [])
      setMeses(d.meses || [])
      setTransferencias(d.transferencias || [])
      setContasMap(d.contasMap || {})
      setLoading(false)
    })
  }, [])

  function toggle(id: string) {
    setExpandidos(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  // Valor máximo global para escala das barras
  const maxDebito = Math.max(1, ...contas.flatMap(c => meses.map(m => c.meses[m]?.valor_debito || 0)))

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'50vh', color:'#a1a1aa', fontFamily:'sans-serif' }}>
      Carregando...
    </div>
  )

  return (
    <div style={{ padding:'16px', maxWidth:'860px', margin:'0 auto', paddingBottom:'96px', fontFamily:'system-ui,sans-serif', color:'#e4e4e7' }}>

      {/* Cabeçalho */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'24px', gap:'12px', flexWrap:'wrap' }}>
        <div>
          <h1 style={{ fontSize:'20px', fontWeight:700, margin:0, color:'#f4f4f5' }}>Controle de Faturas</h1>
          <p style={{ fontSize:'13px', color:'#71717a', margin:'4px 0 0' }}>Histórico mensal de importações por conta</p>
        </div>
        <button
          onClick={() => router.push('/dashboard/lancamento')}
          style={{ background:'#4f46e5', color:'#fff', border:'none', borderRadius:'8px', padding:'8px 16px', fontSize:'13px', cursor:'pointer', whiteSpace:'nowrap' }}
        >
          + Importar extrato
        </button>
      </div>

      {/* Legenda */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:'12px', marginBottom:'20px', fontSize:'12px', color:'#71717a' }}>
        {[
          { color:'#16a34a', label:'Importado' },
          { color:'#dc2626', label:'Sem dados' },
          { color:'#d97706', label:'Sem transações' },
          { color:'#3f3f46', label:'Futuro' },
        ].map(({ color, label }) => (
          <span key={label} style={{ display:'flex', alignItems:'center', gap:'6px' }}>
            <span style={{ width:'10px', height:'10px', borderRadius:'2px', background:color, display:'inline-block' }} />
            {label}
          </span>
        ))}
      </div>

      {contas.length === 0 ? (
        <p style={{ color:'#71717a', textAlign:'center', padding:'48px 0' }}>Nenhuma conta cadastrada.</p>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          {[...meses].reverse().map(mes => {
            const isFuturo  = mes > mesAtual
            const isAtual   = mes === mesAtual
            const temDados  = contas.some(c => (c.meses[mes]?.total_tx || 0) > 0)
            const expandido = expandidos.has(mes)

            return (
              <div
                key={mes}
                style={{
                  borderRadius:'12px',
                  border: isAtual ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(63,63,70,0.5)',
                  background: isFuturo ? 'rgba(24,24,27,0.3)' : 'rgba(24,24,27,0.7)',
                  overflow:'hidden',
                }}
              >
                {/* Header do mês */}
                <button
                  onClick={() => toggle(mes)}
                  style={{
                    width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
                    padding:'12px 16px', background:'transparent', border:'none', cursor:'pointer',
                    color:'#e4e4e7', textAlign:'left', gap:'8px',
                  }}
                >
                  <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                    <span style={{
                      fontSize:'13px', fontWeight:600, color: isAtual ? '#a5b4fc' : isFuturo ? '#52525b' : '#e4e4e7'
                    }}>
                      {fmtMes(mes)}
                    </span>
                    {isAtual && (
                      <span style={{ fontSize:'10px', background:'rgba(99,102,241,0.2)', color:'#a5b4fc', borderRadius:'4px', padding:'1px 6px' }}>
                        mês atual
                      </span>
                    )}
                    {!isFuturo && (
                      <span style={{ fontSize:'11px', color: temDados ? '#16a34a' : '#dc2626' }}>
                        {temDados
                          ? `${contas.filter(c => (c.meses[mes]?.total_tx || 0) > 0).length}/${contas.length} conta${contas.length > 1 ? 's' : ''}`
                          : 'sem dados'}
                      </span>
                    )}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                    {temDados && (
                      <span style={{ fontSize:'13px', color:'#71717a' }}>
                        {fmtBRL(contas.reduce((s, c) => s + (c.meses[mes]?.valor_debito || 0), 0))}
                      </span>
                    )}
                    <span style={{ fontSize:'12px', color:'#52525b' }}>{expandido ? '▾' : '▸'}</span>
                  </div>
                </button>

                {/* Mini barras no header (quando recolhido) */}
                {!expandido && !isFuturo && (
                  <div style={{ padding:'0 16px 12px', display:'flex', flexDirection:'column', gap:'5px' }}>
                    {contas.map(conta => {
                      const d = conta.meses[mes]
                      const temTx = (d?.total_tx || 0) > 0
                      const pct = temTx ? Math.max(2, Math.round((d.valor_debito / maxDebito) * 100)) : 0
                      const cor = temTx ? (conta.bancos?.cor || '#6366f1') : '#dc2626'
                      return (
                        <div key={conta.id} style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                          <span style={{ fontSize:'11px', color:'#71717a', minWidth:'80px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {conta.bancos?.nome_curto || conta.nome}
                          </span>
                          <div style={{ flex:1, height:'8px', background:'rgba(63,63,70,0.5)', borderRadius:'4px', overflow:'hidden' }}>
                            {temTx ? (
                              <div style={{ height:'100%', width:`${pct}%`, background:cor, borderRadius:'4px', transition:'width 0.3s' }} />
                            ) : (
                              <div style={{ height:'100%', width:'100%', background:'rgba(220,38,38,0.15)', borderRadius:'4px', display:'flex', alignItems:'center' }}>
                                <span style={{ fontSize:'9px', color:'#dc2626', paddingLeft:'4px' }}>importar</span>
                              </div>
                            )}
                          </div>
                          <span style={{ fontSize:'11px', color: temTx ? '#a1a1aa' : '#dc2626', minWidth:'60px', textAlign:'right' }}>
                            {temTx ? fmtBRL(d.valor_debito) : '—'}
                          </span>
                          {!temTx && (
                            <button
                              onClick={e => { e.stopPropagation(); router.push('/dashboard/lancamento') }}
                              style={{ fontSize:'10px', color:'#dc2626', background:'rgba(220,38,38,0.1)', border:'1px solid rgba(220,38,38,0.3)', borderRadius:'4px', padding:'1px 6px', cursor:'pointer', whiteSpace:'nowrap' }}
                            >
                              imp
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Detalhe expandido */}
                {expandido && !isFuturo && (
                  <div style={{ borderTop:'1px solid rgba(63,63,70,0.4)', padding:'12px 16px', display:'flex', flexDirection:'column', gap:'10px' }}>
                    {contas.map(conta => {
                      const d = conta.meses[mes]
                      const temTx = (d?.total_tx || 0) > 0
                      const pct = temTx ? Math.max(2, Math.round((d.valor_debito / maxDebito) * 100)) : 0
                      const cor = conta.bancos?.cor || '#6366f1'
                      return (
                        <div key={conta.id} style={{ background:'rgba(39,39,42,0.4)', borderRadius:'8px', padding:'10px 12px' }}>
                          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                              {conta.bancos?.cor && <span style={{ width:'8px', height:'8px', borderRadius:'50%', background:conta.bancos.cor, display:'inline-block' }} />}
                              <span style={{ fontSize:'13px', fontWeight:600, color:'#f4f4f5' }}>{conta.nome}</span>
                              <span style={{ fontSize:'11px', color:'#71717a' }}>{conta.bancos?.nome_curto} · {conta.tipo}</span>
                            </div>
                            {!temTx && (
                              <button
                                onClick={() => router.push('/dashboard/lancamento')}
                                style={{ fontSize:'11px', color:'#f87171', background:'rgba(220,38,38,0.1)', border:'1px solid rgba(220,38,38,0.3)', borderRadius:'6px', padding:'3px 10px', cursor:'pointer' }}
                              >
                                Importar
                              </button>
                            )}
                          </div>
                          {temTx ? (
                            <>
                              <div style={{ height:'10px', background:'rgba(63,63,70,0.5)', borderRadius:'5px', overflow:'hidden', marginBottom:'6px' }}>
                                <div style={{ height:'100%', width:`${pct}%`, background:cor, borderRadius:'5px' }} />
                              </div>
                              <div style={{ display:'flex', gap:'16px', fontSize:'12px' }}>
                                <span style={{ color:'#71717a' }}>{d.total_tx} transações</span>
                                {d.valor_debito > 0 && <span style={{ color:'#f87171' }}>−{fmtBRL(d.valor_debito)}</span>}
                                {d.valor_credito > 0 && <span style={{ color:'#4ade80' }}>+{fmtBRL(d.valor_credito)}</span>}
                              </div>
                            </>
                          ) : (
                            <p style={{ fontSize:'12px', color:'#52525b', margin:0 }}>Nenhuma importação para este mês</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Futuro */}
                {isFuturo && (
                  <div style={{ padding:'4px 16px 12px' }}>
                    <p style={{ fontSize:'12px', color:'#3f3f46', margin:0 }}>Mês ainda não disponível</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Transferências entre contas */}
      {transferencias.length > 0 && (
        <div style={{ marginTop:'32px' }}>
          <h2 style={{ fontSize:'15px', fontWeight:600, color:'#e4e4e7', marginBottom:'12px' }}>
            Transferências entre contas
            <span style={{ fontSize:'12px', color:'#52525b', fontWeight:400, marginLeft:'8px' }}>pagamentos de fatura detectados</span>
          </h2>
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {transferencias.map(tr => {
              const saida   = contasMap[tr.conta_saida_id || '']
              const entrada = contasMap[tr.conta_entrada_id || '']
              const key = `${tr.tx_saida_id}-${tr.tx_entrada_id}`
              const exp = expandidos.has(key)
              const dtFmt = `${tr.data.slice(8,10)}/${tr.data.slice(5,7)}/${tr.data.slice(0,4)}`
              return (
                <div key={key} style={{ borderRadius:'10px', border:'1px solid rgba(63,63,70,0.4)', background:'rgba(24,24,27,0.6)', overflow:'hidden' }}>
                  <button
                    onClick={() => toggle(key)}
                    style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', background:'transparent', border:'none', cursor:'pointer', color:'#e4e4e7', textAlign:'left' }}
                  >
                    <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                      <span style={{ fontSize:'18px' }}>↔</span>
                      <div>
                        <div style={{ fontSize:'13px', fontWeight:500 }}>{tr.descricao}</div>
                        <div style={{ fontSize:'11px', color:'#71717a', marginTop:'2px' }}>{dtFmt}</div>
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                      <span style={{ fontSize:'14px', fontWeight:600 }}>{fmtBRL(tr.valor)}</span>
                      <span style={{ fontSize:'12px', color:'#52525b' }}>{exp ? '▾' : '▸'}</span>
                    </div>
                  </button>
                  {exp && (
                    <div style={{ borderTop:'1px solid rgba(63,63,70,0.4)', padding:'12px 16px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
                      <div style={{ display:'flex', gap:'8px' }}>
                        <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:'#ef4444', marginTop:'6px', flexShrink:0 }} />
                        <div>
                          <div style={{ fontSize:'11px', color:'#71717a', marginBottom:'2px' }}>Saiu de</div>
                          <div style={{ fontSize:'13px', fontWeight:500 }}>{saida?.nome || <em style={{ color:'#71717a' }}>não vinculada</em>}</div>
                          {saida?.bancos && <div style={{ fontSize:'11px', color:'#71717a' }}>{saida.bancos.nome_curto}</div>}
                          <div style={{ fontSize:'13px', fontWeight:600, color:'#f87171', marginTop:'4px' }}>−{fmtBRL(tr.valor)}</div>
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:'8px' }}>
                        <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:'#22c55e', marginTop:'6px', flexShrink:0 }} />
                        <div>
                          <div style={{ fontSize:'11px', color:'#71717a', marginBottom:'2px' }}>Entrou em</div>
                          <div style={{ fontSize:'13px', fontWeight:500 }}>{entrada?.nome || <em style={{ color:'#71717a' }}>não vinculada</em>}</div>
                          {entrada?.bancos && <div style={{ fontSize:'11px', color:'#71717a' }}>{entrada.bancos.nome_curto}</div>}
                          <div style={{ fontSize:'13px', fontWeight:600, color:'#4ade80', marginTop:'4px' }}>+{fmtBRL(tr.valor)}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {transferencias.length === 0 && contas.length > 0 && (
        <div style={{ marginTop:'32px', borderRadius:'10px', border:'1px solid rgba(63,63,70,0.3)', background:'rgba(24,24,27,0.4)', padding:'20px', textAlign:'center' }}>
          <div style={{ fontSize:'13px', color:'#52525b' }}>Nenhuma transferência entre contas detectada no período.</div>
          <div style={{ fontSize:'12px', color:'#3f3f46', marginTop:'4px' }}>Detectadas automaticamente ao importar faturas de cartão.</div>
        </div>
      )}
    </div>
  )
}
