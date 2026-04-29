export const maxDuration = 60
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

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
    if (matches.length >= 2) return { id: banco.id, nome_curto: banco.nome_curto }
  }
  return null
}

async function processarCSV(arquivo: File, userId: string) {
  const texto = await arquivo.text()
  const cabecalho = texto.split('\n')[0]?.trim() || ''
  const banco = await detectarBanco(cabecalho)

  const linhas = texto.split('\n').filter((l: string) => l.trim())
  const cabecalhoLinha = linhas[0]
  const MAX_LINHAS = 200
  const csvParaIA = [cabecalhoLinha, ...linhas.slice(1, MAX_LINHAS + 1)].join('\n')
  const totalLinhas = linhas.length - 1

  const prompt = `Analise este CSV de extrato bancário e extraia AS TRANSAÇÕES.
Retorne APENAS JSON válido sem texto adicional.
Este arquivo tem ${totalLinhas} transações no total. Extraia TODAS as que estão abaixo.

CSV:
${csvParaIA}

Detecte automaticamente as colunas de: data, descrição, valor, tipo (débito/crédito).
Ignore linhas de cabeçalho, totais e linhas vazias.
Categorias disponíveis: Alimentação, Transporte, Lazer, Saúde, Moradia, Educação, Salário, Freelance, Investimento, Outros

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
  "total_encontradas":  ${totalLinhas},
  "resumo": "Encontrei X transações de DD/MM a DD/MM"
}`

  const iaResponse = await chamarIA(prompt, null)
  const iaData = await iaResponse.json()
  if (!iaData.ok) return iaResponse
  return NextResponse.json({
    ...iaData,
    banco_id:   banco?.id         || null,
    banco_nome: banco?.nome_curto || null,
  })
}

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
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`,
        },
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

  if (openaiKey && !imagem) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: 8000,
          messages: [{ role: 'user', content: prompt }],
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
