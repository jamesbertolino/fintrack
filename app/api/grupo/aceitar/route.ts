import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const EVO_URL    = () => process.env.EVOLUTION_URL!
const EVO_KEY    = () => process.env.EVOLUTION_API_KEY!
const evoHeaders = () => ({ 'Content-Type': 'application/json', 'apikey': EVO_KEY() })

// GET — informações públicas do convite (para exibir antes do login)
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.json({ error: 'Token obrigatório' }, { status: 400 })
  }

  const supabase = getSupabase()

  const { data: membro } = await supabase
    .from('grupo_membros')
    .select('status, grupo_id, grupos(nome), profiles!grupo_membros_convidado_por_fkey(nome)')
    .eq('token_convite', token)
    .single()

  if (!membro) {
    return NextResponse.json({ error: 'Convite inválido ou expirado' }, { status: 404 })
  }

  if (membro.status !== 'pendente') {
    return NextResponse.json({ error: 'Convite já utilizado' }, { status: 409 })
  }

  const gruposRaw   = membro.grupos   as { nome: string } | { nome: string }[] | null
  const profilesRaw = membro.profiles as { nome: string } | { nome: string }[] | null

  const grupo_nome    = (Array.isArray(gruposRaw)   ? gruposRaw[0]?.nome   : gruposRaw?.nome)   || ''
  const convidado_por = (Array.isArray(profilesRaw) ? profilesRaw[0]?.nome : profilesRaw?.nome) || ''

  return NextResponse.json({ grupo_nome, convidado_por })
}

// POST — aceita o convite
export async function POST(request: NextRequest) {
  const { token, user_id } = await request.json()

  if (!token || !user_id) {
    return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })
  }

  const supabase = getSupabase()

  // Busca convite
  const { data: membro } = await supabase
    .from('grupo_membros')
    .select('id, grupo_id, whatsapp, status')
    .eq('token_convite', token)
    .single()

  if (!membro) {
    return NextResponse.json({ error: 'Convite inválido ou expirado' }, { status: 404 })
  }

  if (membro.status !== 'pendente') {
    return NextResponse.json({ error: 'Convite já utilizado' }, { status: 409 })
  }

  // Marca como ativo
  await supabase
    .from('grupo_membros')
    .update({ user_id, status: 'ativo' })
    .eq('id', membro.id)

  // Busca nome do grupo para retornar ao cliente
  const { data: grupo } = await supabase
    .from('grupos')
    .select('nome')
    .eq('id', membro.grupo_id)
    .single()

  // O membro entra no grupo WhatsApp pelo link recebido no convite — sem necessidade de API aqui.
  return NextResponse.json({ ok: true, grupo_nome: grupo?.nome || '' })
}
