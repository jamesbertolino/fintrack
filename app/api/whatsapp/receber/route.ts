import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const EVO_URL = () => process.env.EVOLUTION_URL!
const EVO_KEY = () => process.env.EVOLUTION_API_KEY!

function detectarResposta(msg: string): 'pessoal' | 'familiar' | null {
  const m = msg.trim().toLowerCase()
  if (['1', 'p', 'pessoal', 'meu', 'minha'].includes(m)) return 'pessoal'
  if (['2', 'f', 'familia', 'família', 'familiar', 'todos', 'gente'].includes(m)) return 'familiar'
  return null
}

async function enviarMensagem(instancia: string, numero: string, texto: string) {
  await fetch(`${EVO_URL()}/message/sendText/${instancia}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': EVO_KEY() },
    body:    JSON.stringify({ number: numero, text: texto }),
  })
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

  const participante = ((body?.sender as string) || '')
    .replace('@s.whatsapp.net', '')
    .replace('@lid', '')

  console.log('[debug] participante via sender:', participante)

  const messageObj = data?.message as Record<string, unknown> | undefined
  const mensagem   = (messageObj?.conversation as string)
    || ((messageObj?.extendedTextMessage as Record<string, unknown>)?.text as string)
    || ''

  console.log('[whatsapp/receber] grupoJid:', grupoJid)
  console.log('[whatsapp/receber] mensagem:', mensagem)

  if (!mensagem) {
    console.log('[whatsapp/receber] sem texto, ignorando')
    return NextResponse.json({ ok: true })
  }

  const supabase = getSupabase()

  const { data: grupo } = await supabase
    .from('grupos')
    .select('id, criado_por, whatsapp_grupo_id')
    .eq('whatsapp_grupo_id', grupoJid)
    .single()

  if (!grupo) {
    console.log('[whatsapp/receber] grupo não cadastrado no PoupaUp:', grupoJid)
    return NextResponse.json({ ok: true })
  }

  const { data: dono } = await supabase
    .from('profiles')
    .select('evolution_instancia')
    .eq('id', grupo.criado_por)
    .single()

  const instancia = dono?.evolution_instancia || ''

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, nome, whatsapp')
    .or(`whatsapp.eq.${participante},whatsapp.ilike.%${participante.slice(-8)}%`)
    .single()

  console.log('[debug] profile encontrado:', profile?.nome, profile?.whatsapp)

  if (!profile) {
    console.log('[whatsapp/receber] participante não cadastrado no PoupaUp:', participante)
    if (instancia) {
      await enviarMensagem(
        instancia,
        grupoJid!,
        '❓ Número não cadastrado no PoupaUp. Acesse poupaup.com.br para criar sua conta.'
      )
    }
    return NextResponse.json({ ok: true })
  }

  // Verificar se é uma resposta a um pendente
  const respostaPendente = detectarResposta(mensagem)

  if (respostaPendente) {
    const { data: pendente } = await supabase
      .from('whatsapp_pendentes')
      .select('*')
      .eq('numero', participante)
      .eq('grupo_jid', remoteJid)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (pendente) {
      const interpretacao = pendente.interpretacao as {
        descricao: string; valor: number; tipo: string; categoria: string
      }

      await supabase.from('transactions').insert({
        user_id:           pendente.user_id,
        descricao:         interpretacao.descricao,
        valor:             interpretacao.tipo === 'debito' ? -Math.abs(interpretacao.valor) : Math.abs(interpretacao.valor),
        tipo:              interpretacao.tipo,
        categoria:         interpretacao.categoria,
        data_hora:         new Date().toISOString(),
        origem:            'whatsapp',
        grupo_id:          grupo.id,
        tipo_visibilidade: respostaPendente,
      })

      await supabase.from('whatsapp_pendentes').delete().eq('id', pendente.id)

      const emoji     = interpretacao.tipo === 'debito' ? '💸' : '💰'
      const sinal     = interpretacao.tipo === 'debito' ? '-' : '+'
      const tipoLabel = respostaPendente === 'familiar' ? '👨‍👩‍👧 familiar' : '👤 pessoal'

      await enviarMensagem(
        instancia,
        remoteJid,
        `${emoji} *Lançado como ${tipoLabel}!*\n\n📝 ${interpretacao.descricao}\n💵 ${sinal}R$ ${Math.abs(interpretacao.valor).toFixed(2)}\n🏷️ ${interpretacao.categoria}\n\n_PoupaUp_ ✓`
      )
      return NextResponse.json({ ok: true })
    } else {
      await enviarMensagem(instancia, remoteJid, '⏱ Tempo esgotado. Por favor, mande a mensagem novamente.')
      return NextResponse.json({ ok: true })
    }
  }

  // Verificar prefixos diretos
  const prefixoPessoal  = /^(p:|pessoal:)\s*/i.test(mensagem)
  const prefixoFamiliar = /^(f:|familia:|família:)\s*/i.test(mensagem)
  const mensagemLimpa   = mensagem.replace(/^(p:|f:|pessoal:|familia:|família:)\s*/i, '').trim()

  // Buscar modo_uso do usuário
  const { data: profileUser } = await supabase
    .from('profiles')
    .select('modo_uso')
    .eq('id', profile.id)
    .single()

  const modoUso          = profileUser?.modo_uso || 'pessoal'
  const temGrupoFamiliar = !!grupo

  // Decidir se precisa perguntar
  let precisaPerguntar = false
  if (prefixoPessoal) {
    // lança direto como pessoal
  } else if (prefixoFamiliar) {
    // lança direto como familiar
  } else if (temGrupoFamiliar && modoUso === 'ambos') {
    precisaPerguntar = true
  } else if (temGrupoFamiliar && modoUso === 'familiar') {
    precisaPerguntar = true
  } else if ((mensagemLimpa || mensagem).match(/família|familia|casa|nós|nos|gente|juntos/i)) {
    precisaPerguntar = true
  }

  // Chamar IA para interpretar
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const secret = process.env.N8N_WEBHOOK_SECRET  || 'granaup-secret-2026'

  let dadosIA: Record<string, unknown> = {}
  try {
    const respostaIA = await fetch(`${appUrl}/api/whatsapp/parse`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-n8n-secret': secret },
      body:    JSON.stringify({
        numero:             participante,
        mensagem:           mensagemLimpa || mensagem,
        grupo_id:           grupo.id,
        apenas_interpretar: precisaPerguntar,
      }),
    })
    dadosIA = await respostaIA.json() as Record<string, unknown>
    console.log('[whatsapp/receber] parse status:', respostaIA.status, 'resposta:', JSON.stringify(dadosIA))
  } catch (err) {
    console.log('[whatsapp/receber] erro ao chamar parse:', err)
  }

  if (!dadosIA.ok) {
    return NextResponse.json({ ok: true })
  }

  if (precisaPerguntar) {
    const interp = dadosIA.interpretacao as { descricao: string; valor: number; tipo: string; categoria: string } | undefined

    if (interp) {
      const expires = new Date(Date.now() + 5 * 60 * 1000)
      await supabase.from('whatsapp_pendentes').insert({
        grupo_jid:         remoteJid,
        numero:            participante,
        user_id:           profile.id,
        mensagem_original: mensagem,
        interpretacao: {
          descricao: interp.descricao,
          valor:     interp.valor,
          tipo:      interp.tipo,
          categoria: interp.categoria,
        },
        expires_at: expires.toISOString(),
      })

      const emoji = interp.tipo === 'debito' ? '💸' : '💰'
      const sinal = interp.tipo === 'debito' ? '-' : '+'

      await enviarMensagem(
        instancia,
        remoteJid,
        `${emoji} *Detectei:* ${interp.descricao} ${sinal}R$ ${Math.abs(interp.valor).toFixed(2)} (${interp.categoria})\n\nEsse lançamento é:\n1️⃣ *Pessoal* (só seu)\n2️⃣ *Família* (para todos)\n\n_Responda 1, 2, p ou f — expira em 5 min_`
      )
    }

    return NextResponse.json({ ok: true })
  }

  // Sem necessidade de perguntar — transação já foi criada pelo parse
  if (!dadosIA.transacao_id) {
    return NextResponse.json({ ok: true })
  }

  const tipoVisibilidade = prefixoFamiliar ? 'familiar' :
                           modoUso === 'familiar' ? 'familiar' : 'pessoal'

  await supabase.from('transactions')
    .update({ tipo_visibilidade: tipoVisibilidade })
    .eq('id', dadosIA.transacao_id)

  // Envia resposta de volta para o grupo
  const resposta = (dadosIA.resposta as string) || ''
  if (resposta && instancia) {
    await enviarMensagem(instancia, grupoJid!, resposta)
  }

  return NextResponse.json({ ok: true })
}
