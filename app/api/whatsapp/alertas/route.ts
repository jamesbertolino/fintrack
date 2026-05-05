import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const N8N_SECRET   = process.env.N8N_WEBHOOK_SECRET || 'granaup-secret-2026'
const MAX_WPP_DIA  = 2  // máximo de notificações WhatsApp por usuário por dia

// GET — busca notificações para enviar via WhatsApp (chamado pelo N8N)
export async function GET(request: NextRequest) {
  const secret = request.headers.get('x-n8n-secret')
  if (secret !== N8N_SECRET)
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const supabase = getSupabase()
  const hoje     = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

  // Busca notificações ainda não enviadas
  const { data: candidatas } = await supabase
    .from('notifications')
    .select('id, tipo, titulo, mensagem, created_at, user_id')
    .eq('enviado_whatsapp', false)
    .is('whatsapp_enviado_at', null)
    .order('created_at', { ascending: true })
    .limit(30)

  if (!candidatas?.length) return NextResponse.json({ alertas: [] })

  // Para cada user, conta quantas já foram enviadas hoje
  const userIds = [...new Set(candidatas.map(a => a.user_id))]

  const { data: jaEnviadasHoje } = await supabase
    .from('notifications')
    .select('user_id')
    .in('user_id', userIds)
    .eq('enviado_whatsapp', true)
    .gte('whatsapp_enviado_at', `${hoje}T00:00:00Z`)

  const countHoje: Record<string, number> = {}
  for (const n of jaEnviadasHoje || []) {
    countHoje[n.user_id] = (countHoje[n.user_id] || 0) + 1
  }

  // Busca perfis com WhatsApp e configuração de notificações
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, nome, whatsapp, timezone, idioma, notificacoes_celular, grupo_id_principal')
    .in('id', userIds)
    .not('whatsapp', 'is', null)
    .eq('notificacoes_celular', true)

  const perfilMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))

  // Filtra: somente usuários com WhatsApp + notificações ativas + abaixo do limite diário
  const elegíveis = candidatas.filter(a => {
    const perfil = perfilMap[a.user_id]
    if (!perfil?.whatsapp) return false
    if (!perfil.notificacoes_celular) return false
    return (countHoje[a.user_id] || 0) < MAX_WPP_DIA
  })

  // Respeita o limite: se um usuário já tem N candidatas, pega só até completar MAX_WPP_DIA
  const porUsuario: Record<string, number> = {}
  const selecionadas = elegíveis.filter(a => {
    const atual = porUsuario[a.user_id] || 0
    const jaEnviadas = countHoje[a.user_id] || 0
    if (atual + jaEnviadas >= MAX_WPP_DIA) return false
    porUsuario[a.user_id] = atual + 1
    return true
  })

  if (!selecionadas.length) return NextResponse.json({ alertas: [] })

  // Busca membros dos grupos para envio em grupo (se configurado)
  const grupoIds = [...new Set((profiles || []).map(p => p.grupo_id_principal).filter(Boolean))]
  const membrosGrupo: Record<string, { nome: string; whatsapp: string }[]> = {}

  if (grupoIds.length > 0) {
    const { data: membros } = await supabase
      .from('profiles')
      .select('id, nome, whatsapp, grupo_id_principal, notificacoes_celular')
      .in('grupo_id_principal', grupoIds)
      .not('whatsapp', 'is', null)
      .eq('notificacoes_celular', true)

    for (const mb of membros || []) {
      if (!mb.grupo_id_principal) continue
      if (!membrosGrupo[mb.grupo_id_principal]) membrosGrupo[mb.grupo_id_principal] = []
      membrosGrupo[mb.grupo_id_principal].push({ nome: mb.nome, whatsapp: mb.whatsapp })
    }
  }

  // Marca imediatamente como "enviado" para evitar reenvios caso o PATCH não seja chamado
  const idsSelecionados = selecionadas.map(a => a.id)
  await supabase
    .from('notifications')
    .update({ enviado_whatsapp: true, whatsapp_enviado_at: new Date().toISOString() })
    .in('id', idsSelecionados)

  // Monta alertas para envio — inclui membros do grupo se houver
  const alertas: {
    id: string
    numero: string
    nome: string
    mensagem: string
    destinatario: 'proprio' | 'membro_grupo'
  }[] = []

  for (const a of selecionadas) {
    const perfil  = perfilMap[a.user_id]
    const msg     = formatarMensagem(a.tipo, a.titulo, a.mensagem, perfil.timezone, perfil.idioma)
    const grupoId = perfil.grupo_id_principal
    const membros = grupoId ? (membrosGrupo[grupoId] || []) : []

    // Envia para o próprio usuário
    alertas.push({ id: a.id, numero: perfil.whatsapp, nome: perfil.nome, mensagem: msg, destinatario: 'proprio' })

    // Envia para membros do grupo (exceto o próprio, que já foi incluído)
    for (const mb of membros) {
      if (mb.whatsapp !== perfil.whatsapp) {
        alertas.push({ id: a.id, numero: mb.whatsapp, nome: mb.nome, mensagem: msg, destinatario: 'membro_grupo' })
      }
    }
  }

  return NextResponse.json({ alertas, total: alertas.length })
}

// PATCH — N8N confirma envio (mantido por compatibilidade, mas o GET já marca)
export async function PATCH(request: NextRequest) {
  const secret = request.headers.get('x-n8n-secret')
  if (secret !== N8N_SECRET)
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { ids } = await request.json()
  if (!ids?.length) return NextResponse.json({ ok: true })

  const supabase = getSupabase()
  await supabase
    .from('notifications')
    .update({ enviado_whatsapp: true, whatsapp_enviado_at: new Date().toISOString() })
    .in('id', ids)

  return NextResponse.json({ ok: true, enviados: ids.length })
}

function formatarMensagem(
  tipo: string, titulo: string, mensagem: string,
  timezone = 'America/Sao_Paulo', idioma = 'pt-BR',
) {
  const emojis: Record<string, string> = {
    sugestao_meta: '💰', limite_categoria: '⚠️', marco_meta: '🎯',
    fim_mes: '📅', ia_diaria: '🤖', alerta_gasto: '⚠️',
    dica_economia: '💡', progresso_meta: '🎯', motivacao: '⚡', planejamento: '📋',
  }
  const hora = new Intl.DateTimeFormat(idioma, {
    hour: '2-digit', minute: '2-digit', timeZone: timezone,
  }).format(new Date())
  return `${emojis[tipo] || '🔔'} *${titulo}*\n\n${mensagem}\n\n_PoupaUp • ${hora}_`
}
