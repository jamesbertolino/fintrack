import { SupabaseClient } from '@supabase/supabase-js'
import { enviarPushParaUsuario } from '@/app/api/push/send/route'
import type { Conquista } from './conquistas'

/** Push não-bloqueante — nunca lança, nunca trava o fluxo principal */
function push(userId: string, payload: Parameters<typeof enviarPushParaUsuario>[1]) {
  enviarPushParaUsuario(userId, payload).catch(() => null)
}

function fmtBRL(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

// ─── Conquista desbloqueada ───────────────────────────────────────────────────

export function notificarConquista(userId: string, conquista: Conquista) {
  push(userId, {
    title: `🏆 Conquista desbloqueada!`,
    body:  `${conquista.icone} ${conquista.nome} — +${conquista.xp} XP`,
    url:   '/dashboard/tarefas?aba=conquistas',
  })
}

// ─── Meta atingida ────────────────────────────────────────────────────────────

export function notificarMetaAtingida(userId: string, nomeMeta: string) {
  push(userId, {
    title: '🎯 Meta concluída!',
    body:  `Parabéns! Você atingiu a meta "${nomeMeta}".`,
    url:   '/dashboard/metas',
  })
}

// ─── Orçamento estourado ──────────────────────────────────────────────────────

export function notificarOrcamentoEstourado(userId: string, categoria: string, pct: number) {
  push(userId, {
    title: '⚠️ Orçamento ultrapassado',
    body:  `Você gastou ${pct}% do limite em ${categoria} este mês.`,
    url:   '/dashboard/orcamento',
  })
}

// ─── Missões do dia disponíveis ───────────────────────────────────────────────

export function notificarMissoesDia(userId: string, qtd: number) {
  push(userId, {
    title: '☀️ Missões do dia disponíveis',
    body:  `${qtd} missão${qtd > 1 ? 'ões' : ''} esperando por você. Complete e ganhe XP!`,
    url:   '/dashboard/tarefas',
  })
}

// ─── Aporte em meta compartilhada ────────────────────────────────────────────

export function notificarAporteFamiliar({
  svc,
  metaId,
  metaNome,
  donoId,
  aportadorId,
  valor,
  novoValor,
  valorTotal,
  grupoId,
}: {
  svc: ReturnType<typeof import('@supabase/supabase-js').createClient>
  metaId: string
  metaNome: string
  donoId: string
  aportadorId: string
  valor: number
  novoValor: number
  valorTotal: number
  grupoId: string | null
}) {
  Promise.resolve().then(async () => {
    try {
      const pct  = valorTotal > 0 ? Math.round((novoValor / valorTotal) * 100) : 0
      const falta = Math.max(0, valorTotal - novoValor)

      // Nome de quem aportou
      const { data: perfil } = await svc.from('profiles').select('nome').eq('id', aportadorId).single()
      const nomeAportador = perfil?.nome || 'Um membro'

      const title = pct >= 100 ? `🎉 Meta "${metaNome}" concluída!` : `💰 Depósito em "${metaNome}"`
      const body  = pct >= 100
        ? `${nomeAportador} fez o último aporte (${fmtBRL(valor)}) e a meta foi atingida!`
        : `${nomeAportador} depositou ${fmtBRL(valor)} — ${pct}% concluído, faltam ${fmtBRL(falta)}.`

      // Notifica o dono (se não foi ele quem aportou)
      if (donoId !== aportadorId) {
        push(donoId, { title, body, url: `/dashboard/metas` })
      }

      // Notifica os outros membros da família (exceto quem aportou)
      if (grupoId) {
        const { data: membros } = await svc.from('familia_membros').select('membro_id').eq('grupo_id', grupoId)
        for (const m of membros || []) {
          if (m.membro_id !== aportadorId && m.membro_id !== donoId) {
            push(m.membro_id, { title, body, url: `/dashboard/metas` })
          }
        }
      }
    } catch { /* push é melhor esforço */ }
  })
}

// ─── Verificação pós-lançamento ───────────────────────────────────────────────

/**
 * Chamado após inserir transações — verifica metas atingidas e orçamentos estourados.
 * Não-bloqueante: retorna imediatamente, executa em background.
 */
export function verificarEventosPosLancamento(
  supabase: SupabaseClient,
  userId: string,
  novasTransacoes: { tipo: string; categoria?: string; valor: number }[],
) {
  Promise.resolve().then(async () => {
    try {
      // 1. Metas — verifica se alguma foi atingida com este lançamento
      const { data: metas } = await supabase
        .from('goals')
        .select('nome, valor_atual, valor_total, ativo')
        .eq('user_id', userId)
        .eq('ativo', true)

      for (const meta of metas || []) {
        if (meta.valor_atual >= meta.valor_total) {
          notificarMetaAtingida(userId, meta.nome)
        }
      }

      // 2. Orçamentos — verifica categorias das novas transações
      const categoriasDebito = [...new Set(
        novasTransacoes.filter(t => t.tipo === 'debito').map(t => t.categoria).filter(Boolean)
      )]

      if (categoriasDebito.length > 0) {
        const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

        const { data: orcamentos } = await supabase
          .from('orcamentos')
          .select('categoria, valor_limite')
          .eq('user_id', userId)
          .in('categoria', categoriasDebito)

        for (const orc of orcamentos || []) {
          const { data: txs } = await supabase
            .from('transactions')
            .select('valor')
            .eq('user_id', userId)
            .eq('categoria', orc.categoria)
            .eq('tipo', 'debito')
            .gte('data_hora', inicioMes)

          const gasto = (txs || []).reduce((a, t) => a + Math.abs(t.valor), 0)
          const pct   = orc.valor_limite > 0 ? Math.round((gasto / orc.valor_limite) * 100) : 0

          // Notifica ao ultrapassar (101%) para evitar spam em cada lançamento
          if (pct >= 100 && pct <= 120) {
            notificarOrcamentoEstourado(userId, orc.categoria, pct)
          }
        }
      }
    } catch { /* silencioso — push é melhor esforço */ }
  })
}
