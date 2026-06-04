import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { rateLimit } from '@/lib/rateLimit'

const CATEGORIAS = ['Alimentação','Transporte','Lazer','Saúde','Moradia','Educação','Salário','Freelance','Investimento','Presente','Outros']

const PROMPT = `Você é um assistente que converte frases em português brasileiro sobre transações financeiras em JSON estruturado.

Retorne APENAS um objeto JSON válido (sem markdown, sem explicação) com os campos:
{
  "valor": number (valor em reais, sempre positivo, interprete por extenso: "cinquenta" = 50, "dois mil e quinhentos" = 2500),
  "tipo": "debito" | "credito" (debito = gasto/despesa/compra/paguei, credito = receita/recebi/salário/entrada),
  "descricao": string (descrição curta em português, max 40 chars, título capitalizado),
  "categoria": string (exatamente uma de: Alimentação, Transporte, Lazer, Saúde, Moradia, Educação, Salário, Freelance, Investimento, Presente, Outros)
}

Exemplos:
- "gastei cinquenta reais no mercado" → {"valor":50,"tipo":"debito","descricao":"Mercado","categoria":"Alimentação"}
- "recebi dois mil de salário" → {"valor":2000,"tipo":"credito","descricao":"Salário","categoria":"Salário"}
- "paguei duzentos e trinta na farmácia" → {"valor":230,"tipo":"debito","descricao":"Farmácia","categoria":"Saúde"}
- "paguei a conta de luz cento e vinte reais" → {"valor":120,"tipo":"debito","descricao":"Conta de Luz","categoria":"Moradia"}
- "almocei quarenta e cinco reais" → {"valor":45,"tipo":"debito","descricao":"Almoço","categoria":"Alimentação"}
- "ganhei trezentos de freela" → {"valor":300,"tipo":"credito","descricao":"Freelance","categoria":"Freelance"}
- "comprei ingresso de cinema trinta reais" → {"valor":30,"tipo":"debito","descricao":"Cinema","categoria":"Lazer"}

Se não conseguir interpretar um valor ou tipo, retorne {"erro":"não entendi"}.`

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const rl = await rateLimit({ key: `ia-voz:${user.id}`, limit: 30, windowSec: 60 })
  if (!rl.allowed) return NextResponse.json({ error: 'Muitas requisições' }, { status: 429 })

  const { transcript } = await request.json()
  if (!transcript?.trim()) return NextResponse.json({ error: 'Transcrição vazia' }, { status: 400 })

  const userPrompt = `Frase: "${transcript.trim()}"`

  // ── Tentar Anthropic ──────────────────────────────────────────────────────
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (anthropicKey) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 200,
          system: PROMPT,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      })
      const data = await res.json()
      if (res.ok && data.content?.[0]?.text) {
        return parseAndReturn(data.content[0].text)
      }
    } catch { /* fallthrough */ }
  }

  // ── Fallback: OpenAI ──────────────────────────────────────────────────────
  const openaiKey = process.env.OPENAI_API_KEY
  if (openaiKey) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: 200,
          messages: [{ role: 'system', content: PROMPT }, { role: 'user', content: userPrompt }],
        }),
      })
      const data = await res.json()
      if (!res.ok) return NextResponse.json({ error: `OpenAI: ${data.error?.message || res.status}` }, { status: 500 })
      if (data.choices?.[0]?.message?.content) {
        return parseAndReturn(data.choices[0].message.content)
      }
    } catch (e) {
      return NextResponse.json({ error: `Erro ao chamar IA: ${e instanceof Error ? e.message : 'desconhecido'}` }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Chave de IA não configurada no servidor' }, { status: 500 })
}

function parseAndReturn(text: string): NextResponse {
  try {
    // Extrai o primeiro bloco JSON da resposta — ignora texto antes/depois
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ error: 'IA não retornou JSON válido' }, { status: 422 })
    const json = JSON.parse(match[0])
    if (json.erro) return NextResponse.json({ error: json.erro }, { status: 422 })
    if (!json.valor || !json.tipo || !json.descricao) return NextResponse.json({ error: 'Resposta incompleta da IA' }, { status: 422 })
    if (!CATEGORIAS.includes(json.categoria)) json.categoria = 'Outros'
    return NextResponse.json({
      valor:     Math.abs(Number(json.valor)),
      tipo:      json.tipo === 'credito' ? 'credito' : 'debito',
      descricao: String(json.descricao).slice(0, 50),
      categoria: json.categoria,
    })
  } catch {
    return NextResponse.json({ error: 'Não consegui interpretar a frase' }, { status: 422 })
  }
}
