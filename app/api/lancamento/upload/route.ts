import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const CATEGORIAS = ['Alimentação','Transporte','Lazer','Saúde','Moradia','Educação','Salário','Freelance','Investimento','Presente','Outros']

// ─── Detecta categoria por palavra-chave ─────────────────────────────────────
function detectarCategoria(desc: string): string {
  const d = desc.toLowerCase()
  if (d.includes('mercado') || d.includes('supermercado') || d.includes('ifood') || d.includes('restaurante') || d.includes('alimenta') || d.includes('padaria') || d.includes('lanchon')) return 'Alimentação'
  if (d.includes('uber') || d.includes('99pop') || d.includes('combustiv') || d.includes('posto') || d.includes('transporte') || d.includes('ônibus') || d.includes('onibus') || d.includes('metro') || d.includes('passagem')) return 'Transporte'
  if (d.includes('netflix') || d.includes('spotify') || d.includes('cinema') || d.includes('lazer') || d.includes('jogo') || d.includes('steam')) return 'Lazer'
  if (d.includes('farmácia') || d.includes('farmacia') || d.includes('saúde') || d.includes('saude') || d.includes('médico') || d.includes('medico') || d.includes('hospital') || d.includes('drogaria') || d.includes('clinica')) return 'Saúde'
  if (d.includes('aluguel') || d.includes('condomínio') || d.includes('condominio') || d.includes('conta de agua') || d.includes('água') || d.includes('energia') || d.includes('moradia') || d.includes('luz') || d.includes('gas')) return 'Moradia'
  if (d.includes('escola') || d.includes('faculdade') || d.includes('curso') || d.includes('educação') || d.includes('educacao') || d.includes('universidade')) return 'Educação'
  if (d.includes('salário') || d.includes('salario') || d.includes('folha') || d.includes('pagamento recebido')) return 'Salário'
  if (d.includes('freelance') || d.includes('free-lance')) return 'Freelance'
  if (d.includes('rendimento') || d.includes('investimento') || d.includes('dividendo') || d.includes('juros')) return 'Investimento'
  return 'Outros'
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

// ─── Processa CSV formato bancos BR (separador ;) ────────────────────────────
function processarCSV(texto: string): Array<{
  descricao: string; valor: number; tipo: string; categoria: string; data_hora: string
}> {
  const linhas = texto.split('\n').map(l => l.trim())
  const resultado = []

  let idxCabecalho = -1
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i].toLowerCase()
    if (l.includes('data') && l.includes('hist')) {
      idxCabecalho = i
      break
    }
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

    resultado.push({
      descricao: hist.trim(),
      valor,
      tipo,
      categoria: detectarCategoria(hist),
      data_hora: parseData(dataVal),
    })
  }

  return resultado
}

// ─── Processa PDF via OpenAI Assistants (sem dependência externa) ─────────────
async function processarPDF(bytes: ArrayBuffer): Promise<{
  transacoes: Array<{ descricao: string; valor: number; tipo: string; categoria: string; data_hora: string }>
  banco_nome: string | null
  resumo: string
}> {
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) throw new Error('OPENAI_API_KEY não configurada')

  const prompt = `Você é um extrator de dados financeiros especializado em extratos bancários brasileiros.
Analise este extrato bancário em PDF e extraia TODAS as transações visíveis.

Retorne APENAS JSON válido, sem texto adicional, sem markdown, sem blocos de código.

Categorias disponíveis: ${CATEGORIAS.join(', ')}

Formato obrigatório:
{
  "banco_nome": "nome do banco detectado ou null",
  "resumo": "ex: 23 transações encontradas de Jan/2025",
  "transacoes": [
    {
      "descricao": "descrição limpa da transação",
      "valor": 150.00,
      "tipo": "debito ou credito",
      "categoria": "categoria válida da lista",
      "data_hora": "2025-01-15T00:00:00.000Z"
    }
  ]
}

Regras:
- tipo "debito" para gastos/saídas/compras/pagamentos/débitos
- tipo "credito" para receitas/entradas/depósitos/salário/créditos
- valor sempre número positivo
- data_hora sempre ISO 8601, se sem hora use T00:00:00.000Z
- Ignore linhas de saldo, totais e rodapés
- Extraia TODAS as transações, sem omitir nenhuma`

  // Passo 1 — faz upload do PDF para a OpenAI
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
    // Passo 2 — envia para o gpt-4o com o file_id
    const chatRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt,
              },
              {
                type: 'file',
                file: { file_id: fileId },
              },
            ],
          },
        ],
      }),
    })

    const chatData = await chatRes.json()
    if (!chatRes.ok) throw new Error(chatData.error?.message || 'Erro na OpenAI')

    const texto = chatData.choices?.[0]?.message?.content || ''
    const limpo = texto.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(limpo)

    return {
      transacoes: parsed.transacoes || [],
      banco_nome: parsed.banco_nome || null,
      resumo: parsed.resumo || `${parsed.transacoes?.length || 0} transações encontradas`,
    }
  } finally {
    // Passo 3 — deleta o arquivo da OpenAI após uso
    await fetch(`https://api.openai.com/v1/files/${fileId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${openaiKey}` },
    }).catch(() => {})
  }
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
      const transacoes = processarCSV(texto)

      if (!transacoes.length)
        return NextResponse.json({ error: 'Nenhuma transação encontrada no CSV' }, { status: 400 })

      return NextResponse.json({
        ok: true,
        transacoes,
        resumo: `${transacoes.length} transações encontradas no CSV`,
      })
    }

    // ── PDF ──────────────────────────────────────────────────────────────────
    if (nome.endsWith('.pdf')) {
      const { transacoes, banco_nome, resumo } = await processarPDF(bytes)

      if (!transacoes.length)
        return NextResponse.json({ error: 'Nenhuma transação encontrada no PDF' }, { status: 400 })

      let banco_id: string | null = null
      let banco_nao_encontrado = false

      if (banco_nome) {
        const { data: bancos } = await supabase.from('bancos').select('id, nome, nome_curto')
        const bancoMatch = bancos?.find(b =>
          b.nome.toLowerCase().includes(banco_nome.toLowerCase()) ||
          b.nome_curto.toLowerCase().includes(banco_nome.toLowerCase()) ||
          banco_nome.toLowerCase().includes(b.nome_curto.toLowerCase())
        )
        if (bancoMatch) {
          banco_id = bancoMatch.id
        } else {
          banco_nao_encontrado = true
        }
      }

      return NextResponse.json({
        ok: true,
        transacoes,
        resumo,
        banco_nome,
        banco_id,
        banco_nao_encontrado,
        conta_vinculada: banco_nome,
      })
    }

    return NextResponse.json({ error: 'Formato não suportado. Envie um arquivo .csv ou .pdf' }, { status: 400 })

  } catch (err) {
    console.error('[upload] erro:', err)
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}