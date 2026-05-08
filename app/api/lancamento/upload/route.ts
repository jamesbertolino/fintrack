import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { rateLimit } from '@/lib/rateLimit'

const CATEGORIAS = ['Alimentação','Transporte','Lazer','Saúde','Moradia','Educação','Salário','Freelance','Investimento','Presente','Outros']

export interface TransacaoDetectada {
  descricao: string
  tipo_pagamento?: string
  valor: number
  tipo: string
  categoria: string
  data_hora: string
  nao_categorizado?: boolean
}

// ─── Detecta categoria por palavra-chave ─────────────────────────────────────
function detectarCategoria(desc: string): { categoria: string; nao_categorizado: boolean } {
  const d = desc.toLowerCase()
  if (d.match(/mercado|supermercado|ifood|restauran|alimenta|padaria|lanchon|açougue|hortifrut|pao de acucar|extra|carrefour|atacadao|assai|supa/)) return { categoria: 'Alimentação', nao_categorizado: false }
  if (d.match(/uber|99pop|cabify|combustiv|gasolina|etanol|posto |transporte|ônibus|onibus|metro|passagem|bilhete|estacion|pedagio|táxi|taxi|mototaxi/)) return { categoria: 'Transporte', nao_categorizado: false }
  if (d.match(/netflix|spotify|amazon prime|hbo|disney|globoplay|cinema|parque|lazer|game|steam|playstation|xbox|ingresso|show|teatro|bar |balada/)) return { categoria: 'Lazer', nao_categorizado: false }
  if (d.match(/farmácia|farmacia|drogaria|saúde|saude|médico|medico|hospital|clinica|dentista|exame|laboratorio|plano de saude|unimed|amil|convenio/)) return { categoria: 'Saúde', nao_categorizado: false }
  if (d.match(/aluguel|condomin|água|agua|energia|luz |gas |internet|telefone|moradia|iptu|conta de /)) return { categoria: 'Moradia', nao_categorizado: false }
  if (d.match(/escola|faculdade|curso|educaç|educac|universidade|colégio|colegio|mensalidade|material escolar/)) return { categoria: 'Educação', nao_categorizado: false }
  if (d.match(/salário|salario|folha|pgto|pagamento recebido|vencimento|remuneracao|proventos/)) return { categoria: 'Salário', nao_categorizado: false }
  if (d.match(/freelance|free-lance|serviço prestado|honorario/)) return { categoria: 'Freelance', nao_categorizado: false }
  if (d.match(/rendimento|investimento|dividendo|juros|cdb|lci|lca|tesouro|acoes|acão|fundo /)) return { categoria: 'Investimento', nao_categorizado: false }
  if (d.match(/presente|gift|mimo/)) return { categoria: 'Presente', nao_categorizado: false }
  return { categoria: 'Outros', nao_categorizado: true }
}

// ─── Converte valor BR para número ───────────────────────────────────────────
function parseBRL(val: string): number {
  if (!val || !val.trim()) return 0
  return parseFloat(val.replace(/\./g, '').replace(',', '.')) || 0
}

// ─── Converte data DD/MM/YYYY para ISO ───────────────────────────────────────
function parseData(val: string): string {
  if (!val || !val.trim()) return new Date().toISOString()
  const partes = val.trim().split('/')
  if (partes.length === 3) {
    const [dia, mes, ano] = partes
    const d = new Date(Number(ano), Number(mes) - 1, Number(dia))
    if (!isNaN(d.getTime())) return d.toISOString()
  }
  return new Date().toISOString()
}

