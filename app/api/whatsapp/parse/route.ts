import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const CATEGORIAS = ['Alimentação','Transporte','Lazer','Saúde','Moradia','Educação','Salário','Freelance','Investimento','Outros']
const N8N_SECRET = process.env.N8N_WEBHOOK_SECRET || 'granaup-secret-2026'

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-n8n-secret')
  if (secret !== N8N_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { numero, mensagem, grupo_id, apenas_interpretar } = await request.json()
  if (!numero || !mensagem) {
    return NextResponse.json({ error: 'numero e mensagem são obrigatórios' }, { status: 400 })
  }

  const supabase = getSupabase()
  const numeroLimpo = numero.replace(/\D/g, '')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, nome, whatsapp')
    .eq('whatsapp', numeroLimpo)
    .single()

  if (!profile) {
    return NextResponse.json({
      ok: false,
      resposta: '❌ Número não autorizado. Cadastre seu WhatsApp no PoupaUp em Perfil → Dados pessoais.',
      ignorar: true,
    })
  }

  const prompt = `
Você é um sistema de extração de dados financeiros.
Retorne APENAS JSON válido. Nenhum texto antes ou depois. Sem markdown. Sem blocos de código.

Mensagem do usuário: "${mensagem}"

Categorias disponíveis: ${CATEGORIAS.join(', ')}

FORMATOS DE VALOR ACEITOS:
- Inteiro: 50 | 100
- Decimal ponto: 50.00 | 1000.50
- Decimal vírgula: 50,00 | 1.000,50
- Com moeda: R$50 | R$ 50 | 50 reais | 50 conto | 50 pila
- Com sinal: +100 | -100 | + 100 | - 100

CLASSIFICAÇÃO DE TIPO:
- "credito": salário, recebimento, receita, entrada, ganho, renda, freelance, dividendo, transferência recebida, depósito
- "debito": gasto, compra, pagamento, despesa, conta, fatura, taxa, combustível, aluguel, transferência enviada, retirada

REGRAS OBRIGATÓRIAS:
1. Retorne APENAS o objeto JSON. Zero texto fora dele.
2. Se NÃO houver valor numérico explícito → reconhecido: false, valor: null, tipo: null.
3. NUNCA invente ou estime valores ausentes.
4. Normalize o valor para float com duas casas decimais (ex: 50,00 → 50.00).
5. Preencha descricao e categoria mesmo quando reconhecido: false.
6. Se o tipo for ambíguo → reconhecido: false.

EXEMPLOS:
Entrada: "combustivel carro familia - R$100"
Saída: {"descricao":"Combustível - carro família","valor":100.00,"tipo":"debito","categoria":"Transporte","reconhecido":true}

Entrada: "salário + R$3000"
Saída: {"descricao":"Salário","valor":3000.00,"tipo":"credito","categoria":"Salário","reconhecido":true}

Entrada: "gastei 37,90 no ifood"
Saída: {"descricao":"iFood","valor":37.90,"tipo":"debito","categoria":"Alimentação","reconhecido":true}

Entrada: "recebi 200"
Saída: {"descricao":"Recebimento","valor":200.00,"tipo":"credito","categoria":"Outros","reconhecido":true}

Entrada: "presente pai"
Saída: {"descricao":"Presente - pai","valor":null,"tipo":null,"categoria":"Presente","reconhecido":false}

Entrada: "mercado"
Saída: {"descricao":"Mercado","valor":null,"tipo":null,"categoria":"Alimentação","reconhecido":false}

SCHEMA DE RESPOSTA:
{
  "descricao": "string — descrição limpa e capitalizada",
  "valor": "number com duas casas decimais ou null",
  "tipo": "debito | credito | null",
  "categoria": "uma das categorias disponíveis acima",
  "reconhecido": "true | false"
}
`

  let parsed: { descricao: string; valor: number; tipo: string; categoria: string; reconhecido: boolean } | null = null

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 200, messages: [{ role: 'user', content: prompt }] }),
      })
      const data = await res.json()
      if (res.ok && data.content?.[0]?.text) {
        parsed = JSON.parse(data.content[0].text.replace(/```json|```/g, '').trim())
      }
    } catch { /* fallback */ }
  }

  if (!parsed && process.env.OPENAI_API_KEY) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: 200, messages: [{ role: 'user', content: prompt }] }),
      })
      const data = await res.json()
      if (res.ok && data.choices?.[0]?.message?.content) {
        parsed = JSON.parse(data.choices[0].message.content.replace(/```json|```/g, '').trim())
      }
    } catch { /* erro */ }
  }

  if (!parsed || !parsed.reconhecido) {
    await supabase.from('whatsapp_logs').insert({
      user_id: profile.id, numero: numeroLimpo,
      mensagem_recebida: mensagem, status: 'ignorada',
      erro: 'IA não reconheceu a mensagem',
    })
    return NextResponse.json({
      ok: false,
      resposta: `❓ Não entendi o valor. Tente assim:\n\n*mercado - R$150*\n*salário + R$3.000*\n*uber 32,50*`,
    })
  }

  // Modo só interpretar: retorna dados sem persistir
  if (apenas_interpretar) {
    return NextResponse.json({
      ok: true,
      interpretacao: {
        descricao: parsed.descricao,
        valor:     parsed.valor,
        tipo:      parsed.tipo,
        categoria: parsed.categoria,
      },
    })
  }

  const { data: profileFull } = await supabase
    .from('profiles')
    .select('conta_padrao_id')
    .eq('id', profile.id)
    .single()

  const { data: transacao, error } = await supabase
    .from('transactions')
    .insert({
      user_id:   profile.id,
      descricao: parsed.descricao,
      valor:     parsed.tipo === 'debito' ? -Math.abs(parsed.valor) : Math.abs(parsed.valor),
      tipo:      parsed.tipo,
      categoria: parsed.categoria,
      data_hora: new Date().toISOString(),
      origem:    'whatsapp',
      grupo_id:  grupo_id || null,
      conta_id:  profileFull?.conta_padrao_id || null,
    })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ ok: false, resposta: '❌ Erro ao salvar. Tente novamente.' })
  }

  await supabase.from('whatsapp_logs').insert({
    user_id: profile.id, numero: numeroLimpo,
    mensagem_recebida: mensagem, mensagem_enviada: '✅ Lançado!',
    transacao_id: transacao.id, status: 'processada',
  })

  const emoji = parsed.tipo === 'debito' ? '💸' : '💰'
  const sinal = parsed.tipo === 'debito' ? '-' : '+'
  const resposta = `${emoji} *Lançado com sucesso!*\n\n📝 ${parsed.descricao}\n💵 ${sinal}R$ ${Math.abs(parsed.valor).toFixed(2)}\n🏷️ ${parsed.categoria}\n\n_Registrado no PoupaUp_ ✓`

  return NextResponse.json({ ok: true, resposta, transacao_id: transacao.id })
}