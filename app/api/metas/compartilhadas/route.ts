import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

function getSvc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// GET — todas as metas compartilhadas no grupo familiar do usuário logado
export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const svc = getSvc()

  // find group
  const { data: grupoDono } = await svc.from('familia_grupos').select('id').eq('dono_id', user.id).single()
  let grupoId = grupoDono?.id ?? null
  if (!grupoId) {
    const { data: m } = await svc.from('familia_membros').select('grupo_id').eq('membro_id', user.id).single()
    grupoId = m?.grupo_id ?? null
  }
  if (!grupoId) return NextResponse.json({ metas: [] })

  // get all shared metas in the group
  const { data: comps } = await svc
    .from('meta_compartilhamentos')
    .select('meta_id, criado_por')
    .eq('grupo_id', grupoId)

  if (!comps || comps.length === 0) return NextResponse.json({ metas: [] })

  const metaIds = comps.map(c => c.meta_id)
  const ownerMap: Record<string, string> = Object.fromEntries(comps.map(c => [c.meta_id, c.criado_por]))

  // fetch goals + owner profiles
  const [{ data: goals }, { data: profiles }] = await Promise.all([
    svc.from('goals').select('*').in('id', metaIds).eq('ativo', true),
    svc.from('profiles').select('id, nome, avatar_url'),
  ])

  const profileMap: Record<string, { nome: string; avatar_url: string | null }> = Object.fromEntries(
    (profiles || []).map(p => [p.id, { nome: p.nome, avatar_url: p.avatar_url }])
  )

  // fetch aportes for all these metas
  const { data: aportes } = await svc
    .from('meta_aportes')
    .select('*')
    .in('meta_id', metaIds)
    .order('data', { ascending: false })

  const aportesMap: Record<string, typeof aportes> = {}
  for (const a of aportes || []) {
    if (!aportesMap[a.meta_id]) aportesMap[a.meta_id] = []
    aportesMap[a.meta_id]!.push(a)
  }

  const metas = (goals || []).map(g => ({
    ...g,
    dono: profileMap[ownerMap[g.id]] ?? { nome: 'Desconhecido', avatar_url: null },
    dono_id: ownerMap[g.id],
    aportes: aportesMap[g.id] || [],
    e_minha: ownerMap[g.id] === user.id,
  }))

  return NextResponse.json({ metas })
}
