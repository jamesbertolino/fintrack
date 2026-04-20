import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Cliente admin — usa a SERVICE ROLE KEY (nunca exponha no frontend)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Categorias reconhecidas pelo app
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

// Shape do payload esperado do n8n
interface WebhookPayload {
  descricao: string
  valor: number          // negativo = despesa, positivo = receita
  data_hora: string      // ISO 8601 ex: "2026-04-17T14:32:01Z"
  tipo?: 'debito' | 'credito'
  categoria?: string
  referencia_externa?: string // ID da transação no banco de origem (evita duplicatas)
}

// Validação e sanitização do payload
function validarPayload(body: unknown): { data: WebhookPayload; erro: null } | { data: null; erro: string } {
  if (!body || typeof body !== 'object') {
    return { data: null, erro: 'Payload deve ser um objeto JSON' }
  }

  const p = body as Record<string, unknown>

  if (!p.descricao || typeof p.descricao !== 'string' || p.descricao.trim() === '') {
    return { data: null, erro: 'Campo "descricao" é obrigatório e deve ser uma string' }
  }

  if (p.valor === undefined || p.valor === null || typeof p.valor !== 'number' || isNaN(p.valor)) {
    return { data: null, erro: 'Campo "valor" é obrigatório e deve ser um número' }
  }

  if (!p.data_hora || typeof p.data_hora !== 'string') {
    return { data: null, erro: 'Campo "data_hora" é obrigatório (formato ISO 8601)' }
  }

  const dataValida = new Date(p.data_hora)
  if (isNaN(dataValida.getTime())) {
    return { data: null, erro: 'Campo "data_hora" inválido — use formato ISO 8601' }
  }

  // Categoria: aceita o que vier, normaliza para "Outros" se não reconhecer
  const categoriaRaw = typeof p.categoria === 'string' ? p.categoria : ''
  const categoria: Categoria = CATEGORIAS_VALIDAS.includes(categoriaRaw as Categoria)
    ? (categoriaRaw as Categoria)
    : 'Outros'

  // Tipo: derivado do sinal do valor se não informado
  const tipo = p.tipo === 'credito' || p.valor > 0 ? 'credito' : 'debito'

  return {
    data: {
      descricao: p.descricao.trim().slice(0, 255),
      valor: parseFloat(p.valor.toFixed(2)),
      data_hora: p.data_hora,
      tipo,
      categoria,
      referencia_externa: typeof p.referencia_externa === 'string'
        ? p.referencia_externa.slice(0, 128)
        : undefined,
    },
    erro: null,
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  const startTime = Date.now()
  const { userId } = params

  // 1. Validar formato básico do userId
  if (!userId || !/^[a-zA-Z0-9_-]{8,64}$/.test(userId)) {
    return NextResponse.json(
      { error: 'userId inválido' },
      { status: 400 }
    )
  }

  // 2. Autenticar via Bearer token
  const authHeader = request.headers.get('Authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

  if (!token) {
    return NextResponse.json(
      { error: 'Header Authorization ausente. Use: Bearer <seu_token>' },
      { status: 401 }
    )
  }

  // 3. Verificar se o token pertence ao usuário
  const { data: webhookConfig, error: configError } = await supabase
    .from('webhook_configs')
    .select('user_id, ativo, plano')
    .eq('user_id', userId)
    .eq('token', token)
    .single()

  if (configError || !webhookConfig) {
    await registrarLog(userId, null, 401, 'Token inválido', Date.now() - startTime)
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

  // 4. Rate limiting por plano
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

  // 5. Ler e validar o payload
  let body: unknown
  try {
    body = await request.json()
  } catch {
    await registrarLog(userId, null, 400, 'JSON inválido', Date.now() - startTime)
    return NextResponse.json(
      { error: 'Corpo da requisição não é um JSON válido' },
      { status: 400 }
    )
  }

  const validacao = validarPayload(body)
  if (validacao.erro) {
    await registrarLog(userId, null, 422, validacao.erro, Date.now() - startTime)
    return NextResponse.json(
      { error: validacao.erro },
      { status: 422 }
    )
  }

  const payload = validacao.data

  // 6. Verificar duplicata via referencia_externa
  if (payload.referencia_externa) {
    const { data: existente } = await supabase
      .from('transactions')
      .select('id')
      .eq('user_id', userId)
      .eq('referencia_externa', payload.referencia_externa)
      .maybeSingle()

    if (existente) {
      return NextResponse.json(
        {
          ok: true,
          duplicata: true,
          message: 'Transação já registrada anteriormente',
          transaction_id: existente.id,
        },
        { status: 200 }
      )
    }
  }

  // 7. Inserir transação no banco
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
    console.error('[webhook] Erro ao inserir transação:', insertError)
    await registrarLog(userId, null, 500, insertError.message, Date.now() - startTime)
    return NextResponse.json(
      { error: 'Erro interno ao salvar transação' },
      { status: 500 }
    )
  }

  // 8. Registrar log de sucesso
  await registrarLog(userId, transaction.id, 200, null, Date.now() - startTime)

  // 9. Disparar verificação de alertas (sem bloquear resposta)
  verificarAlertas(userId, transaction).catch((err) =>
    console.error('[webhook] Erro ao verificar alertas:', err)
  )

  // 10. Responder com sucesso
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

// Registra cada chamada no log para auditoria e debug
async function registrarLog(
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

// Verifica regras de alerta após cada transação (roda em background)
async function verificarAlertas(
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
    // Alerta: receita recebida → sugerir alocação para meta
    if (regra.tipo === 'receita_recebida' && transaction.tipo === 'credito') {
      await supabase.from('notifications').insert({
        user_id: userId,
        tipo: 'sugestao_meta',
        titulo: 'Receita recebida',
        mensagem: `${transaction.categoria} +R$ ${Math.abs(transaction.valor).toFixed(2)} — deseja alocar para uma meta?`,
        transaction_id: transaction.id,
      })
      continue
    }

    // Alerta: categoria atingiu % do limite mensal
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
          mensagem: `Você gastou R$ ${totalGasto.toFixed(2)} de R$ ${regra.limite.toFixed(2)} em ${transaction.categoria} este mês.`,
          transaction_id: transaction.id,
        })
      }
    }
  }
}