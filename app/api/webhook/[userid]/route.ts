import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Criado em runtime (não no build) — evita erro "supabaseUrl is required" no build da Vercel
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const CATEGORIAS_VALIDAS = [
  'Alimentação',
  'Transporte',
  'Lazer',
  'Saúde',
  'Moradia',
  'Educação',
  'Receita',
  'Outros',
] as const

type Categoria = (typeof CATEGORIAS_VALIDAS)[number]

interface WebhookPayload {
  descricao: string
  valor: number
  data_hora: string
  tipo: 'debito' | 'credito'
  categoria: Categoria
  referencia_externa?: string
}

type ValidacaoOk   = { ok: true;  data: WebhookPayload }
type ValidacaoFail = { ok: false; erro: string }
type ResultadoValidacao = ValidacaoOk | ValidacaoFail

function validarPayload(body: unknown): ResultadoValidacao {
  if (!body || typeof body !== 'object') {
    return { ok: false, erro: 'Payload deve ser um objeto JSON' }
  }
  const p = body as Record<string, unknown>
  if (!p.descricao || typeof p.descricao !== 'string' || p.descricao.trim() === '') {
    return { ok: false, erro: 'Campo "descricao" é obrigatório e deve ser uma string' }
  }
  if (p.valor === undefined || p.valor === null || typeof p.valor !== 'number' || isNaN(p.valor)) {
    return { ok: false, erro: 'Campo "valor" é obrigatório e deve ser um número' }
  }
  if (!p.data_hora || typeof p.data_hora !== 'string') {
    return { ok: false, erro: 'Campo "data_hora" é obrigatório (formato ISO 8601)' }
  }
  const dataValida = new Date(p.data_hora)
  if (isNaN(dataValida.getTime())) {
    return { ok: false, erro: 'Campo "data_hora" inválido — use formato ISO 8601' }
  }
  const categoriaRaw = typeof p.categoria === 'string' ? p.categoria : ''
  const categoria: Categoria = CATEGORIAS_VALIDAS.includes(categoriaRaw as Categoria)
    ? (categoriaRaw as Categoria)
    : 'Outros'
  const tipo: 'debito' | 'credito' =
    p.tipo === 'credito' || (typeof p.valor === 'number' && p.valor > 0) ? 'credito' : 'debito'
  return {
    ok: true,
    data: {
      descricao: p.descricao.trim().slice(0, 255),
      valor: parseFloat((p.valor as number).toFixed(2)),
      data_hora: p.data_hora,
      tipo,
      categoria,
      referencia_externa:
        typeof p.referencia_externa === 'string'
          ? p.referencia_externa.slice(0, 128)
          : undefined,
    },
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userid: string }> }
) {
  const supabase = getSupabase()
  const startTime = Date.now()
  const { userid: userId } = await params

  if (!userId || !/^[a-zA-Z0-9_-]{8,64}$/.test(userId)) {
    return NextResponse.json({ error: 'userId inválido' }, { status: 400 })
  }

  const authHeader = request.headers.get('Authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

  if (!token) {
    return NextResponse.json(
      { error: 'Header Authorization ausente. Use: Bearer <seu_token>' },
      { status: 401 }
    )
  }

  const { data: webhookConfig, error: configError } = await supabase
    .from('webhook_configs')
    .select('user_id, ativo, plano')
    .eq('user_id', userId)
    .eq('token', token)
    .single()

  if (configError || !webhookConfig) {
    await registrarLog(supabase, userId, null, 401, 'Token inválido', Date.now() - startTime)
    return NextResponse.json(
      { error: 'Token inválido ou webhook não encontrado' },
      { status: 401 }
    )
  }

  if (!webhookConfig.ativo) {
    return NextResponse.json(
      { error: 'Webhook desativado. Reative nas configurações.' },
      { status: 403 }
    )
  }

  const limiteMinuto = webhookConfig.plano === 'free' ? 10 : 60
  const umMinutoAtras = new Date(Date.now() - 60_000).toISOString()

  const { count } = await supabase
    .from('webhook_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 200)
    .gte('created_at', umMinutoAtras)

  if ((count ?? 0) >= limiteMinuto) {
    return NextResponse.json(
      { error: `Rate limit: máximo ${limiteMinuto} requisições por minuto no seu plano` },
      { status: 429 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    await registrarLog(supabase, userId, null, 400, 'JSON inválido', Date.now() - startTime)
    return NextResponse.json(
      { error: 'Corpo da requisição não é um JSON válido' },
      { status: 400 }
    )
  }

  const validacao = validarPayload(body)

  if (!validacao.ok) {
    await registrarLog(supabase, userId, null, 422, validacao.erro, Date.now() - startTime)
    return NextResponse.json({ error: validacao.erro }, { status: 422 })
  }

  const payload = validacao.data

  if (payload.referencia_externa) {
    const { data: existente } = await supabase
      .from('transactions')
      .select('id')
      .eq('user_id', userId)
      .eq('referencia_externa', payload.referencia_externa)
      .maybeSingle()
    if (existente) {
      return NextResponse.json(
        { ok: true, duplicata: true, message: 'Transação já registrada', transaction_id: existente.id },
        { status: 200 }
      )
    }
  }

  const { data: transaction, error: insertError } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      descricao: payload.descricao,
      valor: payload.valor,
      tipo: payload.tipo,
      categoria: payload.categoria,
      data_hora: payload.data_hora,
      referencia_externa: payload.referencia_externa ?? null,
      origem: 'webhook',
    })
    .select('id, descricao, valor, categoria, tipo, data_hora')
    .single()

  if (insertError) {
    console.error('[webhook] Erro ao inserir:', insertError)
    await registrarLog(supabase, userId, null, 500, insertError.message, Date.now() - startTime)
    return NextResponse.json({ error: 'Erro interno ao salvar transação' }, { status: 500 })
  }

  await registrarLog(supabase, userId, transaction.id, 200, null, Date.now() - startTime)
  verificarAlertas(supabase, userId, transaction).catch(console.error)

  return NextResponse.json(
    {
      ok: true,
      transaction_id: transaction.id,
      descricao: transaction.descricao,
      valor: transaction.valor,
      categoria: transaction.categoria,
      data_hora: transaction.data_hora,
    },
    { status: 200 }
  )
}

async function registrarLog(
  supabase: ReturnType<typeof getSupabase>,
  userId: string,
  transactionId: string | null,
  status: number,
  erro: string | null,
  duracaoMs: number
) {
  await supabase.from('webhook_logs').insert({
    user_id: userId,
    transaction_id: transactionId,
    status,
    erro,
    duracao_ms: duracaoMs,
  })
}

async function verificarAlertas(
  supabase: ReturnType<typeof getSupabase>,
  userId: string,
  transaction: { id: string; valor: number; categoria: string; tipo: string }
) {
  const { data: regras } = await supabase
    .from('alert_rules')
    .select('*')
    .eq('user_id', userId)
    .eq('ativo', true)

  if (!regras?.length) return

  const agora = new Date()
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString()

  for (const regra of regras) {
    if (regra.tipo === 'receita_recebida' && transaction.tipo === 'credito') {
      await supabase.from('notifications').insert({
        user_id: userId,
        tipo: 'sugestao_meta',
        titulo: 'Receita recebida',
        mensagem: `+R$ ${Math.abs(transaction.valor).toFixed(2)} — deseja alocar para uma meta?`,
        transaction_id: transaction.id,
      })
      continue
    }
    if (regra.tipo === 'limite_categoria' && transaction.tipo === 'debito') {
      if (transaction.categoria !== regra.categoria) continue
      const { data: soma } = await supabase
        .from('transactions')
        .select('valor')
        .eq('user_id', userId)
        .eq('categoria', regra.categoria)
        .eq('tipo', 'debito')
        .gte('data_hora', inicioMes)
      const totalGasto = soma?.reduce((acc, t) => acc + Math.abs(t.valor), 0) ?? 0
      const pct = regra.limite > 0 ? (totalGasto / regra.limite) * 100 : 0
      if (pct >= regra.threshold_pct) {
        await supabase.from('notifications').insert({
          user_id: userId,
          tipo: 'limite_categoria',
          titulo: `${transaction.categoria}: ${Math.round(pct)}% do limite`,
          mensagem: `Você gastou R$ ${totalGasto.toFixed(2)} de R$ ${regra.limite.toFixed(2)} este mês.`,
          transaction_id: transaction.id,
        })
      }
    }
  }
}