// ─── Processa CSV ─────────────────────────────────────────────────────────────
function processarCSV(texto: string): TransacaoDetectada[] {
  const linhas = texto.split('\n').map(l => l.trim())
  const resultado: TransacaoDetectada[] = []

  let idxCabecalho = -1
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i].toLowerCase()
    if (l.includes('data') && l.includes('hist')) { idxCabecalho = i; break }
  }
  if (idxCabecalho === -1) return []

  const cabecalho = linhas[idxCabecalho].split(';').map(c => c.toLowerCase().trim().replace(/"/g, ''))
  const iData    = cabecalho.findIndex(c => c === 'data')
  const iHist    = cabecalho.findIndex(c => c.includes('hist'))
  const iCredito = cabecalho.findIndex(c => c.includes('créd') || c.includes('cred'))
  const iDebito  = cabecalho.findIndex(c => c.includes('déb') || c.includes('deb'))

  if (iData === -1 || iHist === -1) return []

  for (let i = idxCabecalho + 1; i < linhas.length; i++) {
    const linha = linhas[i]
    if (!linha || linha.startsWith(';') || linha.startsWith('Filtro') || linha.startsWith('Os dados') || linha.startsWith('Últimos') || linha.startsWith(';;Total')) continue
    const cols = linha.split(';').map(c => c.trim().replace(/"/g, ''))
    const dataVal = cols[iData] || ''
    const hist    = cols[iHist] || ''
    if (!dataVal.match(/\d{2}\/\d{2}\/\d{4}/) || !hist) continue
    if (hist.includes('COD. LANC')) continue
    const credito = iCredito !== -1 ? parseBRL(cols[iCredito]) : 0
    const debito  = iDebito  !== -1 ? parseBRL(cols[iDebito])  : 0
    if (credito === 0 && debito === 0) continue
    const tipo  = credito > 0 ? 'credito' : 'debito'
    const valor = credito > 0 ? credito : debito
    const { categoria, nao_categorizado } = detectarCategoria(hist)
    resultado.push({ descricao: hist.trim().toUpperCase(), valor, tipo, categoria, data_hora: parseData(dataVal), nao_categorizado })
  }
  return resultado
}

// ─── Prompt padrão para IA ────────────────────────────────────────────────────
const PROMPT_BASE = `Você é um extrator de dados financeiros especializado em documentos brasileiros.
Analise o documento e extraia TODAS as transações financeiras visíveis.

Tipos de documento aceitos: extrato bancário, fatura de cartão, nota fiscal, holerite, recibo, comprovante, cupom fiscal.

Retorne APENAS JSON válido, sem texto adicional, sem markdown.

Categorias disponíveis: ${CATEGORIAS.join(', ')}

Formato obrigatório:
{
  "tipo_documento": "extrato_bancario | fatura_cartao | nota_fiscal | holerite | recibo | outro",
  "banco_nome": "nome do banco/emitente ou null",
  "resumo": "ex: 23 transações de Jan/2025",
  "transacoes": [
    {
      "descricao": "nome do estabelecimento, pessoa ou finalidade — nunca o tipo de pagamento",
      "tipo_pagamento": "PIX | TED | DOC | Débito | Crédito | Boleto | Transferência | Saque | Tarifa | null",
      "valor": 150.00,
      "tipo": "debito ou credito",
      "categoria": "categoria mais provável da lista",
      "nao_categorizado": false,
      "data_hora": "2025-01-15T00:00:00.000Z"
    }
  ]
}

Regras CRÍTICAS de extração:
- "descricao" deve ser o DESTINATÁRIO ou FINALIDADE real da transação (ex: "SUPERMERCADO EXTRA", "NETFLIX", "JOAO SILVA", "ALUGUEL APARTAMENTO")
- NUNCA coloque em "descricao" o tipo de pagamento (PIX, TED, Débito, Crédito, Cartão Visa, etc.)
- "tipo_pagamento" é o meio/modalidade: PIX, TED, DOC, Débito, Crédito, Boleto, Transferência, Saque, Tarifa, Estorno, etc.
- Quando o documento tiver linha com "PIX - MERCADINHO SILVA": descricao="MERCADINHO SILVA", tipo_pagamento="PIX"
- Quando tiver "Compra Cartão Visa - iFood": descricao="IFOOD", tipo_pagamento="Crédito"
- Se a descrição real vier na linha abaixo do tipo (padrão comum em extratos): use a linha de baixo como descricao
- Use a categoria mais específica possível
- nao_categorizado: true SOMENTE quando impossível inferir o destinatário (ex: apenas código numérico sem nome)
- tipo "debito" para gastos/saídas; tipo "credito" para receitas/entradas
- valor sempre número positivo
- Para holerites: salário líquido = credito, descontos = debito
- data_hora sempre ISO 8601, sem hora use T00:00:00.000Z
- Ignore totais, saldos, cabeçalhos e rodapés
- Extraia TODAS as transações sem omitir nenhuma`

// ─── Fetch OpenAI com timeout de 20s para não travar a serverless function ────
async function fetchOpenAI(key: string, body: object): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 20000)
  try {
    return await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

// ─── Chama OpenAI e retorna todas as transações, continuando se truncado ──────
async function chatComContinuacao(
  openaiKey: string,
  mensagensIniciais: { role: string; content: unknown }[],
  model = 'gpt-4o',
): Promise<unknown[]> {
  const todasTransacoes: unknown[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mensagens: any[] = [...mensagensIniciais]

  for (let rodada = 0; rodada < 5; rodada++) {
    const chatRes = await fetchOpenAI(openaiKey, { model, max_tokens: 16384, messages: mensagens })
    const chatData = await chatRes.json()
    if (!chatRes.ok) throw new Error(chatData.error?.message || 'Erro na OpenAI')

    const texto  = chatData.choices?.[0]?.message?.content || ''
    const finish = chatData.choices?.[0]?.finish_reason

    const parsed = parseIAResponse(texto)
    const lote: unknown[] = parsed.transacoes || []
    todasTransacoes.push(...lote)

    // Preenche campos de metadados apenas na primeira rodada
    if (rodada === 0) {
      parsed._meta = parsed._meta || {}
      parsed._meta.tipo_documento = parsed.tipo_documento
      parsed._meta.banco_nome     = parsed.banco_nome
      parsed._meta.resumo         = parsed.resumo
    }

    if (finish !== 'length' || lote.length === 0) break

    // Monta continuação — pede o restante a partir da última transação extraída
    const ultima = lote[lote.length - 1] as { descricao?: string }
    mensagens.push({ role: 'assistant', content: texto })
    mensagens.push({
      role: 'user',
      content: `A resposta foi truncada. Continue extraindo as transações restantes a partir da que vem DEPOIS de "${ultima?.descricao ?? ''}". Retorne APENAS o array JSON de transações, sem o objeto externo.`,
    })
  }

  return todasTransacoes
}

// ─── Processa CSV via OpenAI (qualquer formato) ──────────────────────────────
async function processarCSVComIA(texto: string) {
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) throw new Error('OPENAI_API_KEY não configurada')

  // Envia até 100k chars — cobre extratos de ~12 meses
  const conteudo = texto.slice(0, 100000)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mensagens: any[] = [{
    role: 'user',
    content: `${PROMPT_BASE}\n\nConteúdo do CSV:\n\`\`\`\n${conteudo}\n\`\`\``,
  }]

  // Primeira chamada para obter metadados e transações
  const chatRes = await fetchOpenAI(openaiKey, { model: 'gpt-4o', max_tokens: 16384, messages: mensagens })
  const chatData = await chatRes.json()
  if (!chatRes.ok) throw new Error(chatData.error?.message || 'Erro na OpenAI')

  const content = chatData.choices?.[0]?.message?.content || ''
  const finish  = chatData.choices?.[0]?.finish_reason
  const parsed  = parseIAResponse(content)

  let transacoes: unknown[] = parsed.transacoes || []

  // Se truncado, busca o restante via continuação
  if (finish === 'length' && transacoes.length > 0) {
    mensagens.push({ role: 'assistant', content })
    const ultima = transacoes[transacoes.length - 1] as { descricao?: string }
    mensagens.push({
      role: 'user',
      content: `A resposta foi truncada. Continue extraindo as transações restantes a partir da que vem DEPOIS de "${ultima?.descricao ?? ''}". Retorne APENAS o array JSON de transações.`,
    })
    const extras = await chatComContinuacao(openaiKey, mensagens)
    transacoes = [...transacoes, ...extras]
  }

  return { ...parsed, transacoes }
}

// ─── Tenta recuperar JSON truncado pela IA ────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseIAResponse(texto: string): any {
  const limpo = texto.replace(/```json|```/g, '').trim()
  try {
    return JSON.parse(limpo)
  } catch {
    // JSON truncado: remove a última transação incompleta e fecha o objeto
    const ultimoObjCompleto = limpo.lastIndexOf('},')
    if (ultimoObjCompleto === -1) throw new Error('Resposta da IA não contém JSON válido')
    const parcial = limpo.slice(0, ultimoObjCompleto + 1) + ']}'
    try {
      return JSON.parse(parcial)
    } catch {
      throw new Error('Não foi possível recuperar o JSON truncado da IA')
    }
  }
}

// ─── Extrai tipo de pagamento do início da descrição ─────────────────────────
const PREFIXOS_PAGAMENTO: [RegExp, string][] = [
  [/^CARTAO VISA ELECTRON\b/i,          'Débito'],
  [/^CARTAO MASTERCARD DEBITO\b/i,       'Débito'],
  [/^CARTAO VISA\b/i,                    'Crédito'],
  [/^CARTAO MASTERCARD\b/i,              'Crédito'],
  [/^CARTAO\b/i,                         'Cartão'],
  [/^PIX QR CODE ESTATICO\b/i,           'PIX'],
  [/^PIX QR CODE\b/i,                    'PIX'],
  [/^TRANSFERENCIA PIX\b/i,              'PIX'],
  [/^PIX\b/i,                            'PIX'],
  [/^PAGTO ELETRON COBRANCA\b/i,         'Boleto'],
  [/^PAGTO ELETRON\b/i,                  'Pagamento Eletrônico'],
  [/^PAGAMENTO BOLETO\b/i,               'Boleto'],
  [/^DEBITO AUTOMATICO\b/i,              'Débito Automático'],
  [/^TED\b/i,                            'TED'],
  [/^DOC\b/i,                            'DOC'],
  [/^SAQUE\b/i,                          'Saque'],
  [/^TARIFA\b/i,                         'Tarifa'],
  [/^ESTORNO\b/i,                        'Estorno'],
  [/^RESGATE\b/i,                        'Resgate'],
  [/^APLICACAO\b/i,                      'Aplicação'],
  [/^TRANSFERENCIA\b/i,                  'Transferência'],
  [/^DEPOSITO\b/i,                       'Depósito'],
  [/^CREDITO EM CONTA\b/i,               'Crédito em Conta'],
  [/^DES:\s*/i,                          ''],  // remove prefixo "DES:" mas não define tipo
]

function extrairTipoPagamento(raw: string): { descricao: string; tipo_pagamento: string } {
  for (const [re, tipo] of PREFIXOS_PAGAMENTO) {
    if (re.test(raw)) {
      const descricao = raw.replace(re, '').replace(/^[-–:]\s*/, '').trim()
      return { descricao: descricao || raw, tipo_pagamento: tipo }
    }
  }
  return { descricao: raw, tipo_pagamento: '' }
}

// ─── Parser local para PDF: texto contínuo, padrão código+valor+saldo ─────────
function pdfParserLocal(text: string): TransacaoDetectada[] {
  const flat = text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()

  // Pula cabeçalho até header da tabela "Saldo (R$)"
  const hIdx = flat.search(/Saldo\s*\(R\$\)/i)
  const content = hIdx !== -1 ? flat.slice(hIdx + 20) : flat

  // Código numérico de 6-7 dígitos (padrão Bradesco/Itaú/BB) + valor + saldo
  const reTrans = /\b(\d{6,7})\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s+(\d{1,3}(?:\.\d{3})*,\d{2})\b/g
  const reData4 = /\b(\d{2}\/\d{2}\/\d{4})\b/g
  const reData2 = /\b\d{2}\/\d{2}\b/g

  let saldoAnt = 0
  const mSaldo = content.match(/COD\.?\s*LANC\.[^0-9]*\d*[,\s.]*\d*,\d{2}\s+([\d.]+,\d{2})/)
  if (mSaldo) saldoAnt = parseFloat(mSaldo[1].replace(/\./g, '').replace(',', '.')) || 0

  const resultado: TransacaoDetectada[] = []
  let dataAtual = ''
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = reTrans.exec(content)) !== null) {
    const segmento = content.slice(lastIndex, match.index).trim()
    lastIndex = match.index + match[0].length

    const datas = [...segmento.matchAll(reData4)]
    if (datas.length > 0) dataAtual = datas[datas.length - 1][1]

    const rawDesc = segmento
      .replace(reData4, '')
      .replace(reData2, '')
      .replace(/COD\.?\s*LANC\.[^A-Z]*/gi, '')
      .replace(/\bDES:\s*/gi, '')          // remove prefixo "DES:" de PIX
      .replace(/\bAG\d+\b/g, '')           // remove "AG02154" (agência no código)
      .replace(/\s{2,}/g, ' ')
      .trim()

    if (!rawDesc || rawDesc.length < 3 || !dataAtual) continue
    if (/^[\d\s.,]+$/.test(rawDesc)) continue

    const valor     = match[2]
    const saldoAtu  = parseFloat(match[3].replace(/\./g, '').replace(',', '.')) || 0
    const isCredito = saldoAtu > saldoAnt
    saldoAnt = saldoAtu

    const valorNum = parseFloat(valor.replace(/\./g, '').replace(',', '.')) || 0
    if (valorNum === 0) continue

    const { descricao, tipo_pagamento } = extrairTipoPagamento(rawDesc)
    const { categoria, nao_categorizado } = detectarCategoria(descricao)

    resultado.push({
      descricao: descricao.replace(/[;]/g, ' ').toUpperCase(),
      tipo_pagamento: tipo_pagamento || undefined,
      valor: valorNum,
      tipo: isCredito ? 'credito' : 'debito',
      categoria,
      nao_categorizado,
      data_hora: parseData(dataAtual),
    })
  }

  return resultado
}

