'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { usePerfil } from '@/hooks/usePerfil'
import { calcularXP, calcularNivel, NIVEIS } from '@/lib/calcularXP'

interface Transacao {
  id: string
  valor: number
  tipo: 'debito' | 'credito'
  categoria: string
  data_hora: string
}

interface Meta {
  id: string
  nome: string
  valor_total: number
  valor_atual: number
  ativo: boolean
}

interface Conquista {
  id: string
  nome: string
  desc: string
  emoji: string
  xp: number
  conquistado: boolean
  progresso?: number
  total?: number
}

function fmtBRL(v: number) {
  return 'R$ ' + Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function EvolucaoPage() {
  const router = useRouter()
  const supabase = createClient()
  const { fmtDataHora } = usePerfil()

  const [transacoes, setTransacoes] = useState<Transacao[]>([])
  const [metas, setMetas]           = useState<Meta[]>([])
  const [nome, setNome]             = useState('')
  const [loading, setLoading]       = useState(true)
  const [abaSel, setAbaSel]         = useState<'visao' | 'conquistas' | 'historico'>('visao')

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const [{ data: tx }, { data: mt }, { data: prof }] = await Promise.all([
      supabase.from('transactions').select('*').eq('user_id', user.id).order('data_hora', { ascending: false }),
      supabase.from('goals').select('*').eq('user_id', user.id),
      supabase.from('profiles').select('nome').eq('id', user.id).single(),
    ])

    if (tx) setTransacoes(tx)
    if (mt) setMetas(mt)
    if (prof) setNome(prof.nome)
    setLoading(false)
  }, [supabase, router])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar()
  }, [carregar])

  const xp         = calcularXP({ transacoes, metas })
  const { receitas, despesas, saldo, xpTotal, xpTransacoes, xpSaldo, xpMetas: xpMetasTotal } = xp
  const nivel      = calcularNivel(xpTotal)

  // Conquistas
  const conquistas: Conquista[] = [
    { id: 'cadastro',     nome: 'Bem-vindo!',          desc: 'Criou sua conta no PoupaUp',         emoji: '🎉', xp: 50,  conquistado: true },
    { id: 'primeira_tx',  nome: 'Primeiro registro',   desc: 'Registrou a primeira transação',      emoji: '📝', xp: 20,  conquistado: transacoes.length >= 1, progresso: Math.min(transacoes.length, 1), total: 1 },
    { id: 'dez_tx',       nome: 'Disciplinado',        desc: 'Registrou 10 transações',             emoji: '💪', xp: 100, conquistado: transacoes.length >= 10, progresso: Math.min(transacoes.length, 10), total: 10 },
    { id: 'cem_tx',       nome: 'Consistente',         desc: 'Registrou 100 transações',            emoji: '🏆', xp: 500, conquistado: transacoes.length >= 100, progresso: Math.min(transacoes.length, 100), total: 100 },
    { id: 'saldo_pos',    nome: 'No azul',             desc: 'Terminou um período com saldo positivo', emoji: '💚', xp: 100, conquistado: saldo > 0 },
    { id: 'meta_criada',  nome: 'Sonhador',            desc: 'Criou a primeira meta',               emoji: '🎯', xp: 50,  conquistado: metas.length >= 1, progresso: Math.min(metas.length, 1), total: 1 },
    { id: 'meta_concl',   nome: 'Realizador',          desc: 'Concluiu uma meta',                   emoji: '⭐', xp: 200, conquistado: metas.filter(m => m.valor_atual >= m.valor_total).length >= 1 },
    { id: 'tres_metas',   nome: 'Planejador',          desc: 'Tem 3 metas ativas',                  emoji: '📊', xp: 150, conquistado: metas.filter(m => m.ativo).length >= 3, progresso: Math.min(metas.filter(m => m.ativo).length, 3), total: 3 },
    { id: 'economizou',   nome: 'Poupador',            desc: 'Poupou mais de R$ 500',               emoji: '🐷', xp: 200, conquistado: saldo >= 500 },
    { id: 'economizou5k', nome: 'Investidor iniciante', desc: 'Poupou mais de R$ 5.000',            emoji: '💰', xp: 500, conquistado: saldo >= 5000 },
    { id: 'nivel3',       nome: 'Evoluindo',           desc: 'Chegou ao nível 3',                   emoji: '🚀', xp: 100, conquistado: nivel.nivel >= 3 },
    { id: 'nivel5',       nome: 'Dedicado',            desc: 'Chegou ao nível 5',                   emoji: '🌟', xp: 300, conquistado: nivel.nivel >= 5 },
  ]

  const conquistadas   = conquistas.filter(c => c.conquistado)
  const naoConquistadas = conquistas.filter(c => !c.conquistado)
  const xpConquistas   = conquistadas.reduce((a, c) => a + c.xp, 0)

  // Histórico de XP (últimas transações como eventos)
  const historico = [
    ...transacoes.slice(0, 8).map(t => ({
      data: t.data_hora,
      desc: t.tipo === 'credito' ? `Receita: ${fmtBRL(t.valor)}` : `Gasto registrado`,
      xp: 10,
      cor: '#4ade80',
    })),
    ...metas.filter(m => m.ativo).map(m => ({
      data: new Date().toISOString(),
      desc: `Meta ativa: ${m.nome}`,
      xp: 50,
      cor: '#a78bfa',
    })),
  ].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()).slice(0, 10)

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', fontFamily: 'system-ui' }}>Carregando evolução...</div>
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
          <span style={{ fontSize: 15, fontWeight: 500 }}>Evolução</span>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '1.5rem' }}>

        {/* Card nível atual */}
        <div style={{
          background: `linear-gradient(135deg, #0a1a0a 0%, ${nivel.cor}18 100%)`,
          border: `1px solid ${nivel.cor}44`, borderRadius: 16, padding: '1.5rem', marginBottom: '1.5rem',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: `${nivel.cor}08` }} />
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Seu nível atual</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontSize: 36, fontWeight: 700, color: nivel.cor }}>Lv.{nivel.nivel}</span>
                <span style={{ fontSize: 18, fontWeight: 500, color: '#fff' }}>{nivel.nome}</span>
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', marginTop: 4 }}>
                Olá, {nome}! Você está entre os melhores usuários.
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#fbbf24' }}>{xpTotal.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>XP total</div>
            </div>
          </div>

          {/* Barra de progresso */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,.5)' }}>
                {nivel.xpNoNivel.toLocaleString()} / {nivel.xpParaProximo.toLocaleString()} XP
              </span>
              {nivel.proximoNivel ? (
                <span style={{ fontSize: 11, color: nivel.cor }}>
                  Próximo: Lv.{nivel.proximoNivel.nivel} {nivel.proximoNivel.nome}
                </span>
              ) : (
                <span style={{ fontSize: 11, color: '#fbbf24' }}>Nível máximo! 🏆</span>
              )}
            </div>
            <div style={{ height: 10, background: 'rgba(255,255,255,.08)', borderRadius: 5, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${nivel.pct}%`, background: `linear-gradient(90deg, ${nivel.cor}88, ${nivel.cor})`, borderRadius: 5, transition: 'width .8s ease' }} />
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', marginTop: 4 }}>
              {nivel.proximoNivel ? `Faltam ${(nivel.xpParaProximo - nivel.xpNoNivel).toLocaleString()} XP para o próximo nível` : 'Você chegou ao topo!'}
            </div>
          </div>
        </div>

        {/* Cards de métricas XP */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 10, marginBottom: '1.5rem' }}>
          {[
            { label: 'XP de transações', val: xpTransacoes, desc: `${transacoes.length} registros × 10`, cor: '#4ade80' },
            { label: 'XP de saldo',      val: xpSaldo,      desc: `saldo R$ ${saldo.toFixed(0)} ÷ 10`, cor: saldo >= 0 ? '#22d3ee' : '#f87171' },
            { label: 'XP de metas',      val: xpMetasTotal, desc: `${metas.filter(m => m.ativo).length} ativas + ${metas.filter(m => m.valor_atual >= m.valor_total).length} concluídas`, cor: '#a78bfa' },
            { label: 'XP de conquistas', val: xpConquistas, desc: `${conquistadas.length} de ${conquistas.length} desbloqueadas`, cor: '#fbbf24' },
          ].map(m => (
            <div key={m.label} style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>{m.label}</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: m.cor, marginBottom: 2 }}>+{m.val.toLocaleString()}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)' }}>{m.desc}</div>
            </div>
          ))}
        </div>

        {/* Abas */}
        <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,.3)', border: '1px solid #1a3a1a', borderRadius: 8, padding: 3, marginBottom: '1.25rem', width: 'fit-content' }}>
          {([
            { id: 'visao',      label: 'Visão geral' },
            { id: 'conquistas', label: `Conquistas (${conquistadas.length}/${conquistas.length})` },
            { id: 'historico',  label: 'Histórico de XP' },
          ] as const).map(a => (
            <button key={a.id} onClick={() => setAbaSel(a.id)} style={{
              padding: '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
              background: abaSel === a.id ? '#16a34a' : 'transparent',
              color: abaSel === a.id ? '#fff' : 'rgba(255,255,255,.4)',
            }}>{a.label}</button>
          ))}
        </div>

        {/* ── VISÃO GERAL ── */}
        {abaSel === 'visao' && (
          <div>
            {/* Todos os níveis */}
            <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 12, padding: '1rem', marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,.5)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 14 }}>Jornada de níveis</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {NIVEIS.map((n, i) => {
                  const atingido = xpTotal >= n.min
                  const atual    = nivel.nivel === n.nivel
                  return (
                    <div key={n.nivel} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                        background: atingido ? `${n.cor}22` : 'rgba(255,255,255,.04)',
                        border: `2px solid ${atual ? n.cor : atingido ? n.cor+'44' : '#1a3a1a'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700, color: atingido ? n.cor : 'rgba(255,255,255,.2)',
                        boxShadow: atual ? `0 0 12px ${n.cor}44` : 'none',
                      }}>
                        {atingido ? n.nivel : n.nivel}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: atual ? 600 : 400, color: atingido ? '#fff' : 'rgba(255,255,255,.3)' }}>{n.nome}</span>
                          {atual && <span style={{ fontSize: 9, background: `${n.cor}22`, color: n.cor, padding: '1px 7px', borderRadius: 8, fontWeight: 600 }}>ATUAL</span>}
                          {atingido && !atual && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><polyline points="1.5,6 4.5,9 10.5,3" stroke={n.cor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)' }}>{n.min.toLocaleString()} XP{NIVEIS[i+1] ? ` — ${(NIVEIS[i+1].min - 1).toLocaleString()} XP` : '+'}</div>
                      </div>
                      {atual && (
                        <div style={{ fontSize: 11, color: n.cor, fontWeight: 500 }}>{nivel.pct}%</div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Como ganhar XP */}
            <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 12, padding: '1rem' }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,.5)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>Como ganhar mais XP</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { emoji: '📝', acao: 'Registrar transação',       xp: '+10 XP' },
                  { emoji: '💚', acao: 'Manter saldo positivo',      xp: 'saldo ÷ 10' },
                  { emoji: '🎯', acao: 'Criar uma meta',             xp: '+50 XP' },
                  { emoji: '⭐', acao: 'Concluir uma meta',          xp: '+200 XP' },
                  { emoji: '🏆', acao: 'Desbloquear conquista',      xp: '+20 a 500 XP' },
                  { emoji: '📅', acao: 'Usar o app todo dia',        xp: 'em breve' },
                ].map(item => (
                  <div key={item.acao} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: '#0a1a0a', borderRadius: 8 }}>
                    <span style={{ fontSize: 18 }}>{item.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,.7)' }}>{item.acao}</div>
                      <div style={{ fontSize: 11, color: '#4ade80', fontWeight: 500 }}>{item.xp}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── CONQUISTAS ── */}
        {abaSel === 'conquistas' && (
          <div>
            {conquistadas.length > 0 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>
                  ✓ Desbloqueadas ({conquistadas.length})
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 10 }}>
                  {conquistadas.map(c => (
                    <div key={c.id} style={{ background: 'rgba(74,222,128,.06)', border: '1px solid rgba(74,222,128,.2)', borderRadius: 12, padding: '14px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ fontSize: 28, flexShrink: 0 }}>{c.emoji}</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 2 }}>{c.nome}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', marginBottom: 6 }}>{c.desc}</div>
                        <div style={{ fontSize: 11, color: '#4ade80', fontWeight: 500 }}>+{c.xp} XP</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {naoConquistadas.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>
                  🔒 Bloqueadas ({naoConquistadas.length})
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 10 }}>
                  {naoConquistadas.map(c => (
                    <div key={c.id} style={{ background: 'rgba(255,255,255,.03)', border: '1px solid #1a3a1a', borderRadius: 12, padding: '14px', display: 'flex', gap: 12, alignItems: 'flex-start', opacity: 0.6 }}>
                      <div style={{ fontSize: 28, flexShrink: 0, filter: 'grayscale(1)' }}>{c.emoji}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.5)', marginBottom: 2 }}>{c.nome}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', marginBottom: 6 }}>{c.desc}</div>
                        {c.progresso !== undefined && c.total !== undefined && (
                          <>
                            <div style={{ height: 4, background: 'rgba(255,255,255,.08)', borderRadius: 2, overflow: 'hidden', marginBottom: 3 }}>
                              <div style={{ height: '100%', width: `${Math.round((c.progresso / c.total) * 100)}%`, background: '#4ade80', borderRadius: 2 }} />
                            </div>
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)' }}>{c.progresso}/{c.total}</div>
                          </>
                        )}
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>+{c.xp} XP</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── HISTÓRICO XP ── */}
        {abaSel === 'historico' && (
          <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 12, padding: '1rem' }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,.5)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>Últimas atividades</div>
            {historico.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'rgba(255,255,255,.3)', fontSize: 13 }}>
                Nenhuma atividade ainda. Lance transações para começar a ganhar XP!
              </div>
            ) : historico.map((h, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid #1a2a1a' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${h.cor}18`, border: `1px solid ${h.cor}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1l1.2 3.5H11L8 6.8l1.2 3.5L6 8.5 3 10.3l1.2-3.5L1 4.5h3.8L6 1z" fill={h.cor}/></svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: '#fff' }}>{h.desc}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', marginTop: 1 }}>
                    {fmtDataHora(h.data)}
                  </div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: h.cor }}>+{h.xp} XP</div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
