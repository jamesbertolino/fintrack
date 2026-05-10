// Simula o texto bruto que o unpdf extrai de um extrato Bradesco
// e testa o pipeline de extração JSON da IA
// Uso: node --env-file=.env.local scripts/test-pdf-parser.mjs

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

// ─── Cenários de texto simulando o que unpdf extrai de um PDF Bradesco ────────
const CENARIOS = {
  // Cenário 1: texto com quebras de linha (melhor caso)
  'COM_QUEBRAS': `Banco Bradesco S.A.
Agência: 1234-5   Conta: 99999-0   Período: 01/01/2026 a 31/03/2026

Data      Histórico                              Nº doc.    Valor      Saldo
Saldo anterior                                                      37.461,41

02/01/2026 PAGTO ELETRON COBRANCA
NU PAGAMENTOS SA                                0000705    710,70   36.751,41
02/01/2026 CARTAO VISA ELECTRON
CASA DAS EMBALAGENS                             0007369    103,45   36.647,96
05/01/2026 PIX
DES: JOAO SILVA SANTOS                          0023411    500,00   36.147,96
07/01/2026 TED REMET.POCOS DE CBL
EMPRESA XYZ LTDA                                2154536  4.000,00   40.147,96
09/01/2026 CARTAO MASTERCARD DEBITO
SUPERMERCADO IDEAL                              0045123    189,35   39.958,61
09/01/2026 RENDIMENTOS POUP FACIL
                                                           13,56   39.972,17
10/01/2026 SAQUE DINHEIRO ATM
CAIXA ELETRONICO                                0000001  1.000,00   38.972,17
10/01/2026 CARTAO VISA ELECTRON
RESTAURANTE BON VIVANT                          0067890     87,50   38.884,67

Total de débitos: 2.590,00    Total de créditos: 4.013,56
Saldo final: 38.884,67`,

  // Cenário 2: texto CONTÍNUO sem quebras (o que unpdf frequentemente produz)
  'SEM_QUEBRAS': `Banco Bradesco S.A. Agência: 1234-5 Conta: 99999-0 Período: 01/01/2026 a 31/03/2026 Data Histórico Nº doc. Valor Saldo Saldo anterior 37.461,41 02/01/2026 PAGTO ELETRON COBRANCA NU PAGAMENTOS SA 0000705 710,70 36.751,41 02/01/2026 CARTAO VISA ELECTRON CASA DAS EMBALAGENS 0007369 103,45 36.647,96 05/01/2026 PIX DES: JOAO SILVA SANTOS 0023411 500,00 36.147,96 07/01/2026 TED REMET.POCOS DE CBL EMPRESA XYZ LTDA 2154536 4.000,00 40.147,96 09/01/2026 CARTAO MASTERCARD DEBITO SUPERMERCADO IDEAL 0045123 189,35 39.958,61 09/01/2026 RENDIMENTOS POUP FACIL 13,56 39.972,17 10/01/2026 SAQUE DINHEIRO ATM CAIXA ELETRONICO 0000001 1.000,00 38.972,17 10/01/2026 CARTAO VISA ELECTRON RESTAURANTE BON VIVANT 0067890 87,50 38.884,67 Total de débitos: 2.590,00 Total de créditos: 4.013,56 Saldo final: 38.884,67`,

  // Cenário 3: LIMITE DE PÁGINA — fim de uma página, começo da próxima
  // (com overlap de 400 chars da página anterior)
  'LIMITE_PAGINA': `[CONTEXTO ANTERIOR — não extraia transações deste bloco]
09/01/2026 CARTAO MASTERCARD DEBITO
SUPERMERCADO IDEAL                              0045123    189,35   39.958,61
09/01/2026 RENDIMENTOS POUP FACIL
[PÁGINA ATUAL — extraia todas as transações daqui]
                                                           13,56   39.972,17
10/01/2026 SAQUE DINHEIRO ATM
CAIXA ELETRONICO                                0000001  1.000,00   38.972,17
10/01/2026 CARTAO VISA ELECTRON
RESTAURANTE BON VIVANT                          0067890     87,50   38.884,67
Folha: 2/3     Total de débitos: 1.277,00`,
}

