import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit, getClientIp } from '@/lib/rateLimit'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const EVO_URL    = () => process.env.EVOLUTION_URL!
const EVO_KEY    = () => process.env.EVOLUTION_API_KEY!
const evoHeaders = () => ({ 'Content-Type': 'application/json', 'apikey': EVO_KEY() })

export async function POST(request: NextRequest) {
  // 10 convites / 60 s por IP — evita spam de convites
  const rl = await rateLimit({ key: `convidar:${getClientIp(request)}`, limit: 10, windowSec: 60 })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Muitas requisições. Aguarde alguns instantes.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    )
  }

  const { userId, numero, grupo_id } = await request.json()

  if (!userId || !numero || !grupo_id) {
    return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })
  }

  const supabase = getSupabase()

  // Busca grupo e valida admin
  const { data: grupo } = await supabase
    .from('grupos')
    .select('id, nome, criado_por, whatsapp_grupo_id, ativo')
    .eq('id', grupo_id)
    .eq('ativo', true)
    .single()

  if (!grupo) {
    return NextResponse.json({ error: 'Grupo não encontrado' }, { status: 404 })
  }

  if (grupo.criado_por !== userId) {
    return NextResponse.json({ error: 'Apenas o administrador pode convidar membros' }, { status: 403 })
  }

  // Busca perfil do admin e valida plano
  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('nome, plano, evolution_instancia')
    .eq('id', userId)
    .single()

  if (!adminProfile) {
    return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })
  }

  if (adminProfile.plano !== 'pro') {
    return NextResponse.json({ error: 'Convites são exclusivos do plano Pro' }, { status: 403 })
  }

  // Formata número: remove não dígitos, adiciona 55 se necessário
  const numeroLimpo     = numero.replace(/\D/g, '')
  const numeroFormatado = numeroLimpo.startsWith('55') ? numeroLimpo : `55${numeroLimpo}`

  // Verifica duplicata
  const { data: membroExistente } = await supabase
    .from('grupo_membros')
    .select('id, status')
    .eq('grupo_id', grupo_id)
    .eq('whatsapp', numeroFormatado)
    .maybeSingle()

  if (membroExistente) {
    if (membroExistente.status === 'ativo') {
      return NextResponse.json({ error: 'Número já é membro ativo do grupo' }, { status: 400 })
    }
    if (membroExistente.status === 'pendente') {
      return NextResponse.json({ error: 'Convite já enviado e pendente' }, { status: 400 })
    }
  }

  // Gera token único para este convite (sem hífens para URLs mais limpas)
  const token = crypto.randomUUID().replace(/-/g, '')

  if (membroExistente) {
    // status = 'removido' → reativa com novo token
    await supabase.from('grupo_membros')
      .update({ status: 'pendente', token_convite: token, convidado_por: userId })
      .eq('id', membroExistente.id)
  } else {
    const { error: insertError } = await supabase
      .from('grupo_membros')
      .insert({
        grupo_id,
        whatsapp:      numeroFormatado,
        status:        'pendente',
        convidado_por: userId,
        token_convite: token,
      })

    if (insertError) {
      return NextResponse.json(
        { error: 'Erro ao criar convite: ' + insertError.message },
        { status: 500 }
      )
    }
  }

  // Envia mensagem de convite via Evolution
  if (adminProfile.evolution_instancia) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''

    // Gera link de convite do grupo WhatsApp dinamicamente via revokeInviteCode
    let whatsappLink = ''
    if (grupo.whatsapp_grupo_id) {
      try {
        const invRes  = await fetch(
          `${EVO_URL()}/group/revokeInviteCode/${adminProfile.evolution_instancia}`,
          {
            method:  'POST',
            headers: evoHeaders(),
            body:    JSON.stringify({ groupJid: grupo.whatsapp_grupo_id }),
          }
        )
        const invData = await invRes.json()
        if (invData.inviteCode) {
          whatsappLink = `https://chat.whatsapp.com/${invData.inviteCode}`
        }
      } catch {
      }
    }

    const passoGrupo = whatsappLink
      ? `\n\n*Passo 2* — Entre no grupo WhatsApp:\n👉 ${whatsappLink}`
      : ''
    const texto = `👋 *${adminProfile.nome}* te convidou para o *${grupo.nome}* no PoupaUp!\n\n🎯 O PoupaUp é um app de controle financeiro familiar com IA.\n\n*Passo 1* — Crie sua conta no PoupaUp:\n👉 ${appUrl}/convite/${token}${passoGrupo}\n\n_Válido por 7 dias_`

    try {
      await fetch(`${EVO_URL()}/message/sendText/${adminProfile.evolution_instancia}`, {
        method:  'POST',
        headers: evoHeaders(),
        body:    JSON.stringify({ number: numeroFormatado, text: texto }),
      })
    } catch {
    }
  }

  return NextResponse.json({ ok: true, token })
}
