import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { enviarPushParaUsuario } from '@/app/api/push/send/route'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/**
 * Cron de alertas inteligentes — roda diariamente.
 * Vercel cron: "0 11 * * *" (8h BRT = 11h UTC)
 *
 * Faz três verificações para cada usuário:
 *  1. Resumo semanal (somente aos domingos)
 *  2. Metas com prazo próximo (≤7 dias, < 90% concluída)
 *  3. Orçamentos quase estourados (> 80%) e ainda não notificados hoje
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (!auth || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const supabase  = getServiceClient()
  const hoje      = new Date()
  const ehDomingo = hoje.getDay() === 0

  // Busca usuários com push subscription + preferências
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('user_id')

  if (!subs?.length) return NextResponse.json({ ok: true, processados: 0 })

  const userIds = [...new Set(subs.map(s => s.user_id as string))]

  const { data: prefs } = await supabase
    .from('push_preferencias')
    .select('user_id, resumo_semanal, aviso_meta, alerta_orcamento')
    .in('user_id', userIds)

  const prefsMap = new Map((prefs || []).map(p => [p.user_id, p]))

  const inicioMes    = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString()
  const inicioSemana = new Date(hoje)
  inicioSemana.setDate(hoje.getDate() - 7)

  let enviados = 0

  for (const userId of userIds) {
    const pref = prefsMap.get(userId)
    const querResumo    = pref?.resumo_semanal   ?? true
    const querMeta      = pref?.aviso_meta       ?? true
    const querOrcamento = pref?.alerta_orcamento ?? true

    // ── 1. Resumo semanal (domingo) ─────────────────────────────────────────
    if (ehDomingo && querResumo) {
      const { data: txs } = await supabase
        .from('transactions')
        .select('valor, tipo')
        .eq('user_id', userId)
        .gte('data_hora', inicioSemana.toISOString())
        .lte('data_hora', hoje.toISOString())

      if (txs?.length) {
        const receitas = txs.filter(t => t.tipo === 'credito').reduce((a, t) => a + t.valor, 0)
        const despesas = txs.filter(t => t.tipo === 'debito').reduce((a, t) => a + Math.abs(t.valor), 0)
        const saldo    = receitas - despesas

        await enviarPushParaUsuario(userId, {
          title: '📅 Resumo da semana',
          body:  `Receitas ${fmt(receitas)} · Gastos ${fmt(despesas)} · Resultado ${saldo >= 0 ? '+' : ''}${fmt(saldo)}`,
          url:   '/dashboard',
        })
        enviados++
      }
    }

    // ── 2. Metas com prazo próximo ──────────────────────────────────────────
    if (querMeta) {
      const em7dias = new Date(hoje)
      em7dias.setDate(hoje.getDate() + 7)

      const { data: metas } = await supabase
        .from('goals')
        .select('nome, valor_atual, valor_total, prazo')
        .eq('user_id', userId)
        .eq('ativo', true)
        .lte('prazo', em7dias.toISOString().slice(0, 10))
        .gt('prazo', hoje.toISOString().slice(0, 10))

      for (const meta of metas || []) {
        const pct = Math.round((meta.valor_atual / meta.valor_total) * 100)
        if (pct < 90) {
          const diasRestantes = Math.ceil((new Date(meta.prazo).getTime() - hoje.getTime()) / 86400000)
          await enviarPushParaUsuario(userId, {
            title: '🎯 Meta com prazo próximo',
            body:  `"${meta.nome}" vence em ${diasRestantes} dia${diasRestantes > 1 ? 's' : ''} e está ${pct}% concluída.`,
            url:   '/dashboard/metas',
          })
          enviados++
        }
      }
    }

    // ── 3. Orçamentos quase estourados (80-99%) ─────────────────────────────
    if (querOrcamento) {
      const { data: orcamentos } = await supabase
        .from('orcamentos')
        .select('categoria, limite')
        .eq('user_id', userId)

      for (const orc of orcamentos || []) {
        const { data: txs } = await supabase
          .from('transactions')
          .select('valor')
          .eq('user_id', userId)
          .eq('categoria', orc.categoria)
          .eq('tipo', 'debito')
          .gte('data_hora', inicioMes)

        const gasto = (txs || []).reduce((a, t) => a + Math.abs(t.valor), 0)
        const pct   = Math.round((gasto / orc.limite) * 100)

        // Aviso preventivo: 80-99%
        if (pct >= 80 && pct < 100) {
          await enviarPushParaUsuario(userId, {
            title: '📊 Orçamento quase no limite',
            body:  `${orc.categoria}: ${fmt(gasto)} de ${fmt(orc.limite)} usados (${pct}%). Faltam ${fmt(orc.limite - gasto)}.`,
            url:   '/dashboard',
          })
          enviados++
        }
      }
    }
  }

  return NextResponse.json({ ok: true, processados: userIds.length, enviados })
}