const ESPERADO = [
  { data: '02/01/2026', historico: 'NU PAGAMENTOS SA',        valor: '710,70',   tipo: 'debito'  },
  { data: '02/01/2026', historico: 'CASA DAS EMBALAGENS',     valor: '103,45',   tipo: 'debito'  },
  { data: '05/01/2026', historico: 'JOAO SILVA SANTOS',       valor: '500,00',   tipo: 'debito'  },
  { data: '07/01/2026', historico: /EMPRESA XYZ|REMET/i,      valor: '4.000,00', tipo: 'credito' },
  { data: '09/01/2026', historico: /SUPERMERCADO|IDEAL/i,     valor: '189,35',   tipo: 'debito'  },
  { data: '09/01/2026', historico: /RENDIMENTOS|POUP/i,       valor: '13,56',    tipo: 'credito' }, // ← frequentemente perdido
  { data: '10/01/2026', historico: /SAQUE|CAIXA/i,            valor: '1.000,00', tipo: 'debito'  },
  { data: '10/01/2026', historico: /BON VIVANT|RESTAURAN/i,   valor: '87,50',    tipo: 'debito'  },
]

async function testarCenario(nome, texto) {
  console.log(`\n${'═'.repeat(70)}`)
  console.log(`  CENÁRIO: ${nome}`)
  console.log('═'.repeat(70))

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 4096,
      temperature: 0,
      messages: [
        { role: 'system', content: PROMPT_PDF_JSON_SYSTEM },
        { role: 'user',   content: `Extraia TODAS as transações do texto abaixo. Agrupe linhas da mesma transação.\n\n${texto}` },
      ],
    }),
  })

  const data = await res.json()
  if (!res.ok) {
    console.error('  ❌ Erro na API:', data.error?.message)
    return
  }

  const conteudo = (data.choices?.[0]?.message?.content ?? '').replace(/```json|```/g, '').trim()

  let itens = []
  try {
    itens = JSON.parse(conteudo)
  } catch {
    console.error('  ❌ JSON inválido retornado:')
    console.error(conteudo.slice(0, 500))
    return
  }

  console.log(`\n  IA retornou ${itens.length} transações:`)
  itens.forEach((t, i) => {
    const val = t.credito || t.debito || '?'
    const dir = t.credito ? '↑ crédito' : '↓ débito'
    console.log(`    [${i+1}] ${t.data}  ${String(t.historico).padEnd(30)} R$ ${String(val).padStart(10)}  ${dir}  saldo: ${t.saldo}`)
  })

  console.log('\n  Validação contra esperado:')
  let ok = 0, fail = 0
  for (const esp of ESPERADO) {
    if (nome === 'LIMITE_PAGINA' && esp.data !== '09/01/2026' && esp.data !== '10/01/2026') continue
    const match = itens.find(t =>
      t.data === esp.data &&
      (typeof esp.historico === 'string'
        ? t.historico?.toUpperCase().includes(esp.historico.toUpperCase())
        : esp.historico.test(t.historico))
    )
    if (match) {
      console.log(`    ✅ ${esp.data} ${typeof esp.historico === 'string' ? esp.historico : esp.historico.source}`)
      ok++
    } else {
      console.log(`    ❌ FALTANDO: ${esp.data} ${typeof esp.historico === 'string' ? esp.historico : esp.historico.source} (R$ ${esp.valor})`)
      fail++
    }
  }
  console.log(`\n  Resultado: ${ok} OK, ${fail} faltando`)

  if (fail > 0) {
    console.log('\n  JSON bruto da IA:')
    console.log(conteudo)
  }
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY não encontrada. Use: node --env-file=.env.local scripts/test-pdf-parser.mjs')
    process.exit(1)
  }

  console.log('Testando pipeline de extração PDF → JSON...\n')
  for (const [nome, texto] of Object.entries(CENARIOS)) {
    await testarCenario(nome, texto)
  }
  console.log('\n' + '═'.repeat(70))
  console.log('Teste concluído.')
}

main().catch(console.error)
