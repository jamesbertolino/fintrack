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
Extraia dados financeiros de um texto.

Responda APENAS com JSON válido.

Entrada: "${mensagem}"

Categorias: ${CATEGORIAS.join(', ')}

REGRAS:
- Encontre um valor numérico (antes ou depois do texto)
- Aceite formatos: 50 | 50.00 | 50,00 | 1.000,50 | R$50 | 50 reais | +100 | -100
- Nunca invente valores

PROCESSO:
- Se NÃO houver número:
  {
    "descricao": "gasto nao identificado, tente com outro formato",
    "valor": null,
    "tipo": null,
    "categoria": "diversos",
    "reconhecido": false
  }

- Se houver número:
  - "valor" = número (float com 2 casas)
  - "descricao" = restante do texto (curta e limpa)
  - "tipo":
    - entrada → "credito"
    - saída → "debito"
    - se não souber → null
  - "categoria":
    - se encontrar similar → usar
    - senão → "diversos"
  - "reconhecido": true

SAÍDA:
{
  "descricao": "string",
  "valor": number | null,
  "tipo": "debito" | "credito" | null,
  "categoria": "string",
  "reconhecido": boolean
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