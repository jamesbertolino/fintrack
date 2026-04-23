import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const N8N_SECRET = process.env.N8N_WEBHOOK_SECRET || 'granaup-secret-2026'

export async function GET(request: NextRequest) {
  const secret = request.headers.get('x-n8n-secret')
  if (secret !== N8N_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const supabase = getSupabase()

  const { data: alertas } = await supabase
    .from('notifications')
    .select('id, tipo, titulo, mensagem, created_at, user_id')
    .eq('enviado_whatsapp', false)
    .eq('lida', false)
    .order('created_at', { ascending: true })
    .limit(10)

  if (!alertas?.length) return NextResponse.json({ alertas: [] })

  // Buscar perfis com WhatsApp dos usuários das notificações
  const userIds = [...new Set(alertas.map(a => a.user_id))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, nome, whatsapp')
    .in('id', userIds)
    .not('whatsapp', 'is', null)

  const perfilMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))

  const formatados = alertas
    .filter(a => perfilMap[a.user_id]?.whatsapp)
    .map(a => ({
      id: a.id,
      numero: perfilMap[a.user_id].whatsapp,
      nome: perfilMap[a.user_id].nome,
      mensagem: formatarMensagem(a.tipo, a.titulo, a.mensagem),
    }))

  return NextResponse.json({ alertas: formatados })
}

export async function PATCH(request: NextRequest) {
  const secret = request.headers.get('x-n8n-secret')
  if (secret !== N8N_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { ids } = await request.json()
  if (!ids?.length) return NextResponse.json({ ok: true })

  const supabase = getSupabase()
  await supabase.from('notifications').update({ enviado_whatsapp: true }).in('id', ids)

  return NextResponse.json({ ok: true, enviados: ids.length })
}

function formatarMensagem(tipo: string, titulo: string, mensagem: string) {
  const emojis: Record<string, string> = {
    sugestao_meta: '💰', limite_categoria: '⚠️', marco_meta: '🎯', fim_mes: '📅',
  }
  return `${emojis[tipo] || '🔔'} *${titulo}*\n\n${mensagem}\n\n_GranaUp • ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}_`
}