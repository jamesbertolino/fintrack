export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const formData = await request.formData()
  const arquivo = formData.get('arquivo') as File

  if (!arquivo) {
    return NextResponse.json({ error: 'Arquivo obrigatório' }, { status: 400 })
  }

  const tipo = arquivo.type
  const nome = arquivo.name.toLowerCase()

  if (tipo === 'text/csv' || nome.endsWith('.csv')) {
    return processarCSV(arquivo, user.id)
  }

  return processarImagem(arquivo, user.id)
}

// ------------------------
// Detectar banco
// ------------------------
async function detectarBanco(cabecalho: string): Promise<{ id: string; nome_curto: string } | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: bancos } = await supabase
    .from('bancos')
    .select('id, nome_curto, padrao_csv')
    .not('padrao_csv', 'is', null)

  if (!bancos) return null

  for (const banco of bancos) {
    if (!banco.padrao_csv?.length) continue

    const matches = banco.padrao_csv.filter((col: string) =>
      cabecalho.toLowerCase().includes(col.toLowerCase())
    )

    if (matches.length >= 2) {
      return { id: banco.id, nome_curto: banco.nome_curto }
    }
  }

  return null
}

// ------------------------
// CSV (CORRIGIDO)
// ------------------------
async function processarCSV(arquivo: File, userId: string) {
  try {
    const texto = await arquivo.text()
    const linhas = texto.split('\n').filter((l: string) => l.trim())

    if (linhas.length <= 1) {
      return NextResponse.json({ error: 'CSV vazio' }, { status: 400 })
    }

    const cabecalho = linhas[0]
    const banco = await detectarBanco(cabecalho)

    // 🔥 CHUNK (remove limite de 10)
    const CHUNK_SIZE = 20
    const chunks: string[][] = []

    for (let i = 1; i < linhas.length; i += CHUNK_SIZE) {
      chunks.push(linhas.slice(i, i + CHUNK_SIZE))
    }

    let todasTransacoes: any[] = []

    for (const chunk of chunks) {
      const csvChunk = [cabecalho, ...chunk].join('\n')

      const prompt = `Analise este CSV de extrato bancário e extraia TODAS as transações.

REGRAS:
- NÃO limitar quantidade
- NÃO resumir
- Retornar 100% das transações deste trecho
- Retornar APENAS JSON válido

CSV:
${csvChunk}

Formato:
{
  "transacoes": [
    {
      "descricao": "",
      "valor": 0,
      "tipo": "debito" ou "credito",
      "categoria": "",
      "data_hora": ""
    }
  ]
}`

      const iaResponse = await chamarIA(prompt, null)
      const iaData = await iaResponse.json()

      if (!iaData.ok) continue

      if (Array.isArray(iaData.transacoes)) {
        todasTransacoes.push(...iaData.transacoes)
      }
    }

    return NextResponse.json({
      ok: true,
      transacoes: todasTransacoes,
      total_encontradas: todasTransacoes.length,
      banco_id: banco?.id || null,
      banco_nome: banco?.nome_curto || null,
    })

  } catch (err: any) {
    console.error('ERRO CSV:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ------------------------
// IMAGEM (mantido)
// ------------------------
async function processarImagem(arquivo: File, userId: string) {
  const bytes = await arquivo.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
  const mediaType = arquivo.type || 'image/jpeg'

  const prompt = `Analise esta imagem e extraia as transações financeiras.

Retorne APENAS JSON válido.

Formato:
{
  "transacoes": [
    {
      "descricao": "",
      "valor": 0,
      "tipo": "debito" ou "credito",
      "categoria": "",
      "data_hora": ""
    }
  ]
}`

  return chamarIA(prompt, { base64, mediaType })
}

// ------------------------
// SAFE JSON
// ------------------------
function safeJSON(text: string) {
  try {
    return JSON.parse(text)
  } catch {
    try {
      const clean = text.replace(/```json|```/g, '').trim()
      return JSON.parse(clean)
    } catch {
      return null
    }
  }
}

// ------------------------
// CHAMAR IA (CORRIGIDO)
// ------------------------
async function chamarIA(prompt: string, imagem: { base64: string; mediaType: string } | null) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY

  if (anthropicKey) {
    try {
      const content: any = imagem
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
        const parsed = safeJSON(data.content[0].text)

        if (!parsed) throw new Error('JSON inválido da IA')

        return NextResponse.json({ ok: true, ...parsed })
      }

    } catch (err) {
      console.error('Erro Anthropic:', err)
    }
  }

  return NextResponse.json({ error: 'Falha na IA' }, { status: 500 })
}