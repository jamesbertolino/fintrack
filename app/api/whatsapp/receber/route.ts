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

async function enviarMensagemGrupo(instancia: string, grupoJid: string, text: string) {
  try {
    const res = await fetch(`${EVO_URL()}/message/sendText/${instancia}`, {
      method:  'POST',
      headers: evoHeaders(),
      body:    JSON.stringify({ number: grupoJid, text }),
    })
    console.log('[whatsapp/receber] sendText status:', res.status)
  } catch (err) {
    console.log('[whatsapp/receber] erro ao enviar mensagem grupo:', err)
  }
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    console.log('[whatsapp/receber] body inválido')
    return NextResponse.json({ ok: true })
  }

  console.log('[whatsapp/receber] body completo:', JSON.stringify(body, null, 2))
  console.log('[whatsapp/receber] remoteJid:', (body.data as Record<string, unknown> | undefined)?.key && ((body.data as Record<string, unknown>).key as Record<string, unknown>)?.remoteJid)
  console.log('[whatsapp/receber] participant:', (body.data as Record<string, unknown> | undefined)?.key && ((body.data as Record<string, unknown>).key as Record<string, unknown>)?.participant)
  console.log('[whatsapp/receber] pushName:', (body.data as Record<string, unknown> | undefined)?.pushName)

  const evento = body.event as string | undefined
  const data   = body.data as Record<string, unknown> | undefined
  const key    = data?.key as Record<string, unknown> | undefined

  if (evento !== 'messages.upsert') {
    console.log('[whatsapp/receber] evento ignorado:', evento)
    return NextResponse.json({ ok: true })
  }

  const remoteJid = (key?.remoteJid as string) || ''
  const isGrupo   = remoteJid.endsWith('@g.us')
  const grupoJid  = isGrupo ? remoteJid : null

  if (!isGrupo) {
    console.log('[whatsapp/receber] ignorando mensagem privada — apenas grupos são processados')
    return NextResponse.json({ ok: true, ignorado: 'mensagem privada' })
  }

  // Extrai participante (quem enviou dentro do grupo)
  const participante = ((key?.participant as string) || (data?.participant as string) || '')
    .replace('@s.whatsapp.net', '')

  // Extrai texto
  const messageObj = data?.message as Record<string, unknown> | undefined
  const mensagem   = (messageObj?.conversation as string)
    || ((messageObj?.extendedTextMessage as Record<string, unknown>)?.text as string)
    || ''

  console.log('[debug] body.data.key:', JSON.stringify(key))
  console.log('[debug] body.data.participant:', data?.participant)
  console.log('[debug] body.data.pushName:', data?.pushName)
  console.log('[debug] participante extraido:', participante)
  console.log('[whatsapp/receber] grupoJid:', grupoJid)
  console.log('[whatsapp/receber] mensagem:', mensagem)

  if (!mensagem) {
    console.log('[whatsapp/receber] sem texto, ignorando')
    return NextResponse.json({ ok: true })
  }

  const supabase = getSupabase()

  // Busca grupo pelo whatsapp_grupo_id
  const { data: grupo } = await supabase
    .from('grupos')
    .select('id, criado_por, whatsapp_grupo_id')
    .eq('whatsapp_grupo_id', grupoJid)
    .single()

  if (!grupo) {
    console.log('[whatsapp/receber] grupo não cadastrado no GranaUp:', grupoJid)
    return NextResponse.json({ ok: true })
  }

  // Busca instância Evolution do dono do grupo
  const { data: dono } = await supabase
    .from('profiles')
    .select('evolution_instancia')
    .eq('id', grupo.criado_por)
    .single()

  const instancia = dono?.evolution_instancia || ''

  // Busca perfil do participante
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, nome, whatsapp')
    .eq('whatsapp', participante)
    .single()

  if (!profile) {
    console.log('[whatsapp/receber] participante não cadastrado no GranaUp:', participante)
    if (instancia) {
      await enviarMensagemGrupo(
        instancia,
        grupoJid!,
        '❓ Número não cadastrado no GranaUp. Acesse granaup.com.br para criar sua conta.'
      )
    }
    return NextResponse.json({ ok: true })
  }

  // Chama o parse
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const secret = process.env.N8N_WEBHOOK_SECRET  || 'granaup-secret-2026'

  let resposta = ''
  try {
    const parseRes  = await fetch(`${appUrl}/api/whatsapp/parse`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-n8n-secret': secret },
      body:    JSON.stringify({ numero: participante, mensagem, grupo_id: grupo.id }),
    })
    const parseData = await parseRes.json() as Record<string, unknown>
    console.log('[whatsapp/receber] parse status:', parseRes.status, 'resposta:', JSON.stringify(parseData))
    resposta = (parseData.resposta as string) || ''
  } catch (err) {
    console.log('[whatsapp/receber] erro ao chamar parse:', err)
  }

  // Envia resposta de volta para o grupo
  if (resposta && instancia) {
    await enviarMensagemGrupo(instancia, grupoJid!, resposta)
  }

  return NextResponse.json({ ok: true })
}