// ─── Prompt simplificado para conversão de página PDF → CSV ──────────────────
const PROMPT_PDF_PAGINA = `Você é um extrator de extratos bancários brasileiros.
Analise o texto abaixo e retorne APENAS um CSV válido (sem markdown, sem texto extra) com o cabeçalho:
Data;Historico;Credito;Debito

Regras CRÍTICAS:
- Data no formato DD/MM/YYYY
- Historico: nome do estabelecimento/beneficiário — NUNCA o tipo de pagamento (PIX, Cartão, etc.)
- Credito: preencha APENAS se o saldo da conta AUMENTOU (dinheiro ENTROU na conta: salário, Pix recebido, estorno, rendimento)
- Debito: preencha APENAS se o saldo da conta DIMINUIU (dinheiro SAIU da conta: compra, pagamento, saque, transferência enviada)
- Nunca preencha Credito e Debito ao mesmo tempo na mesma linha
- Use o saldo consecutivo para determinar: saldo subiu = Credito, saldo caiu = Debito
- Valores no formato brasileiro: 710,70 (sem R$, sem separador de milhar desnecessário)
- Ignore linhas de cabeçalho, totais, saldos iniciais e rodapés
- Não inclua COD. LANC. nem linhas com valor 0,00
- Se a página não tiver transações, retorne apenas o cabeçalho`

