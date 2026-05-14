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
  ref_externa?: string          // chave de deduplicação: data:documento ou data:valor:descricao
  confirmada_duplicata?: boolean // true = encontrado no banco com mesma ref_externa
  origem_categoria?: 'aprendido' | 'padrao' | 'ia'
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
  if (d.match(/salário|salario|folha de pagto|pagamento recebido|vencimento|remuneracao|proventos/)) return { categoria: 'Salário', nao_categorizado: false }
  if (d.match(/freelance|free-lance|serviço prestado|honorario/)) return { categoria: 'Freelance', nao_categorizado: false }
  if (d.match(/rendimento|investimento|dividendo|juros|cdb|lci|lca|tesouro|acoes|acão|fundo /)) return { categoria: 'Investimento', nao_categorizado: false }
  if (d.match(/presente|gift|mimo/)) return { categoria: 'Presente', nao_categorizado: false }
  return { categoria: 'Outros', nao_categorizado: true }
}

// ─── Normaliza descrição para chave de aprendizado ───────────────────────────
export function normalizarChave(desc: string): string {
  return desc.toLowerCase().replace(/\d/g, '').replace(/\s+/g, ' ').trim().slice(0, 20)
}

// ─── Aplica padrões aprendidos sobre lista de transações ──────────────────────
function applyLearned(
  transacoes: TransacaoDetectada[],
  learned: Map<string, string>,
): TransacaoDetectada[] {
  return transacoes.map(t => {
    const chave = normalizarChave(t.descricao)
    const cat = learned.get(chave)
    if (cat) return { ...t, categoria: cat, nao_categorizado: false, origem_categoria: 'aprendido' as const }
    return { ...t, origem_categoria: t.origem_categoria ?? 'padrao' }
  })
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
    const desc = hist.trim().toUpperCase()
    const ref_externa = `csv:${dataVal}:${valor}:${desc.slice(0, 40)}`
    resultado.push({ descricao: desc, valor, tipo, categoria, data_hora: parseData(dataVal), nao_categorizado, ref_externa })
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
  [/^VISA ELECTRON\b/i,                  'Débito'],
  [/^MASTERCARD DEBITO\b/i,              'Débito'],
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

// ─── Prompt sistema: parser bancário → JSON estruturado ──────────────────────
const PROMPT_PDF_JSON_SYSTEM = `Você é um parser especializado em extratos bancários brasileiros.
Sua função é converter texto bruto de extrato em JSON estruturado.

REGRAS IMPORTANTES:
- Uma transação pode ocupar múltiplas linhas — agrupe-as antes de interpretar
- A data permanece válida para todas as transações até surgir uma nova data
- O histórico pode estar dividido em várias linhas — una todas antes de interpretar
- NÃO ignore linhas intermediárias
- NÃO resuma informações
- Preserve o tipo da operação no campo "tipo": PIX, TED, PAGTO, TRANSFERENCIA, CARTAO, SAQUE, TARIFA, etc.
- RENDIMENTOS, JUROS POUPANÇA, RENDIMENTOS POUP FACIL, APLICACAO AUTOMATICA, RESGATE AUTOMATICO são transações válidas — EXTRAIA-OS

IGNORE COMPLETAMENTE:
- Cabeçalhos, rodapés, nome do banco, agência, conta
- "Folha:", "Total", "Saldo Anterior", "Saldo Final", "Saldo do Período"
- Linhas com "COD. LANC." (são códigos internos, não transações)
- Bloco marcado como [CONTEXTO ANTERIOR]

RETORNE APENAS JSON VÁLIDO — sem markdown, sem explicações, sem comentários.

Cada transação deve conter:
{
  "data": "DD/MM/YYYY",
  "tipo": "tipo da operação",
  "historico": "nome do estabelecimento ou beneficiário",
  "documento": "número do documento se houver, senão vazio",
  "credito": "valor se entrada, ex: 4.000,00 — senão vazio",
  "debito": "valor se saída, ex: 710,70 — senão vazio",
  "saldo": "saldo após a transação, ex: 36.751,41"
}

REGRAS DE VALORES:
- "credito" e "debito" NUNCA preenchidos ao mesmo tempo
- Use a evolução do saldo para determinar se é crédito ou débito: saldo subiu = crédito, saldo caiu = débito
- Saldo sempre obrigatório
- Preserve valores exatamente como aparecem (formato brasileiro: 1.234,56)
- Não invente dados`

// ─── Converte CSV com saldo em transações usando comparação de saldo ───────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function processarCSVComSaldo(csv: string): { transacoes: TransacaoDetectada[]; lacunas: string[] } {
  const linhas = csv.split('\n').map(l => l.trim()).filter(Boolean)
  const transacoes: TransacaoDetectada[] = []
  const lacunas: string[] = []
  let saldoAnt = NaN

  // Encontra cabeçalho
  let iCab = -1
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i].toLowerCase()
    if (l.includes('data') && l.includes('hist')) { iCab = i; break }
  }
  if (iCab === -1) return { transacoes, lacunas }

  const cab = linhas[iCab].split(';').map(c => c.toLowerCase().trim())
  const iData  = cab.findIndex(c => c === 'data')
  const iHist  = cab.findIndex(c => c.includes('hist'))
  const iValor = cab.findIndex(c => c.includes('valor'))
  const iSaldo = cab.findIndex(c => c.includes('saldo'))
  if (iData === -1 || iHist === -1 || iValor === -1) return { transacoes, lacunas }

  for (let i = iCab + 1; i < linhas.length; i++) {
    const cols = linhas[i].split(';').map(c => c.trim().replace(/"/g, ''))
    const dataVal = cols[iData] || ''
    const hist    = cols[iHist] || ''
    if (!dataVal.match(/\d{2}\/\d{2}\/\d{4}/) || !hist) continue

    const valorNum  = parseBRL(cols[iValor] || '')
    const saldoAtu  = iSaldo !== -1 ? parseBRL(cols[iSaldo] || '') : NaN
    if (valorNum === 0) continue

    // Crédito/débito pelo saldo: saldo subiu = crédito, saldo caiu = débito
    let tipo: string
    if (!isNaN(saldoAtu) && !isNaN(saldoAnt)) {
      tipo = saldoAtu > saldoAnt ? 'credito' : 'debito'

      // Detecta lacuna: diferença de saldo não bate com o valor da transação
      // Threshold de R$ 5 para evitar ruído de leitura da IA em centavos
      const diff = Math.abs(saldoAtu - saldoAnt)
      const faltando = Math.abs(diff - valorNum)
      if (faltando > 5.0) {
        lacunas.push(`⚠️ Lacuna em ${dataVal} após "${hist}": saldo saltou R$ ${diff.toFixed(2)} mas valor é R$ ${valorNum.toFixed(2)} — possível R$ ${faltando.toFixed(2)} em transações não extraídas`)
      }
    } else {
      tipo = 'debito' // fallback conservador
    }
    if (!isNaN(saldoAtu)) saldoAnt = saldoAtu

    const { categoria, nao_categorizado } = detectarCategoria(hist)
    transacoes.push({
      descricao: hist.trim().toUpperCase(),
      valor: valorNum,
      tipo,
      categoria,
      nao_categorizado,
      data_hora: parseData(dataVal),
    })
  }
  return { transacoes, lacunas }
}

// ─── Extrai metadados do cabeçalho do PDF (banco, agência, conta, titular) ─────
async function extrairMetadadosPDF(textoPrimeiraPagina: string, openaiKey: string) {
  try {
    const res = await fetchOpenAI(openaiKey, {
      model: 'gpt-4o-mini',
      max_tokens: 256,
      temperature: 0,
      messages: [{
        role: 'user',
        content: `Do texto de extrato bancário abaixo, extraia APENAS os dados do cabeçalho.
Retorne JSON com exatamente estes campos (null se não encontrar):
{
  "banco": "nome do banco",
  "agencia": "número da agência sem dígito verificador",
  "conta": "número da conta sem dígito verificador",
  "titular": "nome do titular"
}
Retorne APENAS JSON válido, sem markdown.

Texto:
${textoPrimeiraPagina.slice(0, 2000)}`,
      }],
    })
    const data = await res.json()
    const texto = (data.choices?.[0]?.message?.content ?? '').replace(/```json|```/g, '').trim()
    return JSON.parse(texto) as { banco: string | null; agencia: string | null; conta: string | null; titular: string | null }
  } catch {
    return { banco: null, agencia: null, conta: null, titular: null }
  }
}

// ─── Processa PDF: texto cru → GPT → JSON estruturado → validação de saldo ────
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
      // Extrai banco/agência/conta do cabeçalho da primeira página em paralelo com as transações
      const metadadosPromise = extrairMetadadosPDF(paginasValidas[0], openaiKey)

      // Overlap: inclui últimas 400 chars da página anterior para não perder transações no limite de página
      const paginasComContexto = paginasValidas.map((pagina, idx) => {
        if (idx === 0) return pagina
        const overlap = paginasValidas[idx - 1].slice(-400)
        return `[CONTEXTO ANTERIOR — não extraia transações deste bloco]\n${overlap}\n[PÁGINA ATUAL — extraia todas as transações daqui]\n${pagina}`
      })

      type RawItem = { data?: string; tipo?: string; historico?: string; documento?: string; credito?: string; debito?: string; saldo?: string }

      const paginaParaJSON = (pagina: string): Promise<RawItem[]> =>
        fetchOpenAI(openaiKey, {
          model: 'gpt-4o',
          max_tokens: 8192,
          temperature: 0,
          messages: [
            { role: 'system', content: PROMPT_PDF_JSON_SYSTEM },
            { role: 'user',   content: `Extraia TODAS as transações do texto abaixo. Agrupe linhas da mesma transação.\n\n${pagina.slice(0, 8000)}` },
          ],
        })
        .then(async res => {
          const data = await res.json()
          if (!res.ok) return []
          const texto = (data.choices?.[0]?.message?.content ?? '').replace(/```json|```/g, '').trim()
          try {
            const parsed = JSON.parse(texto)
            return Array.isArray(parsed) ? parsed : []
          } catch {
            const ultimo = texto.lastIndexOf('},')
            if (ultimo === -1) return []
            try { return JSON.parse(texto.slice(0, ultimo + 1) + ']') } catch { return [] }
          }
        })
        .catch(() => [])

      // Lotes de 8 páginas em paralelo
      const todosItens: RawItem[] = []
      const BATCH = 8
      for (let i = 0; i < paginasComContexto.length; i += BATCH) {
        const lote = await Promise.all(paginasComContexto.slice(i, i + BATCH).map(paginaParaJSON))
        lote.forEach(items => todosItens.push(...items))
      }

      // Deduplicação por data+valor(credito|debito)+saldo — chave natural da transação
      const vistas = new Set<string>()
      const itensFiltrados = todosItens.filter(item => {
        const valor = item.credito || item.debito || ''
        const chave = `${item.data}|${valor}|${item.saldo}`
        if (vistas.has(chave)) return false
        vistas.add(chave)
        return true
      })

      // Converte JSON → TransacaoDetectada com validação matemática de saldo
      const transacoes: TransacaoDetectada[] = []
      const lacunas: string[] = []
      let saldoAnt = NaN

      for (const item of itensFiltrados) {
        const creditoNum = parseBRL(item.credito || '')
        const debitoNum  = parseBRL(item.debito  || '')
        const saldoAtu   = parseBRL(item.saldo   || '')
        // Bug fix: usar item.tipo como fallback quando historico vem vazio (ex: RENDIMENTOS)
        const hist = (item.historico || item.tipo || '').trim()
        if (!hist) continue
        // Bug fix: valor zero pode ser string "0" da IA — filtrar só se ambos são realmente zero
        const valorBruto = Math.max(creditoNum, debitoNum)
        if (valorBruto === 0) continue

        // Determina tipo pelo campo IA, mas usa saldo como árbitro final (mais confiável)
        let tipo: string
        let valor: number
        if (!isNaN(saldoAtu) && !isNaN(saldoAnt)) {
          // Saldo é fonte de verdade: se subiu é crédito, se caiu é débito
          tipo  = saldoAtu > saldoAnt ? 'credito' : 'debito'
          valor = valorBruto
        } else if (creditoNum > 0 && debitoNum === 0) {
          tipo = 'credito'; valor = creditoNum
        } else if (debitoNum > 0 && creditoNum === 0) {
          tipo = 'debito'; valor = debitoNum
        } else {
          tipo = 'debito'; valor = valorBruto
        }

        // Validação matemática: detecta transações faltando entre este e o anterior
        if (!isNaN(saldoAtu) && !isNaN(saldoAnt) && valor > 0) {
          const diff     = Math.abs(saldoAtu - saldoAnt)
          const faltando = Math.abs(diff - valor)
          if (faltando > 5.0) {
            lacunas.push(`⚠️ Lacuna em ${item.data} após "${hist}": saldo saltou R$ ${diff.toFixed(2)} mas valor é R$ ${valor.toFixed(2)} — possível R$ ${faltando.toFixed(2)} em transações não extraídas`)
          }
        }
        if (!isNaN(saldoAtu)) saldoAnt = saldoAtu

        const { tipo_pagamento } = extrairTipoPagamento(item.tipo || '')
        // Bug fix: se historico estava vazio e usamos tipo como desc, não duplicar no tipo_pagamento
        const descricao = (item.historico || '').trim() || hist
        const { categoria, nao_categorizado } = detectarCategoria(descricao)

        // Chave de deduplicação: documento bancário é definitivo; fallback = data+valor+desc
        const doc = (item.documento || '').trim()
        const ref_externa = doc
          ? `${item.data}:${doc}`
          : `${item.data}:${valor}:${descricao.slice(0, 40).toUpperCase()}`

        transacoes.push({
          descricao: descricao.toUpperCase(),
          tipo_pagamento: tipo_pagamento || (item.historico ? item.tipo : undefined) || undefined,
          valor,
          tipo,
          categoria,
          nao_categorizado,
          data_hora: parseData(item.data || ''),
          ref_externa,
        })
      }

      const metadados = await metadadosPromise

      return {
        transacoes,
        tipo_documento: 'extrato_bancario',
        banco_nome: metadados.banco || null,
        agencia_detectada: metadados.agencia || null,
        numero_conta_detectada: metadados.conta || null,
        titular_detectado: metadados.titular || null,
        resumo: `${transacoes.length} transações extraídas (${paginasValidas.length} páginas)`,
        lacunas,
        _csv_debug: JSON.stringify(itensFiltrados, null, 2),
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
    lacunas: [] as string[],
    _csv_debug: `[FALLBACK LOCAL — IA indisponível]\n\nTexto extraído (primeiros 3000 chars):\n${textoUnido.slice(0, 3000)}`,
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

// ─── Parser OFX/QIF (padrão SGML dos bancos brasileiros) ─────────────────────
function processarOFX(texto: string): TransacaoDetectada[] {
  // Normaliza: OFX 1.x é SGML, não XML — extrai tags com regex
  const resultado: TransacaoDetectada[] = []

  // Extrai blocos <STMTTRN>...</STMTTRN>
  const blocos: string[] = Array.from(texto.match(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi) || [])

  // Fallback para OFX 1.x sem tags de fechamento (SGML puro)
  if (blocos.length === 0) {
    const linhas = texto.split('\n').map(l => l.trim())
    let dentro   = false
    let bloco    = ''
    for (const linha of linhas) {
      if (linha === '<STMTTRN>') { dentro = true; bloco = ''; continue }
      if (linha === '</STMTTRN>') { dentro = false; blocos.push(bloco); bloco = ''; continue }
      if (dentro) bloco += linha + '\n'
    }
  }

  function tag(bloco: string, nome: string): string {
    const m = bloco.match(new RegExp(`<${nome}>([^<\\n\\r]*)`, 'i'))
    return m ? m[1].trim() : ''
  }

  function parseOFXData(s: string): string {
    // YYYYMMDDHHMMSS ou YYYYMMDD[offset]
    const m = s.match(/^(\d{4})(\d{2})(\d{2})/)
    if (!m) return new Date().toISOString()
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toISOString()
  }

  for (const bloco of blocos) {
    const bStr = typeof bloco === 'string' ? bloco : bloco

    const tipo_ofx = tag(bStr, 'TRNTYPE').toUpperCase()
    const dtpost   = tag(bStr, 'DTPOSTED')
    const valorStr = tag(bStr, 'TRNAMT')
    const fitid    = tag(bStr, 'FITID')
    const memo     = tag(bStr, 'MEMO') || tag(bStr, 'NAME') || 'Transação'

    const valorRaw = parseFloat(valorStr.replace(',', '.'))
    if (isNaN(valorRaw) || valorRaw === 0) continue

    // Sinal negativo = débito; positivo = crédito
    const tipo  = valorRaw < 0 ? 'debito' : 'credito'
    const valor = Math.abs(valorRaw)

    const { categoria, nao_categorizado } = detectarCategoria(memo)

    resultado.push({
      descricao:      memo.toUpperCase(),
      tipo_pagamento: tipo_ofx || undefined,
      valor,
      tipo,
      categoria,
      nao_categorizado,
      data_hora:   parseOFXData(dtpost),
      ref_externa: fitid ? `ofx:${fitid}` : undefined,
    })
  }

  return resultado
}

// ─── Handler principal ───────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    // 10 uploads / 60 s por usuário
    const rl = await rateLimit({ key: `upload:${user.id}`, limit: 10, windowSec: 60 })
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Muitas requisições. Aguarde alguns instantes.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
      )
    }

    // Carrega padrões aprendidos do usuário para sugestão de categoria
    const { data: aprendidas } = await supabase.from('categoria_aprendida').select('chave, categoria').eq('user_id', user.id)
    const learnedMap = new Map<string, string>((aprendidas || []).map(a => [a.chave, a.categoria]))

    const formData = await request.formData()
    const arquivo = formData.get('arquivo') as File | null
    if (!arquivo) return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })

    const nome = arquivo.name.toLowerCase()
    const bytes = await arquivo.arrayBuffer()

    // ── OFX ──────────────────────────────────────────────────────────────────
    if (nome.endsWith('.ofx') || nome.endsWith('.ofc')) {
      const texto = new TextDecoder('latin1').decode(bytes) // bancos BR usam ISO-8859-1
      const transacoes = processarOFX(texto)
      if (!transacoes.length) return NextResponse.json({ error: 'Nenhuma transação encontrada no arquivo OFX' }, { status: 400 })

      // Detecta banco pelo BANKID no cabeçalho OFX
      const bankIdMatch = texto.match(/<BANKID>(\d+)/i)
      const bankId      = bankIdMatch?.[1] || null
      const BANCOS_ISPB: Record<string, string> = {
        '237': 'Bradesco', '341': 'Itaú', '001': 'Banco do Brasil',
        '033': 'Santander', '104': 'Caixa Econômica Federal',
        '260': 'Nubank', '077': 'Inter', '290': 'PagBank',
        '336': 'C6 Bank', '380': 'PicPay', '623': 'Pan', '422': 'Safra',
      }
      const banco_nome = bankId ? (BANCOS_ISPB[bankId] || `Banco ${bankId}`) : null

      let banco_id: string | null = null
      if (banco_nome) {
        const { data: bancos } = await supabase.from('bancos').select('id, nome, nome_curto')
        const match = bancos?.find(b =>
          b.nome.toLowerCase().includes(banco_nome.toLowerCase()) ||
          banco_nome.toLowerCase().includes(b.nome_curto.toLowerCase())
        )
        if (match) banco_id = match.id
      }

      // Extrai agência e conta do cabeçalho OFX
      const agencia_detectada = texto.match(/<BRANCHID>([^<\n\r]*)/i)?.[1]?.trim() || null
      const numero_detectado  = texto.match(/<ACCTID>([^<\n\r]*)/i)?.[1]?.trim() || null
      const titular_detectado = texto.match(/<NAME>([^<\n\r]*)/i)?.[1]?.trim() || null

      // Tenta vincular à conta existente do usuário
      const { data: contasUsuario } = await supabase
        .from('contas').select('id, nome, numero, agencia, banco_id')
        .eq('user_id', user.id).eq('ativo', true)

      const norm = (s: string | null | undefined) => (s || '').replace(/\D/g, '')
      let conta_id: string | null = null
      let conta_sugerida: { banco_id: string | null; banco_nome: string | null; agencia: string | null; numero: string | null; titular: string | null } | null = null

      if (contasUsuario) {
        if (numero_detectado) {
          const m = contasUsuario.find(c => norm(c.numero) === norm(numero_detectado) && norm(c.numero).length > 3)
          if (m) conta_id = m.id
        }
        if (!conta_id && banco_id && agencia_detectada) {
          const m = contasUsuario.find(c => c.banco_id === banco_id && norm(c.agencia) === norm(agencia_detectada))
          if (m) conta_id = m.id
        }
        if (!conta_id && (banco_id || banco_nome)) {
          conta_sugerida = { banco_id, banco_nome, agencia: agencia_detectada, numero: numero_detectado, titular: titular_detectado }
        }
      }

      // Verifica duplicatas por ref_externa (FITID)
      const refs = transacoes.map(t => t.ref_externa).filter(Boolean) as string[]
      if (refs.length) {
        const { data: existentes } = await supabase
          .from('transactions').select('ref_externa')
          .eq('user_id', user.id).in('ref_externa', refs)
        if (existentes?.length) {
          const refsExistentes = new Set(existentes.map(e => e.ref_externa))
          transacoes.forEach(t => { if (t.ref_externa && refsExistentes.has(t.ref_externa)) t.confirmada_duplicata = true })
        }
      }

      const transacoesAprendidas = applyLearned(transacoes, learnedMap)
      const naoCat = transacoesAprendidas.filter(t => t.nao_categorizado).length
      return NextResponse.json({
        ok: true, transacoes: transacoesAprendidas, banco_nome, banco_id, conta_id, conta_sugerida,
        resumo: `${transacoesAprendidas.length} transações do OFX${naoCat ? ` (${naoCat} sem categoria)` : ''}`,
        tipo_documento: 'extrato_bancario',
      })
    }

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
          parsed = (iaResult.transacoes || []).map((t: TransacaoDetectada) => {
            const nao_categorizado = t.nao_categorizado ?? (t.categoria === 'Outros')
            // Gera ref_externa se a IA não forneceu — garante deduplicação em reimportações
            const ref_externa = t.ref_externa || (() => {
              const dt = t.data_hora ? new Date(t.data_hora).toLocaleDateString('pt-BR') : ''
              const desc = (t.descricao || '').slice(0, 40).toUpperCase()
              return dt ? `csv:${dt}:${Math.abs(t.valor)}:${desc}` : undefined
            })()
            return { ...t, nao_categorizado, ref_externa }
          })
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

      // Marca origem_categoria antes de aplicar learned
      const parsedComOrigem = parsed.map(t => ({ ...t, origem_categoria: t.origem_categoria ?? (process.env.OPENAI_API_KEY ? 'ia' : 'padrao') as 'ia' | 'padrao' }))
      const parsedFinal = applyLearned(parsedComOrigem, learnedMap)

      // Verifica duplicatas por ref_externa no banco
      const refsCSV = parsedFinal.map(t => t.ref_externa).filter(Boolean) as string[]
      if (refsCSV.length) {
        const { data: existentesCSV } = await supabase
          .from('transactions').select('ref_externa')
          .eq('user_id', user.id).in('ref_externa', refsCSV)
        if (existentesCSV?.length) {
          const refsExistentesCSV = new Set(existentesCSV.map(e => e.ref_externa))
          parsedFinal.forEach(t => { if (t.ref_externa && refsExistentesCSV.has(t.ref_externa)) t.confirmada_duplicata = true })
        }
      }

      const naoCat = parsedFinal.filter(t => t.nao_categorizado).length

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
        ok: true, transacoes: parsedFinal,
        resumo: `${parsedFinal.length} transações encontradas no CSV${naoCat ? ` (${naoCat} sem categoria)` : ''}`,
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
      if (!transacoes.length) return NextResponse.json({ error: 'Nenhuma transação encontrada no PDF', _csv_debug: parsed._csv_debug }, { status: 400 })

      const banco_nome          = (parsed as { banco_nome?: string | null }).banco_nome || null
      const agencia_detectada   = (parsed as { agencia_detectada?: string | null }).agencia_detectada || null
      const numero_detectado    = (parsed as { numero_conta_detectada?: string | null }).numero_conta_detectada || null
      const titular_detectado   = (parsed as { titular_detectado?: string | null }).titular_detectado || null

      // Resolve banco_id a partir do nome extraído
      let banco_id: string | null = null
      if (banco_nome) {
        const { data: bancos } = await supabase.from('bancos').select('id, nome, nome_curto')
        const match = bancos?.find(b =>
          b.nome.toLowerCase().includes(banco_nome.toLowerCase()) ||
          b.nome_curto.toLowerCase().includes(banco_nome.toLowerCase()) ||
          banco_nome.toLowerCase().includes(b.nome_curto.toLowerCase())
        )
        if (match) banco_id = match.id
      }

      // Tenta encontrar a conta exata do usuário: número > banco+agência > banco
      const { data: contasUsuario } = await supabase
        .from('contas')
        .select('id, nome, numero, agencia, banco_id, bancos(id, nome, nome_curto, cor)')
        .eq('user_id', user.id)
        .eq('ativo', true)

      let conta_id: string | null = null
      let conta_sugerida: { banco_id: string | null; banco_nome: string | null; agencia: string | null; numero: string | null; titular: string | null } | null = null

      if (contasUsuario) {
        const norm = (s: string | null | undefined) => (s || '').replace(/\D/g, '')

        // 1. Match exato por número de conta
        if (numero_detectado) {
          const m = contasUsuario.find(c => norm(c.numero) === norm(numero_detectado) && norm(c.numero).length > 3)
          if (m) conta_id = m.id
        }

        // 2. Match por banco + agência
        if (!conta_id && banco_id && agencia_detectada) {
          const m = contasUsuario.find(c => c.banco_id === banco_id && norm(c.agencia) === norm(agencia_detectada))
          if (m) conta_id = m.id
        }

        // 3. Se banco encontrado mas conta não: sugerir criação pré-preenchida
        if (!conta_id && (banco_id || banco_nome)) {
          conta_sugerida = { banco_id, banco_nome, agencia: agencia_detectada, numero: numero_detectado, titular: titular_detectado }
        }
      }

      // Verifica quais ref_externa já existem no banco (duplicatas confirmadas)
      const refs = transacoes.map(t => t.ref_externa).filter(Boolean) as string[]
      if (refs.length) {
        const { data: existentes } = await supabase
          .from('transactions')
          .select('ref_externa')
          .eq('user_id', user.id)
          .in('ref_externa', refs)
        if (existentes?.length) {
          const refsExistentes = new Set(existentes.map(e => e.ref_externa))
          transacoes.forEach(t => {
            if (t.ref_externa && refsExistentes.has(t.ref_externa)) t.confirmada_duplicata = true
          })
        }
      }

      const transacoesAprendidasPDF = applyLearned(
        transacoes.map(t => ({ ...t, origem_categoria: t.origem_categoria ?? 'ia' as const })),
        learnedMap,
      )
      const naoCat = transacoesAprendidasPDF.filter(t => t.nao_categorizado).length
      const lacunas: string[] = (parsed as { lacunas?: string[] }).lacunas || []
      return NextResponse.json({
        ok: true, transacoes: transacoesAprendidasPDF,
        resumo: `${transacoesAprendidasPDF.length} transações${naoCat ? ` (${naoCat} sem categoria)` : ''} — ${parsed.resumo || ''}`.trim(),
        banco_nome, banco_id,
        conta_id,
        conta_sugerida,
        tipo_documento: parsed.tipo_documento || 'extrato_bancario',
        lacunas,
        _csv_debug: parsed._csv_debug,
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
      const transacoes: TransacaoDetectada[] = (parsed.transacoes || []).map((t: TransacaoDetectada) => {
        const dt = t.data_hora ? new Date(t.data_hora).toLocaleDateString('pt-BR') : ''
        const ref_externa = t.ref_externa || (dt ? `img:${dt}:${t.valor}:${(t.descricao || '').slice(0, 40).toUpperCase()}` : undefined)
        return { ...t, nao_categorizado: t.nao_categorizado ?? (t.categoria === 'Outros'), ref_externa }
      })
      if (!transacoes.length) return NextResponse.json({ error: 'Nenhuma transação encontrada na imagem' }, { status: 400 })

      // Verifica duplicatas por ref_externa
      const refsImg = transacoes.map(t => t.ref_externa).filter(Boolean) as string[]
      if (refsImg.length) {
        const { data: existentesImg } = await supabase
          .from('transactions').select('ref_externa')
          .eq('user_id', user.id).in('ref_externa', refsImg)
        if (existentesImg?.length) {
          const refsExistentesImg = new Set(existentesImg.map(e => e.ref_externa))
          transacoes.forEach(t => { if (t.ref_externa && refsExistentesImg.has(t.ref_externa)) t.confirmada_duplicata = true })
        }
      }

      const transacoesAprendidasImg = applyLearned(
        transacoes.map(t => ({ ...t, origem_categoria: 'ia' as const })),
        learnedMap,
      )
      const naoCat = transacoesAprendidasImg.filter(t => t.nao_categorizado).length
      return NextResponse.json({
        ok: true, transacoes: transacoesAprendidasImg,
        resumo: `${transacoesAprendidasImg.length} itens detectados na imagem${naoCat ? ` (${naoCat} sem categoria)` : ''}`,
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
