import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const CATEGORIAS = ['Alimentação','Transporte','Lazer','Saúde','Moradia','Educação','Salário','Freelance','Investimento','Presente','Outros']

export interface TransacaoDetectada {
  descricao: string
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
    resultado.push({ descricao: hist.trim(), valor, tipo, categoria, data_hora: parseData(dataVal), nao_categorizado })
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
      "descricao": "descrição limpa e legível da transação",
      "valor": 150.00,
      "tipo": "debito ou credito",
      "categoria": "categoria mais provável da lista",
      "nao_categorizado": false,
      "data_hora": "2025-01-15T00:00:00.000Z"
    }
  ]
}

Regras de categorização:
- Use a categoria mais específica possível
- Defina nao_categorizado: true SOMENTE quando a descrição for ambígua (ex: siglas, códigos, PIX genérico sem destinatário claro, TED sem descrição)
- Defina nao_categorizado: false quando conseguir inferir a categoria com boa certeza
- tipo "debito" para gastos/saídas/compras/pagamentos/débitos/descontos
- tipo "credito" para receitas/entradas/depósitos/salário/créditos/proventos
- valor sempre número positivo
- Para holerites: salário líquido = credito, descontos = debito
- Para notas fiscais: itens comprados = debito
- data_hora sempre ISO 8601, se sem hora use T00:00:00.000Z
- Ignore totais, saldos, cabeçalhos e rodapés
- Extraia TODAS as transações sem omitir nenhuma`

// ─── Processa CSV via OpenAI (qualquer formato) ──────────────────────────────
async function processarCSVComIA(texto: string) {
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) throw new Error('OPENAI_API_KEY não configurada')

  const chatRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `${PROMPT_BASE}\n\nConteúdo do CSV:\n\`\`\`\n${texto.slice(0, 20000)}\n\`\`\``,
      }],
    }),
  })
  const chatData = await chatRes.json()
  if (!chatRes.ok) throw new Error(chatData.error?.message || 'Erro na OpenAI')
  const content = chatData.choices?.[0]?.message?.content || ''
  return JSON.parse(content.replace(/```json|```/g, '').trim())
}

// ─── Processa PDF via OpenAI ───────────────────────────────────────────────────
async function processarPDF(bytes: ArrayBuffer) {
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) throw new Error('OPENAI_API_KEY não configurada')

  const blob = new Blob([bytes], { type: 'application/pdf' })
  const form = new FormData()
  form.append('file', blob, 'extrato.pdf')
  form.append('purpose', 'assistants')

  const uploadRes = await fetch('https://api.openai.com/v1/files', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${openaiKey}` },
    body: form,
  })
  const uploadData = await uploadRes.json()
  if (!uploadRes.ok) throw new Error(uploadData.error?.message || 'Erro ao fazer upload do PDF')

  const fileId = uploadData.id
  try {
    const chatRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 4096,
        messages: [{ role: 'user', content: [{ type: 'text', text: PROMPT_BASE }, { type: 'file', file: { file_id: fileId } }] }],
      }),
    })
    const chatData = await chatRes.json()
    if (!chatRes.ok) throw new Error(chatData.error?.message || 'Erro na OpenAI')
    const texto = chatData.choices?.[0]?.message?.content || ''
    return JSON.parse(texto.replace(/```json|```/g, '').trim())
  } finally {
    await fetch(`https://api.openai.com/v1/files/${fileId}`, {
      method: 'DELETE', headers: { 'Authorization': `Bearer ${openaiKey}` },
    }).catch(() => {})
  }
}

// ─── Processa imagem via OpenAI Vision ────────────────────────────────────────
async function processarImagem(bytes: ArrayBuffer, mimeType: string) {
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) throw new Error('OPENAI_API_KEY não configurada')

  const base64 = Buffer.from(bytes).toString('base64')
  const dataUrl = `data:${mimeType};base64,${base64}`

  const chatRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: PROMPT_BASE },
          { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
        ],
      }],
    }),
  })
  const chatData = await chatRes.json()
  if (!chatRes.ok) throw new Error(chatData.error?.message || 'Erro na OpenAI Vision')
  const texto = chatData.choices?.[0]?.message?.content || ''
  return JSON.parse(texto.replace(/```json|```/g, '').trim())
}

// ─── Handler principal ───────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

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
