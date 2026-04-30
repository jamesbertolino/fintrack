export const maxDuration = 60
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const formData = await request.formData()
  const arquivo = formData.get('arquivo') as File

  if (!arquivo) return NextResponse.json({ error: 'Arquivo obrigatório' }, { status: 400 })

  const tipo = arquivo.type
  const nome = arquivo.name.toLowerCase()

  if (tipo === 'text/csv' || nome.endsWith('.csv')) {
    return processarCSV(arquivo, user.id)
  }

  return processarImagem(arquivo, user.id)
}

// ─────────────────────────────────────────────
// PIPELINE CSV — 3 ETAPAS
// ─────────────────────────────────────────────

// Etapa 1: Detectar banco e mapear colunas via IA (apenas 10 linhas)
async function detectarFormatoCSV(primeirasLinhas: string): Promise<{
  banco: string
  separador: string
  linha_inicio_dados: number
  colunas: {
    data: number
    descricao: number
    valor: number | null
    credito: number | null
    debito: number | null
  }
} | null> {
  const prompt = `Analise as primeiras linhas deste extrato bancário e identifique o formato.
Retorne APENAS JSON válido sem texto adicional.

Linhas:
${primeirasLinhas}

Retorne:
{
  "banco": "nome do banco detectado ou 'Desconhecido'",
  "separador": "caractere separador das colunas (;, ou TAB)",
  "linha_inicio_dados": número da linha (0-based) onde começam os dados reais,
  "colunas": {
    "data": índice da coluna de data,
    "descricao": índice da coluna de descrição/histórico,
    "valor": índice da coluna de valor único (null se tiver crédito/débito separados),
    "credito": índice da coluna de crédito (null se tiver valor único),
    "debito": índice da coluna de débito (null se tiver valor único)
  }
}`

  return chamarIATexto(prompt)
}

// Etapa 2: Parsear todas as linhas no servidor sem IA
function parsearLinhasCSV(
  linhas: string[],
  formato: NonNullable<Awaited<ReturnType<typeof detectarFormatoCSV>>>
): Array<{ descricao: string; valor: number; tipo: 'debito' | 'credito'; data_hora: string }> {
  const { separador, colunas, linha_inicio_dados } = formato
  const transacoes = []

  for (let i = linha_inicio_dados; i < linhas.length; i++) {
    const linha = linhas[i]?.trim()
    if (!linha) continue

    const cols = linha.split(separador)

    const dataRaw = cols[colunas.data]?.trim()
    const descricao = cols[colunas.descricao]?.trim()

    if (!dataRaw || !descricao) continue

    // Parse da data — suporta DD/MM/YYYY e YYYY-MM-DD
    let data_hora: string
    if (dataRaw.includes('/')) {
      const [dia, mes, ano] = dataRaw.split('/')
      data_hora = `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}T12:00:00Z`
    } else {
      data_hora = `${dataRaw}T12:00:00Z`
    }

    let valor = 0
    let tipo: 'debito' | 'credito' = 'debito'

    const limparNumero = (raw: string | undefined) =>
      parseFloat((raw || '0').replace(/\./g, '').replace(',', '.').trim()) || 0

    if (colunas.valor !== null) {
      const valorNum = limparNumero(cols[colunas.valor])
      valor = Math.abs(valorNum)
      tipo = valorNum < 0 ? 'debito' : 'credito'
    } else {
      const credito = limparNumero(cols[colunas.credito ?? -1])
      const debito = limparNumero(cols[colunas.debito ?? -1])

      if (debito > 0) {
        valor = debito
        tipo = 'debito'
      } else {
        valor = credito
        tipo = 'credito'
      }
    }

    if (valor === 0) continue

    transacoes.push({ descricao, valor, tipo, data_hora })
  }

  return transacoes
}

// Etapa 3: Categorizar em chunks de 100 descrições por vez
async function categorizarEmChunks(
  transacoes: Array<{ descricao: string; valor: number; tipo: 'debito' | 'credito'; data_hora: string }>
): Promise<Array<{ descricao: string; valor: number; tipo: 'debito' | 'credito'; data_hora: string; categoria: string }>> {
  const CHUNK_SIZE = 100
  const categoriasDisponiveis = 'Alimentação, Transporte, Lazer, Saúde, Moradia, Educação, Salário, Freelance, Investimento, Outros'
  const resultado: Array<{ descricao: string; valor: number; tipo: 'debito' | 'credito'; data_hora: string; categoria: string }> = []

  for (let i = 0; i < transacoes.length; i += CHUNK_SIZE) {
    const chunk = transacoes.slice(i, i + CHUNK_SIZE)
    const lista = chunk.map((t, idx) => `${idx}: ${t.descricao}`).join('\n')

    const prompt = `Categorize cada transação abaixo com uma das categorias disponíveis.
Retorne APENAS JSON válido sem texto adicional.

Categorias: ${categoriasDisponiveis}

Transações:
${lista}

Retorne:
{
  "categorias": ["categoria0", "categoria1", ...]
}
O array deve ter exatamente ${chunk.length} itens, na mesma ordem.`

    const iaResult = await chamarIATexto(prompt)
    const categorias: string[] = iaResult?.categorias || chunk.map(() => 'Outros')

    chunk.forEach((t, idx) => {
      resultado.push({ ...t, categoria: categorias[idx] || 'Outros' })
    })
  }

  return resultado
}

