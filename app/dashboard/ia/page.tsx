'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'


interface Mensagem {
  role: 'user' | 'assistant'
  content: string
}

const PERGUNTAS_RAPIDAS = [
  'Onde posso economizar mais?',
  'Qual minha categoria mais cara?',
  'Estou no caminho certo?',
  'Quanto posso gastar hoje sem comprometer as metas?',
  'Me dê 3 dicas para o mês que vem',
  'Analise meu padrão de gastos',
]

function fmtHora(date: Date) {
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default function IAPage() {
  const router = useRouter()
  const supabase = createClient()
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  const [msgs, setMsgs]         = useState<Mensagem[]>([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [nomeUser, setNomeUser] = useState('')
  const [horarios, setHorarios] = useState<string[]>([])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: p } = await supabase.from('profiles').select('nome').eq('id', user.id).single()
      if (p) setNomeUser(p.nome)

      // Mensagem inicial
      setMsgs([{
        role: 'assistant',
        content: `Olá${p?.nome ? `, ${p.nome}` : ''}! 👋 Sou o **PoupaBot**, seu assistente financeiro inteligente.\n\nTenho acesso aos seus dados reais — transações, metas e métricas — e posso te ajudar a tomar decisões financeiras melhores.\n\nComo posso te ajudar hoje?`,
      }])
      setHorarios([fmtHora(new Date())])
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, loading])

  async function enviar(texto?: string) {
    const msg = texto || input.trim()
    if (!msg || loading) return
    setInput('')

    const novaMensagem: Mensagem = { role: 'user', content: msg }
    const novoHistorico = [...msgs, novaMensagem]
    setMsgs(novoHistorico)
    setHorarios(prev => [...prev, fmtHora(new Date())])
    setLoading(true)

    try {
      const res = await fetch('/api/ia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensagem: msg,
          historico: msgs.map(m => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()
      const resposta = data.resposta || data.error || 'Erro ao processar.'
      setMsgs(prev => [...prev, { role: 'assistant', content: resposta }])
      setHorarios(prev => [...prev, fmtHora(new Date())])
    } catch {
      setMsgs(prev => [...prev, { role: 'assistant', content: 'Erro de conexão. Tente novamente.' }])
      setHorarios(prev => [...prev, fmtHora(new Date())])
    }
    setLoading(false)
    inputRef.current?.focus()
  }

  function renderTexto(texto: string) {
    // Renderizar **negrito** e quebras de linha
    return texto.split('\n').map((linha, i) => (
      <span key={i}>
        {linha.split(/(\*\*[^*]+\*\*)/).map((parte, j) =>
          parte.startsWith('**') && parte.endsWith('**')
            ? <strong key={j} style={{ color: '#fff', fontWeight: 600 }}>{parte.slice(2, -2)}</strong>
            : parte
        )}
        {i < texto.split('\n').length - 1 && <br />}
      </span>
    ))
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: 'system-ui, sans-serif', fontSize: 13, color: '#fff', display: 'flex', flexDirection: 'column' }}>

      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.875rem 1.5rem', borderBottom: '1px solid #1a3a1a', background: '#0a1a0a', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.4)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Dashboard
          </button>
          <span style={{ color: 'rgba(255,255,255,.2)' }}>/</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5" stroke="#fff" strokeWidth="1.2"/><circle cx="7" cy="7" r="2" fill="#fff"/></svg>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>PoupaBot</div>
              <div style={{ fontSize: 10, color: '#4ade80' }}>● online — com acesso aos seus dados</div>
            </div>
          </div>
        </div>
        <button onClick={() => { setMsgs([]); setHorarios([]) }} style={{ fontSize: 11, padding: '5px 10px', background: 'rgba(255,255,255,.06)', border: '1px solid #1a3a1a', borderRadius: 6, color: 'rgba(255,255,255,.4)', cursor: 'pointer' }}>
          Limpar conversa
        </button>
      </div>

      {/* Mensagens */}
      <div style={{ flex: 1, overflow: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 760, width: '100%', margin: '0 auto' }}>

        {msgs.map((m, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start', gap: 4 }}>
            {/* Avatar + nome */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {m.role === 'assistant' && (
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="4" stroke="#fff" strokeWidth="1.2"/><circle cx="6" cy="6" r="1.5" fill="#fff"/></svg>
                </div>
              )}
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,.3)' }}>
                {m.role === 'assistant' ? 'PoupaBot' : nomeUser || 'Você'} · {horarios[i] || ''}
              </span>
              {m.role === 'user' && (
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#534AB7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 10, fontWeight: 500 }}>
                  {nomeUser?.[0]?.toUpperCase() || 'U'}
                </div>
              )}
            </div>

            {/* Balão */}
            <div style={{
              maxWidth: '85%',
              padding: '10px 14px',
              borderRadius: m.role === 'user' ? '14px 0 14px 14px' : '0 14px 14px 14px',
              background: m.role === 'user' ? '#16a34a' : '#111',
              border: m.role === 'assistant' ? '1px solid #1a3a1a' : 'none',
              fontSize: 13, color: m.role === 'user' ? '#fff' : 'rgba(255,255,255,.85)',
              lineHeight: 1.65,
            }}>
              {renderTexto(m.content)}
            </div>
          </div>
        ))}

        {/* Digitando */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="4" stroke="#fff" strokeWidth="1.2"/><circle cx="6" cy="6" r="1.5" fill="#fff"/></svg>
              </div>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,.3)' }}>PoupaBot está analisando seus dados...</span>
            </div>
            <div style={{ padding: '10px 14px', borderRadius: '0 14px 14px 14px', background: '#111', border: '1px solid #1a3a1a', display: 'flex', gap: 5 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 6, height: 6, borderRadius: '50%', background: '#4ade80',
                  animation: 'pulse 1.2s ease-in-out infinite',
                  animationDelay: `${i * 0.2}s`,
                  opacity: 0.5,
                }} />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Perguntas rápidas */}
      {msgs.length <= 1 && (
        <div style={{ padding: '0 1.5rem', maxWidth: 760, width: '100%', margin: '0 auto' }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>Perguntas rápidas</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: '1rem' }}>
            {PERGUNTAS_RAPIDAS.map(p => (
              <button key={p} onClick={() => enviar(p)} style={{
                fontSize: 11, padding: '6px 12px', borderRadius: 20,
                border: '1px solid #1a3a1a', background: 'rgba(255,255,255,.03)',
                color: 'rgba(255,255,255,.6)', cursor: 'pointer', transition: 'all .15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#4ade80'; e.currentTarget.style.color = '#4ade80' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#1a3a1a'; e.currentTarget.style.color = 'rgba(255,255,255,.6)' }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #1a3a1a', background: '#0a1a0a', flexShrink: 0 }}>
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', gap: 8 }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && enviar()}
            placeholder="Pergunte qualquer coisa sobre suas finanças..."
            disabled={loading}
            style={{
              flex: 1, padding: '11px 14px',
              background: '#111', border: '1px solid #1a3a1a',
              borderRadius: 10, color: '#fff', fontSize: 13, outline: 'none',
              opacity: loading ? 0.6 : 1,
            }}
          />
          <button onClick={() => enviar()} disabled={loading || !input.trim()} style={{
            padding: '11px 18px', background: input.trim() && !loading ? '#16a34a' : 'rgba(255,255,255,.06)',
            border: 'none', borderRadius: 10, color: input.trim() && !loading ? '#fff' : 'rgba(255,255,255,.3)',
            cursor: input.trim() && !loading ? 'pointer' : 'default',
            fontSize: 13, fontWeight: 500, transition: 'all .15s', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M12 7L2 2l2 5-2 5 10-5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>
            Enviar
          </button>
        </div>
        <div style={{ maxWidth: 760, margin: '6px auto 0', fontSize: 10, color: 'rgba(255,255,255,.2)', textAlign: 'center' }}>
          PoupaBot analisa seus dados reais de transações e metas para responder
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  )
}