'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import GranaUpLogo from '@/components/GranaUpLogo'

interface Meta {
  id: string
  nome: string
  tipo: 'acumulacao' | 'emergencia' | 'limite'
  valor_total: number
  valor_atual: number
  contribuicao_mensal: number | null
  prazo: string | null
  categoria_vinculada: string | null
  ativo: boolean
  created_at: string
}

interface AlertaRegra {
  id: string
  tipo: string
  ativo: boolean
  canais: string[]
  threshold_pct: number | null
}

const MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']

function fmtBRL(v: number) {
  return 'R$ ' + Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function calcPrevisao(total: number, atual: number, contrib: number) {
  if (!contrib || contrib <= 0) return null
  const meses = Math.ceil((total - atual) / contrib)
  if (meses <= 0) return 'Concluída!'
  const d = new Date()
  d.setMonth(d.getMonth() + meses)
  return `${MESES[d.getMonth()]}/${String(d.getFullYear()).slice(2)} (${meses} meses)`
}

function PctBar({ pct, cor = '#4ade80' }: { pct: number; cor?: string }) {
  return (
    <div style={{ height: 6, background: 'rgba(255,255,255,.06)', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: cor, borderRadius: 3, transition: 'width .5s' }} />
    </div>
  )
}

export default function MetasPage() {
  const router = useRouter()
  const supabase = createClient()

  const [metas, setMetas]         = useState<Meta[]>([])
  const [alertas, setAlertas]     = useState<AlertaRegra[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [metaSel, setMetaSel]     = useState<Meta | null>(null)
  const [salvando, setSalvando]   = useState(false)
  const [erro, setErro]           = useState('')
  const [abaSel, setAbaSel]       = useState<'metas' | 'alertas'>('metas')

  const [form, setForm] = useState({
    nome: '', tipo: 'acumulacao', valor_total: '',
    valor_atual: '0', contribuicao_mensal: '', prazo: '', categoria_vinculada: '',
  })

  async function carregar() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const [{ data: mt }, { data: al }] = await Promise.all([
      supabase.from('goals').select('*').eq('user_id', user.id).eq('ativo', true).order('created_at', { ascending: false }),
      supabase.from('alert_rules').select('*').eq('user_id', user.id),
    ])
    if (mt) setMetas(mt)
    if (al) setAlertas(al)
    setLoading(false)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function salvarMeta(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (!form.nome.trim()) { setErro('Nome obrigatório'); return }
    if (!form.valor_total || parseFloat(form.valor_total) <= 0) { setErro('Valor total inválido'); return }

    setSalvando(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const payload = {
      user_id: user.id,
      nome: form.nome.trim(),
      tipo: form.tipo,
      valor_total: parseFloat(form.valor_total),
      valor_atual: parseFloat(form.valor_atual) || 0,
      contribuicao_mensal: form.contribuicao_mensal ? parseFloat(form.contribuicao_mensal) : null,
      prazo: form.prazo || null,
      categoria_vinculada: form.categoria_vinculada || null,
      ativo: true,
    }

    if (metaSel) {
      await supabase.from('goals').update(payload).eq('id', metaSel.id)
    } else {
      await supabase.from('goals').insert(payload)
    }

    setSalvando(false)
    setShowForm(false)
    setMetaSel(null)
    resetForm()
    carregar()
  }

  async function excluirMeta(id: string) {
    await supabase.from('goals').update({ ativo: false }).eq('id', id)
    carregar()
  }

  async function toggleAlerta(id: string, ativo: boolean) {
    await supabase.from('alert_rules').update({ ativo: !ativo }).eq('id', id)
    carregar()
  }

  async function toggleCanal(id: string, canal: string, canais: string[]) {
    const novos = canais.includes(canal)
      ? canais.filter(c => c !== canal)
      : [...canais, canal]
    await supabase.from('alert_rules').update({ canais: novos }).eq('id', id)
    carregar()
  }

  function editarMeta(m: Meta) {
    setMetaSel(m)
    setForm({
      nome: m.nome, tipo: m.tipo,
      valor_total: String(m.valor_total),
      valor_atual: String(m.valor_atual),
      contribuicao_mensal: m.contribuicao_mensal ? String(m.contribuicao_mensal) : '',
      prazo: m.prazo ? m.prazo.slice(0, 7) : '',
      categoria_vinculada: m.categoria_vinculada || '',
    })
    setShowForm(true)
  }

  function resetForm() {
    setForm({ nome: '', tipo: 'acumulacao', valor_total: '', valor_atual: '0', contribuicao_mensal: '', prazo: '', categoria_vinculada: '' })
    setMetaSel(null)
    setErro('')
  }

  const previsao = calcPrevisao(
    parseFloat(form.valor_total) || 0,
    parseFloat(form.valor_atual) || 0,
    parseFloat(form.contribuicao_mensal) || 0
  )

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <GranaUpLogo mode="compact" />
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)' }}>Carregando metas...</div>
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
          <span style={{ fontSize: 15, fontWeight: 500 }}>Metas</span>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true) }} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
          background: '#16a34a', border: 'none', borderRadius: 8,
          color: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer',
        }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          Nova meta
        </button>
      </div>

      <div style={{ padding: '1.5rem' }}>

        {/* Abas */}
        <div style={{ display: 'flex', gap: 5, background: 'rgba(0,0,0,.3)', border: '1px solid #1a3a1a', borderRadius: 8, padding: 3, marginBottom: '1.5rem', width: 'fit-content' }}>
          {(['metas', 'alertas'] as const).map(a => (
            <button key={a} onClick={() => setAbaSel(a)} style={{
              padding: '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
              background: abaSel === a ? '#16a34a' : 'transparent',
              color: abaSel === a ? '#fff' : 'rgba(255,255,255,.4)',
            }}>
              {a === 'metas' ? `Minhas metas (${metas.length})` : `Alertas (${alertas.length})`}
            </button>
          ))}
        </div>

        {/* ── METAS ── */}
        {abaSel === 'metas' && (
          <>
            {metas.length === 0 ? (
              <div style={{ background: '#111', border: '1px dashed #1a3a1a', borderRadius: 12, padding: '3rem', textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🎯</div>
                <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>Nenhuma meta ainda</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', marginBottom: 20 }}>Crie sua primeira meta e comece a acumular XP</div>
                <button onClick={() => { resetForm(); setShowForm(true) }} style={{ padding: '9px 20px', background: '#16a34a', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                  Criar primeira meta
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
                {metas.map(m => {
                  const pct = m.valor_total > 0 ? Math.min(Math.round((m.valor_atual / m.valor_total) * 100), 100) : 0
                  const prev = calcPrevisao(m.valor_total, m.valor_atual, m.contribuicao_mensal || 0)
                  const cor = pct >= 100 ? '#4ade80' : pct >= 50 ? '#22d3ee' : '#16a34a'
                  return (
                    <div key={m.id} style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 12, padding: '1.1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>{m.nome}</div>
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                            {m.tipo === 'acumulacao' ? 'Acumulação' : m.tipo === 'emergencia' ? 'Emergência' : 'Limite mensal'}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => editarMeta(m)} style={{ background: 'rgba(255,255,255,.06)', border: 'none', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: 'rgba(255,255,255,.5)', fontSize: 11 }}>
                            Editar
                          </button>
                          <button onClick={() => excluirMeta(m.id)} style={{ background: 'rgba(239,68,68,.1)', border: 'none', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: '#f87171', fontSize: 11 }}>
                            Excluir
                          </button>
                        </div>
                      </div>

                      {/* Valores */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                        <div style={{ fontSize: 22, fontWeight: 500, color: cor }}>{fmtBRL(m.valor_atual)}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>de {fmtBRL(m.valor_total)}</div>
                      </div>

                      {/* Barra */}
                      <PctBar pct={pct} cor={cor} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, marginBottom: 10 }}>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,.35)' }}>{pct}% concluído</span>
                        {pct >= 100 && <span style={{ fontSize: 10, background: 'rgba(74,222,128,.15)', color: '#4ade80', padding: '1px 8px', borderRadius: 4 }}>✓ Concluída!</span>}
                      </div>

                      {/* Detalhes */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, paddingTop: 10, borderTop: '1px solid #1a3a1a' }}>
                        {m.contribuicao_mensal && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                            <span style={{ color: 'rgba(255,255,255,.4)' }}>Contribuição/mês</span>
                            <span style={{ color: '#4ade80', fontWeight: 500 }}>{fmtBRL(m.contribuicao_mensal)}</span>
                          </div>
                        )}
                        {prev && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                            <span style={{ color: 'rgba(255,255,255,.4)' }}>Previsão</span>
                            <span style={{ color: '#fff' }}>{prev}</span>
                          </div>
                        )}
                        {m.prazo && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                            <span style={{ color: 'rgba(255,255,255,.4)' }}>Prazo</span>
                            <span style={{ color: '#fff' }}>{new Date(m.prazo).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}</span>
                          </div>
                        )}
                      </div>

                      {/* Marcos */}
                      <div style={{ display: 'flex', gap: 5, marginTop: 10 }}>
                        {[25, 50, 75, 100].map(marco => (
                          <div key={marco} style={{
                            flex: 1, textAlign: 'center', padding: '4px 0',
                            background: pct >= marco ? 'rgba(74,222,128,.15)' : 'rgba(255,255,255,.03)',
                            border: `1px solid ${pct >= marco ? 'rgba(74,222,128,.3)' : '#1a3a1a'}`,
                            borderRadius: 6, fontSize: 10,
                            color: pct >= marco ? '#4ade80' : 'rgba(255,255,255,.2)',
                          }}>
                            {marco}%
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ── ALERTAS ── */}
        {abaSel === 'alertas' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {alertas.length === 0 ? (
              <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 12, padding: '2rem', textAlign: 'center', color: 'rgba(255,255,255,.4)', fontSize: 13 }}>
                Nenhuma regra de alerta. As regras padrão são criadas automaticamente ao se cadastrar.
              </div>
            ) : alertas.map(a => (
              <div key={a.id} style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 12, padding: '1rem', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 3 }}>
                    {{
                      receita_recebida: '💰 Receita recebida — sugerir aporte',
                      marco_meta: '🎯 Marco de meta atingido (25/50/75/100%)',
                      limite_categoria: '⚠️ Categoria atingiu o limite',
                      fim_mes: '📅 Fim do mês sem contribuição',
                    }[a.tipo] || a.tipo}
                  </div>
                  <div style={{ display: 'flex', gap: 5, marginTop: 8 }}>
                    {['push', 'email', 'whatsapp'].map(canal => (
                      <button key={canal} onClick={() => toggleCanal(a.id, canal, a.canais)} style={{
                        fontSize: 10, padding: '3px 9px', borderRadius: 20, cursor: 'pointer',
                        border: `1px solid ${a.canais.includes(canal) ? 'rgba(74,222,128,.4)' : '#1a3a1a'}`,
                        background: a.canais.includes(canal) ? 'rgba(74,222,128,.1)' : 'transparent',
                        color: a.canais.includes(canal) ? '#4ade80' : 'rgba(255,255,255,.3)',
                        transition: 'all .15s',
                      }}>
                        {canal}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Toggle ativo */}
                <div onClick={() => toggleAlerta(a.id, a.ativo)} style={{
                  width: 36, height: 20, borderRadius: 10, cursor: 'pointer',
                  background: a.ativo ? '#16a34a' : 'rgba(255,255,255,.1)',
                  position: 'relative', transition: 'background .2s', flexShrink: 0, marginTop: 2,
                }}>
                  <div style={{
                    position: 'absolute', top: 3, left: a.ativo ? 18 : 3,
                    width: 14, height: 14, borderRadius: '50%', background: '#fff',
                    transition: 'left .2s',
                  }} />
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* ── MODAL CRIAR/EDITAR META ── */}
      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 50, padding: '1rem',
        }}>
          <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 16, padding: '1.5rem', width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: 16, fontWeight: 500 }}>{metaSel ? 'Editar meta' : 'Nova meta'}</div>
              <button onClick={() => { setShowForm(false); resetForm() }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.4)', fontSize: 18, lineHeight: 1 }}>×</button>
            </div>

            {erro && <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#f87171', marginBottom: 12 }}>{erro}</div>}

            <form onSubmit={salvarMeta}>
              {/* Tipo */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,.5)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>Tipo</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                  {[
                    { v: 'acumulacao', label: '📈 Acumulação' },
                    { v: 'emergencia', label: '🛡️ Emergência' },
                    { v: 'limite',     label: '⏱️ Limite' },
                  ].map(t => (
                    <button key={t.v} type="button" onClick={() => setForm(p => ({ ...p, tipo: t.v }))} style={{
                      padding: '8px 4px', borderRadius: 8, border: `1px solid ${form.tipo === t.v ? '#16a34a' : '#1a3a1a'}`,
                      background: form.tipo === t.v ? 'rgba(22,163,74,.15)' : 'transparent',
                      color: form.tipo === t.v ? '#4ade80' : 'rgba(255,255,255,.5)',
                      fontSize: 11, cursor: 'pointer', fontWeight: form.tipo === t.v ? 500 : 400,
                    }}>{t.label}</button>
                  ))}
                </div>
              </div>

              {/* Campos */}
              {[
                { label: 'Nome da meta', key: 'nome', type: 'text', placeholder: 'Ex: Viagem Europa, Reserva...' },
                { label: 'Valor total (R$)', key: 'valor_total', type: 'number', placeholder: '10000' },
                { label: 'Já tenho (R$)', key: 'valor_atual', type: 'number', placeholder: '0' },
                { label: 'Contribuição mensal (R$)', key: 'contribuicao_mensal', type: 'number', placeholder: '500' },
              ].map(f => (
                <div key={f.key} style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,.5)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' }}>{f.label}</label>
                  <input
                    type={f.type} placeholder={f.placeholder}
                    value={form[f.key as keyof typeof form]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', background: '#0a1a0a', border: '1px solid #1a3a1a', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none' }}
                  />
                </div>
              ))}

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,.5)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' }}>Prazo (opcional)</label>
                <input type="month" value={form.prazo} onChange={e => setForm(p => ({ ...p, prazo: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', background: '#0a1a0a', border: '1px solid #1a3a1a', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none' }}
                />
              </div>

              {/* Previsão dinâmica */}
              {previsao && (
                <div style={{ background: 'rgba(74,222,128,.07)', border: '1px solid rgba(74,222,128,.2)', borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>
                  <div style={{ fontSize: 10, color: 'rgba(74,222,128,.7)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>Previsão dinâmica</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#4ade80' }}>{previsao}</div>
                  {form.contribuicao_mensal && form.valor_total && (
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginTop: 3 }}>
                      guardando {fmtBRL(parseFloat(form.contribuicao_mensal))} por mês
                    </div>
                  )}
                </div>
              )}

              <button type="submit" disabled={salvando} style={{
                width: '100%', padding: 11, background: '#16a34a', border: 'none',
                borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 500,
                cursor: salvando ? 'default' : 'pointer', opacity: salvando ? 0.6 : 1,
              }}>
                {salvando ? 'Salvando...' : metaSel ? 'Salvar alterações' : 'Criar meta'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
