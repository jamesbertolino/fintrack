'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useCores, useTema } from '@/components/ThemeProvider'

const TOUR_KEY = 'poupaup_tour_v2'
const XP_TOUR  = 80

interface Passo {
  id: string
  titulo: string
  descricao: string
  emoji: string
  alvo?: string          // data-tour="..." no elemento
  posicao?: 'top' | 'bottom' | 'left' | 'right' | 'center'
  destaque?: string      // texto em destaque dentro da descrição
}

const PASSOS: Passo[] = [
  {
    id: 'bemvindo',
    emoji: '👋',
    titulo: 'Bem-vindo ao PoupaUp!',
    descricao: 'Em menos de 2 minutos você vai conhecer os 3 recursos que fazem a diferença de verdade — e ainda ganha XP por isso. Vamos lá?',
    posicao: 'center',
  },
  {
    id: 'painel',
    emoji: '📊',
    titulo: 'Seu painel em tempo real',
    descricao: 'Saldo, receitas, despesas e XP atualizados a cada transação. Tudo que você precisa saber sobre suas finanças em um relance.',
    alvo: 'tour-metricas',
    posicao: 'bottom',
  },
  {
    id: 'importar',
    emoji: '📎',
    titulo: 'Importe seu extrato — sem digitar nada',
    descricao: 'Baixe o extrato PDF ou a fatura do cartão no app do seu banco e arraste aqui. A IA lê o documento, detecta o banco, categoriza cada transação e lança tudo de uma vez. Funciona com qualquer banco brasileiro.',
    alvo: 'tour-nav-lancamento',
    posicao: 'right',
  },
  {
    id: 'whatsapp',
    emoji: '💬',
    titulo: 'Lance pelo WhatsApp — sem abrir o app',
    descricao: 'Mande uma mensagem no grupo: "farmácia R$45" ou "recebi salário 3200". A IA entende, categoriza e registra em segundos. Já está configurado — experimente agora mesmo no grupo do seu celular.',
    alvo: 'tour-perfil',
    posicao: 'right',
  },
  {
    id: 'gastos',
    emoji: '💸',
    titulo: 'Veja onde seu dinheiro vai',
    descricao: 'Gastos por categoria em gráfico. Quando quiser uma análise funda, clique em "Analisar com IA" e receba sugestões personalizadas baseadas no seu perfil e prioridades.',
    alvo: 'tour-nav-gastos',
    posicao: 'right',
  },
  {
    id: 'metas',
    emoji: '🎯',
    titulo: 'Metas que se atualizam sozinhas',
    descricao: 'Crie um objetivo — "Reserva de emergência", "Viagem", "Carro". O app calcula automaticamente quanto guardar por mês e quando você vai chegar lá.',
    alvo: 'tour-nav-metas',
    posicao: 'right',
  },
  {
    id: 'ia',
    emoji: '🤖',
    titulo: 'Assistente IA sempre disponível',
    descricao: 'Pergunte qualquer coisa: "Estou gastando demais em alimentação?", "Como montar uma reserva?", "Me faça um plano para quitar minha dívida." A IA conhece seus dados e responde com contexto real.',
    alvo: 'tour-nav-ia',
    posicao: 'right',
  },
  {
    id: 'medieval',
    emoji: '🏰',
    titulo: 'Dica: ative o tema Medieval',
    descricao: 'Se curte um visual diferente — vá em Perfil → Tema → Medieval. O app vira um RPG financeiro: você é um Cavaleiro acumulando ouro, completando quests e subindo de nível. Experiência única para quem curte gamificação de verdade.',
    alvo: 'tour-perfil',
    posicao: 'right',
  },
  {
    id: 'conclusao',
    emoji: '🏆',
    titulo: `Missão completa! +${XP_TOUR} XP`,
    descricao: 'Você já sabe o essencial. O próximo passo: importe seu extrato do mês passado e veja em segundos para onde foi seu dinheiro. Boa jornada!',
    posicao: 'center',
  },
]

interface Props {
  onConcluido?: () => void
}

