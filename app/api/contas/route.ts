import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: contas } = await supabase
    .from('contas')
    .select('*, bancos(id, nome, nome_curto, cor, logo_url)')
    .eq('user_id', user.id)
    .eq('ativo', true)
    .order('created_at')

  const contasComSaldo = await Promise.all((contas || []).map(async conta => {
    const { data: txs } = await supabase
      .from('transactions')
      .select('valor')
      .eq('user_id', user.id)
      .eq('conta_id', conta.id)

    const saldo = (txs || []).reduce((acc: number, t: { valor: number }) => acc + t.valor, 0)
    return { ...conta, saldo }
  }))

  return NextResponse.json({ contas: contasComSaldo })
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { banco_id, nome, tipo, numero, agencia, mostrar_saldo, saldo_inicial } = await request.json()

  const { data, error } = await supabase.from('contas').insert({
    user_id:       user.id,
    banco_id,
    nome,
    tipo:          tipo || 'corrente',
    numero,
    agencia,
    mostrar_saldo: mostrar_saldo ?? true,
  }).select('*').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const valorInicial = parseFloat(saldo_inicial) || 0
  if (valorInicial > 0 && data) {
    await supabase.from('transactions').insert({
      user_id:   user.id,
      descricao: 'Saldo inicial',
      valor:     valorInicial,
      tipo:      'credito',
      categoria: 'Outros',
      conta_id:  data.id,
      origem:    'saldo_inicial',
      data_hora: new Date().toISOString(),
    })
  }

  return NextResponse.json({ ok: true, conta: data })
}
