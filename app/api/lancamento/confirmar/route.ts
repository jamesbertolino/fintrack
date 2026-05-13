import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { logAudit } from '@/lib/auditLog'
import { verificarConquistas } from '@/lib/verificarConquistas'
import { verificarEventosPosLancamento } from '@/lib/pushEventos'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { transacoes, conta_id } = await request.json()
  if (!transacoes?.length) return NextResponse.json({ error: 'Nenhuma transação' }, { status: 400 })

  type TransacaoEntrada = {
    descricao: string; valor: number; tipo: string; categoria: string
    data_hora: string; ref_externa?: string; confirmada_duplicata?: boolean
  }

  // Separa as que o usuário marcou para ignorar (confirmada_duplicata ainda true = já existe, não inserir)
  const paraInserir = (transacoes as TransacaoEntrada[]).filter(t => !t.confirmada_duplicata)
  if (!paraInserir.length) return NextResponse.json({ ok: true, lançados: 0, duplicatas_ignoradas: transacoes.length })

  // Antes de inserir, re-verifica ref_externa no banco para evitar race condition
  const refs = paraInserir.map(t => t.ref_externa).filter(Boolean) as string[]
  const refsJaExistentes = new Set<string>()
  if (refs.length) {
    const { data: existentes } = await supabase
      .from('transactions').select('ref_externa')
      .eq('user_id', user.id).in('ref_externa', refs)
    existentes?.forEach(e => { if (e.ref_externa) refsJaExistentes.add(e.ref_externa) })
  }

  const novas  = paraInserir.filter(t => !t.ref_externa || !refsJaExistentes.has(t.ref_externa))
  const duplas = paraInserir.filter(t => t.ref_externa && refsJaExistentes.has(t.ref_externa))

  if (!novas.length) {
    return NextResponse.json({ ok: true, lançados: 0, duplicatas_ignoradas: transacoes.length, mensagem: `Todos os ${transacoes.length} lançamentos já existem no sistema.` })
  }

  const inserir = novas.map(t => ({
    user_id:      user.id,
    descricao:    t.descricao.toUpperCase(),
    valor:        t.tipo === 'debito' ? -Math.abs(t.valor) : Math.abs(t.valor),
    tipo:         t.tipo,
    categoria:    t.categoria,
    data_hora:    t.data_hora || new Date().toISOString(),
    conta_id:     conta_id || null,
    origem:       'upload',
    ref_externa:  t.ref_externa || null,
  }))

  const { data, error } = await supabase.from('transactions').insert(inserir).select('id')

  if (error) {
    // Violação de unique constraint (23505) — algum chegou em paralelo
    if (error.code === '23505') {
      return NextResponse.json({ ok: true, lançados: 0, duplicatas_ignoradas: inserir.length, mensagem: 'Lançamentos já existem no sistema (inserção simultânea).' })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  logAudit({ user_id: user.id, action: 'transaction.create', metadata: { count: data.length, origem: 'upload' } })

  verificarConquistas(supabase, user.id).catch(() => null)
  verificarEventosPosLancamento(supabase, user.id, novas)

  return NextResponse.json({
    ok: true,
    lançados: data.length,
    duplicatas_ignoradas: duplas.length + (transacoes.length - paraInserir.length),
    ...(duplas.length > 0 && { mensagem: `${duplas.length} lançamento${duplas.length > 1 ? 's' : ''} ignorado${duplas.length > 1 ? 's' : ''} por já existirem no sistema.` }),
  })
}