// ─── Processa PDF: cada página → IA → CSV → processarCSV (mesmo fluxo do CSV) ─
async function processarPDF(bytes: ArrayBuffer) {
  const { extractText } = await import('unpdf')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resultado = await extractText(new Uint8Array(bytes), { mergePages: false }) as any
  const paginas: string[] = Array.isArray(resultado.text) ? resultado.text : [resultado.text ?? '']
  const paginasValidas = paginas.filter((p: string) => p && p.trim().length > 10)

  if (paginasValidas.length === 0) {
    throw new Error('Não foi possível extrair texto do PDF. O arquivo pode ser uma imagem escaneada.')
  }

  const openaiKey = process.env.OPENAI_API_KEY
  if (openaiKey) {
    try {
      // Cada página vira uma chamada independente: IA retorna CSV, não JSON
      const paginaParaCSV = (pagina: string): Promise<string> =>
        fetchOpenAI(openaiKey, {
          model: 'gpt-4o-mini',
          max_tokens: 4096,
          temperature: 0,
          messages: [{
            role: 'user',
            content: `${PROMPT_PDF_PAGINA}\n\nTexto da página:\n\`\`\`\n${pagina.slice(0, 8000)}\n\`\`\``,
          }],
        })
        .then(async res => {
          const data = await res.json()
          if (!res.ok) return ''
          return data.choices?.[0]?.message?.content?.replace(/```[a-z]*/gi, '').replace(/```/g, '').trim() ?? ''
        })
        .catch(() => '')

      // Lotes de 8 páginas em paralelo
      const csvPaginas: string[] = []
      const BATCH = 8
      for (let i = 0; i < paginasValidas.length; i += BATCH) {
        const lote = await Promise.all(paginasValidas.slice(i, i + BATCH).map(paginaParaCSV))
        csvPaginas.push(...lote)
      }

      // Junta todos os CSVs: mantém só o primeiro cabeçalho
      const linhas: string[] = ['Data;Historico;Credito;Debito']
      for (const csv of csvPaginas) {
        for (const linha of csv.split('\n')) {
          const l = linha.trim()
          if (!l || l.toLowerCase().startsWith('data;')) continue
          linhas.push(l)
        }
      }

      const csvUnido = linhas.join('\n')
      const transacoes = processarCSV(csvUnido)

      if (transacoes.length > 0) {
        return {
          transacoes,
          tipo_documento: 'extrato_bancario',
          banco_nome: null as string | null,
          resumo: `${transacoes.length} transações extraídas (${paginasValidas.length} páginas)`,
        }
      }
    } catch {
      // IA falhou — usa parser local abaixo
    }
  }

  // Fallback: parser local por regex no texto unido
  const textoUnido = paginasValidas.join(' ')
  const transacoes = pdfParserLocal(textoUnido)
  return {
    transacoes,
    tipo_documento: 'extrato_bancario',
    banco_nome: null as string | null,
    resumo: `${transacoes.length} transações extraídas do PDF (${paginasValidas.length} páginas)`,
  }
}

