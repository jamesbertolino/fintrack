'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useCores, useTema } from '@/components/ThemeProvider'

const TOUR_KEY = 'poupaup_tour_v1'
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
    descricao: 'Em menos de 2 minutos você vai dominar as principais funcionalidades e ainda vai ganhar XP por isso. Vamos começar?',
    posicao: 'center',
  },
  {
    id: 'painel',
    emoji: '📊',
    titulo: 'Seu painel financeiro',
    descricao: 'Aqui você acompanha em tempo real: saldo total, receitas, despesas e seu progresso de XP. Tudo em um só lugar.',
    alvo: 'tour-metricas',
    posicao: 'bottom',
  },
  {
    id: 'navegacao',
    emoji: '🗺️',
    titulo: 'Menu de navegação',
    descricao: 'Use o menu lateral para acessar todas as seções do app. Em celular, toque no ícone ☰ para abrir.',
    alvo: 'tour-sidebar',
    posicao: 'right',
  },
  {
    id: 'lancamentos',
    emoji: '📝',
    titulo: 'Registre seus lançamentos',
    descricao: 'Em Lançamentos você registra receitas e despesas. Você pode digitar manualmente, importar extrato do banco ou enviar uma mensagem no WhatsApp do grupo — a IA interpreta automaticamente!',
    alvo: 'tour-nav-lancamento',
    posicao: 'right',
  },
  {
    id: 'gastos',
    emoji: '💸',
    titulo: 'Analise seus gastos',
    descricao: 'A tela de Gastos mostra seus gastos por categoria em gráficos. Use o botão "Analisar com IA" para receber dicas personalizadas de como economizar mais.',
    alvo: 'tour-nav-gastos',
    posicao: 'right',
  },
  {
    id: 'orcamento',
    emoji: '⚖️',
    titulo: 'Controle seu orçamento',
    descricao: 'Defina um limite mensal por categoria (Alimentação, Lazer, etc.). A IA sugere ajustes baseados nas suas prioridades para você atingir seus objetivos mais rápido.',
    alvo: 'tour-nav-orcamento',
    posicao: 'right',
  },
  {
    id: 'metas',
    emoji: '🎯',
    titulo: 'Crie metas financeiras',
    descricao: 'Defina objetivos como "Viagem para Europa" ou "Fundo de emergência". O app acompanha seu progresso e calcula quanto você precisa guardar por mês.',
    alvo: 'tour-nav-metas',
    posicao: 'right',
  },
  {
    id: 'ia',
    emoji: '🤖',
    titulo: 'Assistente IA',
    descricao: 'Converse livremente com a IA financeira. Pergunte "Como posso economizar mais?", "Estou no caminho certo?" ou peça um plano personalizado.',
    alvo: 'tour-nav-ia',
    posicao: 'right',
  },
  {
    id: 'notificacoes',
    emoji: '🔔',
    titulo: 'Notificações inteligentes',
    descricao: 'A IA analisa sua situação e envia alertas motivadores no app e no WhatsApp — até 2 por dia para não te interromper demais.',
    alvo: 'tour-nav-notificacoes',
    posicao: 'right',
  },
  {
    id: 'conclusao',
    emoji: '🏆',
    titulo: `Parabéns! +${XP_TOUR} XP conquistados`,
    descricao: 'Você concluiu o tour e está pronto para começar sua jornada financeira. Dica: configure suas prioridades no Perfil para que a IA personalize tudo para você.',
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
    atualizarSpotlight()
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
          <button onClick={pular} style={{ background: 'none', border: 'none', cursor: 'pointer', color: cores.textFaint, fontSize: 18, lineHeight: 1, padding: 0 }}>×</button>
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
              padding: '8px 16px', borderRadius: 8, border: `1px solid ${cores.border}`,
              background: 'transparent', color: cores.textMuted, fontSize: 12,
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
              padding: '8px 20px', borderRadius: 8, border: 'none',
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

        {/* Link pular tour (apenas nos primeiros passos) */}
        {passo < 3 && (
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <button onClick={pular} style={{ background: 'none', border: 'none', color: cores.textFaint, fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}>
              Pular tour
            </button>
          </div>
        )}
      </div>
    </>
  )
}
