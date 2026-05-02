import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const CATEGORIAS = ['Alimentação','Transporte','Lazer','Saúde','Moradia','Educação','Salário','Freelance','Investimento','Presente','Outros']

// ─── Processa CSV ────────────────────────────────────────────────────────────
function processarCSV(texto: string): Array<{
  descricao: string; valor: number; tipo: string; categoria: string; data_hora: string
}> {
  const linhas = texto.split('\n').map(l => l.trim()).filter(Boolean)
  if (linhas.length < 2) return []

  const cabecalho = linhas[0].split(',').map(c => c.toLowerCase().trim().replace(/"/g, ''))
  const resultado = []

  for (let i = 1; i < linhas.length; i++) {
    const cols = linhas[i].split(',').map(c => c.trim().replace(/"/g, ''))
    const row: Record<string, string> = {}
    cabecalho.forEach((h, idx) => { row[h] = cols[idx] || '' })

    const descricao = row['descrição'] || row['descricao'] || row['title'] || row['memo'] || row['histórico'] || row['historico'] || ''
    const valorStr  = row['valor'] || row['amount'] || row['quantia'] || ''
    const dataStr   = row['data'] || row['date'] || row['data lançamento'] || row['data lancamento'] || ''
    const tipoStr   = row['tipo'] || row['type'] || ''

    if (!descricao || !valorStr) continue

    const valorNum = parseFloat(valorStr.replace(/[^\d,.-]/g, '').replace(',', '.'))
    if (isNaN(valorNum)) continue

    let tipo = 'debito'
    if (tipoStr.toLowerCase().includes('cred') || valorNum > 0) tipo = 'credito'
    if (tipoStr.toLowerCase().includes('deb') || valorNum < 0) tipo = 'debito'

    let data_hora = new Date().toISOString()
    if (dataStr) {
      const partes = dataStr.includes('/') ? dataStr.split('/').reverse().join('-') : dataStr
      const d = new Date(partes)
      if (!isNaN(d.getTime())) data_hora = d.toISOString()
    }

    const desc = descricao.toLowerCase()
    let categoria = 'Outros'
    if (desc.includes('mercado') || desc.includes('supermercado') || desc.includes('ifood') || desc.includes('restaurante') || desc.includes('alimenta')) categoria = 'Alimentação'
    else if (desc.includes('uber') || desc.includes('99') || desc.includes('combustiv') || desc.includes('transport') || desc.includes('ônibus') || desc.includes('metro')) categoria = 'Transporte'
    else if (desc.includes('netflix') || desc.includes('spotify') || desc.includes('cinema') || desc.includes('lazer')) categoria = 'Lazer'
    else if (desc.includes('farmácia') || desc.includes('farmacia') || desc.includes('saúde') || desc.includes('saude') || desc.includes('médico') || desc.includes('medico')) categoria = 'Saúde'
    else if (desc.includes('aluguel') || desc.includes('condomínio') || desc.includes('condominio') || desc.includes('luz') || desc.includes('água') || desc.includes('agua') || desc.includes('moradia')) categoria = 'Moradia'
    else if (desc.includes('escola') || desc.includes('faculdade') || desc.includes('curso') || desc.includes('educação') || desc.includes('educacao')) categoria = 'Educação'
    else if (desc.includes('salário') || desc.includes('salario') || desc.includes('pagamento recebido')) categoria = 'Salário'
    else if (desc.includes('freelance') || desc.includes('free-lance')) categoria = 'Freelance'
    else if (desc.includes('investimento') || desc.includes('dividendo') || desc.includes('rendimento')) categoria = 'Investimento'

    resultado.push({ descricao: descricao.trim(), valor: Math.abs(valorNum), tipo, categoria, data_hora })
  }

  return resultado
}

// ─── Processa PDF via OpenAI ─────────────────────────────────────────────────
async function processarPDFcomOpenAI(base64: string): Promise<{
  transacoes: Array<{ descricao: string; valor: number; tipo: string; categoria: string; data_hora: string }>
  banco_nome: string | null
  resumo: string
}> {
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) throw new Error('OPENAI_API_KEY não configurada')

  const prompt = `Você é um extrator de dados financeiros. Analise este extrato bancário em PDF e extraia TODAS as transações.

Retorne APENAS um JSON válido, sem texto adicional, sem markdown, sem blocos de código.

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
- tipo "debito" para gastos/saídas/compras/pagamentos
- tipo "credito" para receitas/entradas/depósitos/salário
- valor sempre positivo (número)
- data_hora sempre em formato ISO 8601
- Se não souber a hora, use T00:00:00.000Z
- Se não houver data, use a data atual
- Extraia TODAS as transações visíveis, sem omitir nenhuma`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
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
              type: 'image_url',
              image_url: {
                url: `data:application/pdf;base64,${base64}`,
                detail: 'high',
              },
            },
            { type: 'text', text: prompt },
          ],
        },
      ],
    }),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || 'Erro na OpenAI')

  const texto = data.choices?.[0]?.message?.content || ''
  const limpo = texto.replace(/```json|```/g, '').trim()
  const parsed = JSON.parse(limpo)

  return {
    transacoes: parsed.transacoes || [],
    banco_nome: parsed.banco_nome || null,
    resumo: parsed.resumo || `${parsed.transacoes?.length || 0} transações encontradas`,
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
      const base64 = Buffer.from(bytes).toString('base64')
      const { transacoes, banco_nome, resumo } = await processarPDFcomOpenAI(base64)

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