// Função principal CSV reescrita
async function processarCSV(arquivo: File, userId: string) {
  const texto = await arquivo.text()
  const linhas = texto.split('\n').filter((l: string) => l.trim())

  // Etapa 1: detectar formato com as primeiras 10 linhas
  const primeirasLinhas = linhas.slice(0, 10).join('\n')
  const formato = await detectarFormatoCSV(primeirasLinhas)

  if (!formato) {
    return NextResponse.json(
      { error: 'Não foi possível identificar o formato do extrato' },
      { status: 400 }
    )
  }

  // Etapa 2: parsear todas as linhas no servidor
  const transacoesBrutas = parsearLinhasCSV(linhas, formato)

  if (transacoesBrutas.length === 0) {
    return NextResponse.json(
      { error: 'Nenhuma transação encontrada no arquivo' },
      { status: 400 }
    )
  }

  // Etapa 3: categorizar em chunks
  const transacoes = await categorizarEmChunks(transacoesBrutas)

  const dataInicio = transacoes[0]?.data_hora?.slice(0, 10)
  const dataFim = transacoes[transacoes.length - 1]?.data_hora?.slice(0, 10)

  return NextResponse.json({
    ok: true,
    transacoes,
    total_encontradas: transacoes.length,
    banco_nome: formato.banco,
    resumo: `Encontrei ${transacoes.length} transações de ${dataInicio} a ${dataFim}`,
  })
}

// ─────────────────────────────────────────────
// IMAGEM (mantido igual ao original)
// ─────────────────────────────────────────────

async function processarImagem(arquivo: File, userId: string) {
  const bytes = await arquivo.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
  const mediaType = arquivo.type || 'image/jpeg'

  const prompt = `Analise esta imagem (cupom, nota fiscal, fatura ou comprovante) e extraia as transações financeiras.
Retorne APENAS JSON válido sem texto adicional.

Categorias disponíveis: Alimentação, Transporte, Lazer, Saúde, Moradia, Educação, Salário, Freelance, Investimento, Outros

Se for um cupom com vários itens, agrupe em UMA transação com o total.
Se for uma fatura com várias compras, liste cada uma separadamente.

Retorne:
{
  "transacoes": [
    {
      "descricao": "Nome limpo da transação",
      "valor": 100.00,
      "tipo": "debito" ou "credito",
      "categoria": "categoria",
      "data_hora": "2026-04-26T10:00:00Z"
    }
  ],
  "total_encontradas": 1,
  "resumo": "Descrição breve do documento"
}`

  return chamarIA(prompt, { base64, mediaType })
}

// ─────────────────────────────────────────────
// HELPERS DE IA
// ─────────────────────────────────────────────

// Apenas texto — usado na pipeline CSV
async function chamarIATexto(prompt: string): Promise<any | null> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY

  if (anthropicKey) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 4000,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      const data = await res.json()
      if (res.ok && data.content?.[0]?.text) {
        return JSON.parse(data.content[0].text.replace(/```json|```/g, '').trim())
      }
    } catch { /* fallback OpenAI */ }
  }

  const openaiKey = process.env.OPENAI_API_KEY
  if (openaiKey) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: 4000,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      const data = await res.json()
      if (res.ok && data.choices?.[0]?.message?.content) {
        return JSON.parse(data.choices[0].message.content.replace(/```json|```/g, '').trim())
      }
    } catch { /* erro */ }
  }

  return null
}

// Texto + imagem — usado para processarImagem
async function chamarIA(prompt: string, imagem: { base64: string; mediaType: string } | null) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY

  if (anthropicKey) {
    try {
      const content: unknown[] = imagem
        ? [
            { type: 'image', source: { type: 'base64', media_type: imagem.mediaType, data: imagem.base64 } },
            { type: 'text', text: prompt },
          ]
        : [{ type: 'text', text: prompt }]

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 8000,
          messages: [{ role: 'user', content }],
        }),
      })

      const data = await res.json()
      if (res.ok && data.content?.[0]?.text) {
        const resultado = JSON.parse(data.content[0].text.replace(/```json|```/g, '').trim())
        return NextResponse.json({ ok: true, ...resultado })
      }
    } catch { /* fallback OpenAI */ }
  }

  const openaiKey = process.env.OPENAI_API_KEY

  if (openaiKey && imagem) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o',
          max_tokens: 8000,
          messages: [{
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:${imagem.mediaType};base64,${imagem.base64}` } },
              { type: 'text', text: prompt },
            ],
          }],
        }),
      })
      const data = await res.json()
      if (res.ok && data.choices?.[0]?.message?.content) {
        const resultado = JSON.parse(data.choices[0].message.content.replace(/```json|```/g, '').trim())
        return NextResponse.json({ ok: true, ...resultado })
      }
    } catch { /* erro */ }
  }

  return NextResponse.json({ error: 'Não foi possível processar o arquivo' }, { status: 500 })
}