export default function TourGuiado({ onConcluido }: Props) {
  const supabase   = createClient()
  const cores      = useCores()
  const { tema }   = useTema()
  const m          = tema === 'medieval'
  const accentColor = m ? '#D4AF37' : cores.accent

  const [ativo, setAtivo]         = useState(false)
  const [passo, setPasso]         = useState(0)
  const [spotlight, setSpotlight] = useState<DOMRect | null>(null)
  const [animando, setAnimando]   = useState(false)
  const [concluido, setConcluido] = useState(false)
  const rafRef = useRef<number>(0)

  // Verifica se deve mostrar o tour
  useEffect(() => {
    const visto = localStorage.getItem(TOUR_KEY)
    if (visto) return
    // Pequeno delay para a página carregar
    const t = setTimeout(() => setAtivo(true), 1200)
    return () => clearTimeout(t)
  }, [])

  // Atualiza spotlight quando muda de passo
  const atualizarSpotlight = useCallback(() => {
    const passoAtual = PASSOS[passo]
    if (!passoAtual?.alvo) { setSpotlight(null); return }

    const el = document.querySelector(`[data-tour="${passoAtual.alvo}"]`)
    if (!el) { setSpotlight(null); return }

    const rect = el.getBoundingClientRect()
    // Padding extra ao redor do elemento destacado
    const padding = 8
    setSpotlight(new DOMRect(
      rect.left - padding,
      rect.top - padding,
      rect.width + padding * 2,
      rect.height + padding * 2,
    ))
  }, [passo])

  useEffect(() => {
    if (!ativo) return
    atualizarSpotlight() // eslint-disable-line react-hooks/set-state-in-effect
    // Re-calcula no resize
    window.addEventListener('resize', atualizarSpotlight)
    return () => window.removeEventListener('resize', atualizarSpotlight)
  }, [ativo, passo, atualizarSpotlight])

  // Rola elemento destacado para a view
  useEffect(() => {
    if (!ativo) return
    const passoAtual = PASSOS[passo]
    if (!passoAtual?.alvo) return
    const el = document.querySelector(`[data-tour="${passoAtual.alvo}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [ativo, passo])

  async function concluirTour() {
    cancelAnimationFrame(rafRef.current)
    localStorage.setItem(TOUR_KEY, '1')
    setConcluido(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('xp_bonus').eq('id', user.id).single()
      await supabase.from('profiles').update({
        xp_bonus: (profile?.xp_bonus || 0) + XP_TOUR,
        tour_completo: true,
      }).eq('id', user.id)
    }

    setTimeout(() => {
      setAtivo(false)
      onConcluido?.()
    }, 1800)
  }

  function avancar() {
    if (animando) return
    setAnimando(true)
    setTimeout(() => setAnimando(false), 220)
    if (passo >= PASSOS.length - 1) {
      concluirTour()
    } else {
      setPasso(p => p + 1)
    }
  }

  function voltar() {
    if (passo > 0) setPasso(p => p - 1)
  }

  function pular() {
    concluirTour()
  }

  if (!ativo) return null

  const passoAtual  = PASSOS[passo]
  const eUltimo     = passo === PASSOS.length - 1
  const eCentral    = passoAtual.posicao === 'center' || !passoAtual.alvo
  const progresso   = Math.round(((passo + 1) / PASSOS.length) * 100)

  // Posição do tooltip em relação ao spotlight
  function calcTooltipStyle(): React.CSSProperties {
    if (eCentral || !spotlight) {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        maxWidth: 400,
        width: 'calc(100vw - 40px)',
      }
    }

    const vw = window.innerWidth
    const vh = window.innerHeight
    const tooltipW = Math.min(340, vw - 40)
    const tooltipH = 220 // estimado

    let top: number, left: number

    if (passoAtual.posicao === 'right') {
      top  = Math.min(spotlight.top, vh - tooltipH - 20)
      left = Math.min(spotlight.right + 16, vw - tooltipW - 16)
      if (left + tooltipW > vw - 16) left = spotlight.left - tooltipW - 16
    } else if (passoAtual.posicao === 'bottom') {
      top  = Math.min(spotlight.bottom + 16, vh - tooltipH - 16)
      left = Math.max(16, Math.min(spotlight.left, vw - tooltipW - 16))
    } else {
      top  = spotlight.top - tooltipH - 16
      if (top < 16) top = spotlight.bottom + 16
      left = Math.max(16, Math.min(spotlight.left, vw - tooltipW - 16))
    }

    return {
      position: 'fixed',
      top,
      left,
      width: tooltipW,
    }
  }

  return (
    <>
      <style>{`
        @keyframes tour-in  { from { opacity:0; transform:scale(.96) translateY(6px) } to { opacity:1; transform:none } }
        @keyframes tour-out { from { opacity:1 } to { opacity:0; transform:scale(.96) } }
        @keyframes xp-pop   { 0%{transform:scale(1)} 40%{transform:scale(1.25)} 100%{transform:scale(1)} }
      `}</style>

      {/* ── Overlay escurecido ── */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 8000,
        background: 'rgba(0,0,0,.72)',
        pointerEvents: eCentral ? 'all' : 'none',
      }}>
        {/* Spotlight — "buraco" iluminado no overlay */}
        {spotlight && !eCentral && (
          <div style={{
            position: 'absolute',
            top:    spotlight.top,
            left:   spotlight.left,
            width:  spotlight.width,
            height: spotlight.height,
            borderRadius: 10,
            boxShadow: `0 0 0 9999px rgba(0,0,0,.72), 0 0 0 3px ${accentColor}`,
            background: 'transparent',
            pointerEvents: 'none',
            transition: 'all .3s ease',
          }} />
        )}
      </div>

      {/* ── Tooltip / card do passo ── */}
      <div
        style={{
          ...calcTooltipStyle(),
          zIndex: 8100,
          background: cores.cardBg,
          border: `1px solid ${accentColor}44`,
          borderRadius: 16,
          padding: '22px 22px 18px',
          boxShadow: `0 24px 64px rgba(0,0,0,.6), 0 0 0 1px ${accentColor}22`,
          animation: animando ? 'tour-out .2s ease' : 'tour-in .22s ease',
          pointerEvents: 'all',
        }}
      >
        {/* Progresso */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1, height: 3, background: cores.border, borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progresso}%`, background: accentColor, borderRadius: 2, transition: 'width .4s' }} />
          </div>
          <span style={{ fontSize: 10, color: cores.textFaint, whiteSpace: 'nowrap' }}>{passo + 1}/{PASSOS.length}</span>
          <button onClick={pular} style={{ background: 'none', border: `1px solid ${cores.border}`, cursor: 'pointer', color: cores.textMuted, fontSize: 12, lineHeight: 1, padding: '10px 14px', minHeight: 44, borderRadius: 20, whiteSpace: 'nowrap' }}>
            Pular tour
          </button>
        </div>

        {/* Emoji + título */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: `${accentColor}18`, border: `1px solid ${accentColor}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
            animation: eUltimo && concluido ? 'xp-pop .5s ease' : 'none',
          }}>
            {passoAtual.emoji}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: cores.text, marginBottom: 4, fontFamily: m ? 'var(--font-cinzel, Georgia, serif)' : 'inherit', lineHeight: 1.3 }}>
              {passoAtual.titulo}
            </div>
          </div>
        </div>

        {/* Descrição */}
        <p style={{ fontSize: 13, color: cores.textMuted, lineHeight: 1.65, marginBottom: 18 }}>
          {passoAtual.descricao}
        </p>

        {/* XP badge no último passo */}
        {eUltimo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: `${accentColor}12`, border: `1px solid ${accentColor}30`, borderRadius: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 18 }}>⭐</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: accentColor }}>+{XP_TOUR} XP</div>
              <div style={{ fontSize: 10, color: cores.textFaint }}>Tour completo</div>
            </div>
          </div>
        )}

        {/* Botões */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={voltar}
            disabled={passo === 0}
            style={{
              padding: '10px 16px', minHeight: 44, borderRadius: 8, border: `1px solid ${cores.border}`,
              background: 'transparent', color: cores.textMuted, fontSize: 13,
              cursor: passo === 0 ? 'default' : 'pointer', opacity: passo === 0 ? 0 : 1,
              transition: 'opacity .2s',
            }}
          >
            ← Voltar
          </button>

          <div style={{ display: 'flex', gap: 6 }}>
            {/* Dots de progresso */}
            {PASSOS.map((_, i) => (
              <div key={i} style={{
                width: i === passo ? 16 : 6, height: 6, borderRadius: 3,
                background: i <= passo ? accentColor : cores.border,
                transition: 'all .3s',
              }} />
            ))}
          </div>

          <button
            onClick={avancar}
            style={{
              padding: '10px 20px', minHeight: 44, borderRadius: 8, border: 'none',
              background: eUltimo ? accentColor : `${accentColor}18`,
              borderColor: `${accentColor}55`,
              color: eUltimo ? (m ? '#000' : '#fff') : accentColor,
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              transition: 'all .2s',
            } as React.CSSProperties}
          >
            {eUltimo ? (concluido ? '🎉 Concluído!' : 'Finalizar') : 'Próximo →'}
          </button>
        </div>

        {/* espaço removido — pular tour está no topo */}
      </div>
    </>
  )
}
