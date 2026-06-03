import { NextRequest, NextResponse } from 'next/server'
import { dbErr } from '@/lib/dbError'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { logAudit } from '@/lib/auditLog'
import { verificarConquistas } from '@/lib/verificarConquistas'
import { verificarEventosPosLancamento } from '@/lib/pushEventos'
import { normalizarChave } from '@/app/api/lancamento/upload/route'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { transacoes, conta_id, arquivo_nome, formato, banco_nome, total_detectadas } = await request.json()
  if (!transacoes?.length) return NextResponse.json({ error: 'Nenhuma transação' }, { status: 400 })

  type TransacaoEntrada = {
    descricao: string; valor: number; tipo: string; categoria: string
    data_hora: string; ref_externa?: string; confirmada_duplicata?: boolean
  }

  // Separa as que o usuário marcou para ignorar (confirmada_duplicata ainda true = já existe, não inserir)
  const paraInserir = (transacoes as TransacaoEntrada[]).filter(t => !t.confirmada_duplicata)
  if (!paraInserir.length) {
    supabase.from('importacoes').insert({
      user_id: user.id, arquivo_nome: arquivo_nome || null, formato: formato || null,
      banco_nome: banco_nome || null, conta_id: conta_id || null,
      total_detectadas: total_detectadas ?? transacoes.length,
      total_inseridas: 0, total_duplicatas: transacoes.length,
    }).then(() => null)
    return NextResponse.json({ ok: true, lançados: 0, duplicatas_ignoradas: transacoes.length })
  }

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
  const duplas = paraInserir.filter(t => t.ref_externa  &&  refsJaExistentes.has(t.ref_externa))
  const totalDuplicatas = duplas.length + (transacoes.length - paraInserir.length)

  if (!novas.length) {
    supabase.from('importacoes').insert({
      user_id: user.id, arquivo_nome: arquivo_nome || null, formato: formato || null,
      banco_nome: banco_nome || null, conta_id: conta_id || null,
      total_detectadas: total_detectadas ?? transacoes.length,
      total_inseridas: 0, total_duplicatas: totalDuplicatas,
    }).then(() => null)
    return NextResponse.json({ ok: true, lançados: 0, duplicatas_ignoradas: totalDuplicatas, mensagem: `Todos os ${transacoes.length} lançamentos já existem no sistema.` })
  }

  // Cria o registro de importação primeiro para obter o ID e vincular as transactions
  const { data: impData } = await supabase.from('importacoes').insert({
    user_id: user.id, arquivo_nome: arquivo_nome || null, formato: formato || null,
    banco_nome: banco_nome || null, conta_id: conta_id || null,
    total_detectadas: total_detectadas ?? transacoes.length,
    total_inseridas: novas.length,   // atualizado abaixo após insert real
    total_duplicatas: totalDuplicatas,
  }).select('id').single()

  const importacao_id = impData?.id || null

  const inserir = novas.map(t => ({
    user_id:        user.id,
    descricao:      t.descricao.toUpperCase(),
    valor:          t.tipo === 'debito' ? -Math.abs(t.valor) : Math.abs(t.valor),
    tipo:           t.tipo,
    categoria:      t.categoria,
    data_hora:      t.data_hora || new Date().toISOString(),
    conta_id:       conta_id || null,
    origem:         'upload',
    ref_externa:    t.ref_externa || null,
    importacao_id,
  }))

  const { data, error } = await supabase.from('transactions').insert(inserir).select('id')

  if (error) {
    // Violação de unique constraint (23505) — algum chegou em paralelo
    if (error.code === '23505') {
      if (importacao_id) {
        supabase.from('importacoes').update({ total_inseridas: 0, total_duplicatas: inserir.length }).eq('id', importacao_id).then(() => null)
      }
      return NextResponse.json({ ok: true, lançados: 0, duplicatas_ignoradas: inserir.length, mensagem: 'Lançamentos já existem no sistema (inserção simultânea).' })
    }
    return NextResponse.json({ error: dbErr(error, 'confirmar lançamentos') }, { status: 500 })
  }

  // Corrige contagem real inserida (pode diferir se houve erro parcial)
  if (importacao_id && data.length !== novas.length) {
    supabase.from('importacoes').update({ total_inseridas: data.length }).eq('id', importacao_id).then(() => null)
  }

  logAudit({ user_id: user.id, action: 'transaction.create', metadata: { count: data.length, origem: 'upload' } })

  // Memoriza padrões descrição→categoria para sugestões futuras
  // Separa novos (insert vezes=1) de existentes (update vezes+1) para evitar reset do contador
  const aprendizados = novas
    .map(t => ({ chave: normalizarChave(t.descricao), categoria: t.categoria }))
    .filter(a => a.chave.length >= 3)
  if (aprendizados.length) {
    const chavesUnicas = [...new Set(aprendizados.map(a => a.chave))]
    supabase.from('categoria_aprendida')
      .select('id, chave, vezes')
      .eq('user_id', user.id)
      .in('chave', chavesUnicas)
      .then(({ data: existentes }) => {
        const existMap = new Map((existentes || []).map(e => [e.chave, e]))
        const agora = new Date().toISOString()

        const novos = aprendizados.filter(a => !existMap.has(a.chave))
        const updates = aprendizados.filter(a => existMap.has(a.chave))

        if (novos.length) {
          supabase.from('categoria_aprendida')
            .insert(novos.map(a => ({ user_id: user.id, chave: a.chave, categoria: a.categoria, vezes: 1, updated_at: agora })))
            .then(() => null)
        }
        for (const a of updates) {
          const ex = existMap.get(a.chave)!
          supabase.from('categoria_aprendida')
            .update({ categoria: a.categoria, vezes: ex.vezes + 1, updated_at: agora })
            .eq('id', ex.id)
            .then(() => null)
        }
      })
  }

  verificarConquistas(supabase, user.id).catch(() => null)
  verificarEventosPosLancamento(supabase, user.id, novas)

  return NextResponse.json({
    ok: true,
    lançados: data.length,
    duplicatas_ignoradas: totalDuplicatas,
    importacao_id,
    ...(duplas.length > 0 && { mensagem: `${duplas.length} lançamento${duplas.length > 1 ? 's' : ''} ignorado${duplas.length > 1 ? 's' : ''} por já existirem no sistema.` }),
  })
}