// ─── Processa imagem via OpenAI Vision ────────────────────────────────────────
async function processarImagem(bytes: ArrayBuffer, mimeType: string) {
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) throw new Error('OPENAI_API_KEY não configurada')

  const base64 = Buffer.from(bytes).toString('base64')
  const dataUrl = `data:${mimeType};base64,${base64}`

  const chatRes = await fetchOpenAI(openaiKey, {
    model: 'gpt-4o',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: PROMPT_BASE },
        { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
      ],
    }],
  })
  const chatData = await chatRes.json()
  if (!chatRes.ok) throw new Error(chatData.error?.message || 'Erro na OpenAI Vision')
  const texto = chatData.choices?.[0]?.message?.content || ''
  return parseIAResponse(texto)
}

// ─── Handler principal ───────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    // 10 uploads / 60 s por usuário
    const rl = rateLimit({ key: `upload:${user.id}`, limit: 10, windowSec: 60 })
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Muitas requisições. Aguarde alguns instantes.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
      )
    }

    const formData = await request.formData()
    const arquivo = formData.get('arquivo') as File | null
    if (!arquivo) return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })

    const nome = arquivo.name.toLowerCase()
    const bytes = await arquivo.arrayBuffer()

    // ── CSV ──────────────────────────────────────────────────────────────────
    if (nome.endsWith('.csv')) {
      const texto = new TextDecoder('utf-8').decode(bytes)

      // Tenta IA primeiro; fallback para parser local se sem chave ou erro
      let parsed: ReturnType<typeof processarCSV> | null = null
      let tipoDoc = 'extrato_bancario'
      let bancoNomeCSV: string | null = null

      if (process.env.OPENAI_API_KEY) {
        try {
          const iaResult = await processarCSVComIA(texto)
          parsed = (iaResult.transacoes || []).map((t: TransacaoDetectada) => ({
            ...t, nao_categorizado: t.nao_categorizado ?? (t.categoria === 'Outros'),
          }))
          tipoDoc = iaResult.tipo_documento || 'extrato_bancario'
          bancoNomeCSV = iaResult.banco_nome || null
        } catch (e) {
          console.warn('[upload/csv] IA falhou, usando parser local:', e)
        }
      }

      if (!parsed || parsed.length === 0) {
        parsed = processarCSV(texto)
      }

      if (!parsed.length) return NextResponse.json({ error: 'Nenhuma transação encontrada no CSV' }, { status: 400 })

      const naoCat = parsed.filter(t => t.nao_categorizado).length

      let banco_id: string | null = null
      let banco_nao_encontrado = false
      if (bancoNomeCSV) {
        const { data: bancos } = await supabase.from('bancos').select('id, nome, nome_curto')
        const match = bancos?.find(b =>
          b.nome.toLowerCase().includes(bancoNomeCSV!.toLowerCase()) ||
          b.nome_curto.toLowerCase().includes(bancoNomeCSV!.toLowerCase()) ||
          bancoNomeCSV!.toLowerCase().includes(b.nome_curto.toLowerCase())
        )
        if (match) banco_id = match.id
        else banco_nao_encontrado = true
      }

      return NextResponse.json({
        ok: true, transacoes: parsed,
        resumo: `${parsed.length} transações encontradas no CSV${naoCat ? ` (${naoCat} sem categoria)` : ''}`,
        tipo_documento: tipoDoc,
        banco_nome: bancoNomeCSV,
        banco_id,
        banco_nao_encontrado,
        conta_vinculada: bancoNomeCSV,
      })
    }

    // ── PDF ──────────────────────────────────────────────────────────────────
    if (nome.endsWith('.pdf')) {
      const parsed = await processarPDF(bytes)
      const transacoes: TransacaoDetectada[] = (parsed.transacoes || []).map((t: TransacaoDetectada) => ({
        ...t, nao_categorizado: t.nao_categorizado ?? (t.categoria === 'Outros'),
      }))
      if (!transacoes.length) return NextResponse.json({ error: 'Nenhuma transação encontrada no PDF' }, { status: 400 })

      const banco_nome = parsed.banco_nome || null
      let banco_id: string | null = null
      let banco_nao_encontrado = false

      if (banco_nome) {
        const { data: bancos } = await supabase.from('bancos').select('id, nome, nome_curto')
        const match = bancos?.find(b =>
          b.nome.toLowerCase().includes(banco_nome.toLowerCase()) ||
          b.nome_curto.toLowerCase().includes(banco_nome.toLowerCase()) ||
          banco_nome.toLowerCase().includes(b.nome_curto.toLowerCase())
        )
        if (match) banco_id = match.id
        else banco_nao_encontrado = true
      }

      const naoCat = transacoes.filter(t => t.nao_categorizado).length
      return NextResponse.json({
        ok: true, transacoes,
        resumo: `${transacoes.length} transações${naoCat ? ` (${naoCat} sem categoria)` : ''} — ${parsed.resumo || ''}`.trim(),
        banco_nome, banco_id, banco_nao_encontrado,
        tipo_documento: parsed.tipo_documento || 'extrato_bancario',
        conta_vinculada: banco_nome,
      })
    }

    // ── Imagens ───────────────────────────────────────────────────────────────
    const MIME_TIPOS: Record<string, string> = {
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.png': 'image/png', '.webp': 'image/webp',
      '.gif': 'image/gif',
    }
    const ext = nome.match(/\.\w+$/)?.[0] || ''
    const mimeType = MIME_TIPOS[ext]

    if (mimeType) {
      const parsed = await processarImagem(bytes, mimeType)
      const transacoes: TransacaoDetectada[] = (parsed.transacoes || []).map((t: TransacaoDetectada) => ({
        ...t, nao_categorizado: t.nao_categorizado ?? (t.categoria === 'Outros'),
      }))
      if (!transacoes.length) return NextResponse.json({ error: 'Nenhuma transação encontrada na imagem' }, { status: 400 })

      const naoCat = transacoes.filter(t => t.nao_categorizado).length
      return NextResponse.json({
        ok: true, transacoes,
        resumo: `${transacoes.length} itens detectados na imagem${naoCat ? ` (${naoCat} sem categoria)` : ''}`,
        tipo_documento: parsed.tipo_documento || 'outro',
        banco_nome: parsed.banco_nome || null,
      })
    }

    return NextResponse.json({ error: 'Formato não suportado. Envie PDF, CSV, JPG, PNG ou WEBP' }, { status: 400 })

  } catch (err) {
    console.error('[upload] erro:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro interno' }, { status: 500 })
  }
}
