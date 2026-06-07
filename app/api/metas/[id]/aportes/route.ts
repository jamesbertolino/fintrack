import { NextRequest, NextResponse } from 'next/server'
import { dbErr } from '@/lib/dbError'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { notificarAporteFamiliar } from '@/lib/pushEventos'

function getSvc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

/** Retorna a meta se o usuário é dono OU se a meta está compartilhada no grupo familiar do usuário */
async function resolverMeta(metaId: string, userId: string) {
  const svc = getSvc()

  // Tenta como dono
  const { data: metaDona } = await svc.from('goals').select('id, nome, valor_atual, valor_total, user_id').eq('id', metaId).eq('user_id', userId).single()
  if (metaDona) return { meta: metaDona, eDono: true }

  // Descobre grupo do usuário
  const { data: grupoDono } = await svc.from('familia_grupos').select('id').eq('dono_id', userId).single()
  let grupoId = grupoDono?.id ?? null
  if (!grupoId) {
    const { data: m } = await svc.from('familia_membros').select('grupo_id').eq('membro_id', userId).single()
    grupoId = m?.grupo_id ?? null
  }
  if (!grupoId) return { meta: null, eDono: false }

  // Verifica se a meta está compartilhada nesse grupo
  const { data: comp } = await svc.from('meta_compartilhamentos').select('meta_id').eq('meta_id', metaId).eq('grupo_id', grupoId).single()
  if (!comp) return { meta: null, eDono: false }

  const { data: metaComp } = await svc.from('goals').select('id, nome, valor_atual, valor_total, user_id').eq('id', metaId).single()
  return { meta: metaComp ?? null, eDono: false, grupoId }
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const svc = getSvc()

  // Dono vê só os próprios; familiar vê todos (se meta compartilhada)
  const { meta } = await resolverMeta(id, user.id)
  if (!meta) return NextResponse.json({ error: 'Meta não encontrada' }, { status: 404 })

  const query = meta.user_id === user.id
    ? svc.from('meta_aportes').select('*').eq('meta_id', id).eq('user_id', user.id).order('data', { ascending: false })
    : svc.from('meta_aportes').select('*').eq('meta_id', id).order('data', { ascending: false })

  const { data, error } = await query
  if (error) return NextResponse.json({ error: dbErr(error, 'buscar depósitos') }, { status: 500 })
  return NextResponse.json({ aportes: data || [] })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const { valor, nota, data } = await request.json()
  if (!valor || valor <= 0) return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })

  const { meta, eDono, grupoId } = await resolverMeta(id, user.id) as { meta: { id: string; nome: string; valor_atual: number; valor_total: number; user_id: string } | null; eDono: boolean; grupoId?: string }
  if (!meta) return NextResponse.json({ error: 'Meta não encontrada ou não compartilhada com você' }, { status: 404 })

  const svc = getSvc()

  const { data: aporte, error: errAporte } = await svc
    .from('meta_aportes')
    .insert({ meta_id: id, user_id: user.id, valor, nota: nota || null, data: data || new Date().toISOString().slice(0, 10) })
    .select().single()
  if (errAporte) return NextResponse.json({ error: errAporte.message }, { status: 500 })

  const novoValor = (meta.valor_atual || 0) + valor
  const { error: errMeta } = await svc.from('goals').update({ valor_atual: novoValor }).eq('id', id)
  if (errMeta) return NextResponse.json({ error: errMeta.message }, { status: 500 })

  // Notifica família quando aporte é em meta compartilhada
  if (!eDono || grupoId) {
    // Busca nome do aportador e membros do grupo para notificação (não-bloqueante)
    Promise.resolve().then(async () => {
      try {
        const [perfilRes, membrosRes] = await Promise.all([
          svc.from('profiles').select('nome').eq('id', user.id).single(),
          grupoId ? svc.from('familia_membros').select('membro_id').eq('grupo_id', grupoId) : Promise.resolve({ data: [] }),
        ])
        notificarAporteFamiliar({
          nomeAportador:  (perfilRes.data as { nome: string } | null)?.nome || 'Um membro',
          metaNome:       meta.nome,
          donoId:         meta.user_id,
          aportadorId:    user.id,
          valor,
          novoValor,
          valorTotal:     meta.valor_total,
          outrosMembros:  ((membrosRes.data || []) as { membro_id: string }[]).map(m => m.membro_id),
        })
      } catch { /* melhor esforço */ }
    })
  }

  return NextResponse.json({ aporte, valor_atual: novoValor })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const { aporte_id } = await request.json()
  const svc = getSvc()

  const { data: aporte } = await svc.from('meta_aportes').select('valor, meta_id, user_id').eq('id', aporte_id).single()
  if (!aporte) return NextResponse.json({ error: 'Aporte não encontrado' }, { status: 404 })

  // Só o próprio usuário pode remover seu aporte
  if (aporte.user_id !== user.id) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { error: errDel } = await svc.from('meta_aportes').delete().eq('id', aporte_id)
  if (errDel) return NextResponse.json({ error: errDel.message }, { status: 500 })

  const { data: meta } = await svc.from('goals').select('valor_atual').eq('id', id).single()
  if (meta) {
    const novoValor = Math.max(0, (meta.valor_atual || 0) - aporte.valor)
    await svc.from('goals').update({ valor_atual: novoValor }).eq('id', id)
  }

  return NextResponse.json({ ok: true })
}
