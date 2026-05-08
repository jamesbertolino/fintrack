import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// Converte o texto bruto do PDF em linhas CSV estruturadas
function pdfTextToCSV(text: string): string {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  const reData  = /\b(\d{2}\/\d{2}\/\d{4})\b/
  const reValor = /\b(\d{1,3}(?:\.\d{3})*,\d{2})\b/
  const reSinal = /\b(D|C|Déb|Créd|deb|cred|débito|crédito|debit|credit)\b/i

  const rows: string[] = ['Data;Historico;Valor;Tipo']

  for (let i = 0; i < lines.length; i++) {
    const linha = lines[i]
    const mData = linha.match(reData)
    if (!mData) continue

    const data = mData[1]
    let desc  = linha.replace(reData, '').trim()
    let valor = ''
    let tipo  = 'debito'

    // Valor na mesma linha
    const mValor = linha.match(reValor)
    if (mValor) {
      valor = mValor[1]
      desc  = desc.replace(reValor, '').trim()
    }

    // Sinal na mesma linha
    const mSinal = linha.match(reSinal)
    if (mSinal) {
      tipo = /c|cred|créd/i.test(mSinal[1]) ? 'credito' : 'debito'
      desc = desc.replace(reSinal, '').trim()
    }

    // Se ainda sem valor, procura nas próximas 4 linhas
    if (!valor) {
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const mV = lines[j].match(reValor)
        if (mV) {
          valor = mV[1]
          // Descrição pode estar nessa linha também
          if (!desc || desc.length < 3) {
            desc = lines[j].replace(reValor, '').replace(reData, '').trim()
          }
          // Sinal
          const mS = lines[j].match(reSinal)
          if (mS) tipo = /c|cred|créd/i.test(mS[1]) ? 'credito' : 'debito'
          break
        }
        // Linha sem valor mas com texto — pode ser a descrição
        if (!desc || desc.length < 3) {
          const candidate = lines[j].replace(reData, '').trim()
          if (candidate.length > 3 && !candidate.match(/^\d+$/)) desc = candidate
        }
      }
    }

    if (!valor || !desc || desc.length < 2) continue

    // Limpa descrição
    desc = desc.replace(/[;]/g, ' ').replace(/\s{2,}/g, ' ').trim()
    rows.push(`${data};${desc};${valor};${tipo}`)
  }

  return rows.join('\n')
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const formData = await request.formData()
  const arquivo  = formData.get('arquivo') as File | null
  if (!arquivo || !arquivo.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'Envie um arquivo PDF' }, { status: 400 })
  }

  const bytes = await arquivo.arrayBuffer()

  const { extractText } = await import('unpdf')
  const { text } = await extractText(new Uint8Array(bytes), { mergePages: true })

  if (!text || text.trim().length < 20) {
    return NextResponse.json({ error: 'Não foi possível extrair texto do PDF. O arquivo pode ser uma imagem escaneada — envie como JPG ou PNG.' }, { status: 422 })
  }

  const csv = pdfTextToCSV(text)
  const linhas = csv.split('\n').length - 1 // exclui cabeçalho

  return NextResponse.json({ csv, linhas_detectadas: linhas, texto_bruto: text.length })
}
