import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const [profile, transactions, contas, metas, orcamentos] = await Promise.all([
    supabase.from('profiles').select('nome, sobrenome, plano, whatsapp, timezone, created_at, lgpd_aceito_em').eq('id', user.id).single(),
    supabase.from('transactions').select('descricao, valor, tipo, categoria, data_hora, origem, created_at').eq('user_id', user.id).order('data_hora', { ascending: false }),
    supabase.from('contas').select('nome, tipo, saldo_inicial, created_at').eq('user_id', user.id),
    supabase.from('metas').select('titulo, valor_alvo, valor_atual, prazo, status, created_at').eq('user_id', user.id),
    supabase.from('orcamentos').select('categoria, limite, periodo, created_at').eq('user_id', user.id),
  ])

  const payload = {
    exportado_em: new Date().toISOString(),
    titular: {
      email: user.email,
      ...profile.data,
    },
    transacoes:  transactions.data  ?? [],
    contas:      contas.data        ?? [],
    metas:       metas.data         ?? [],
    orcamentos:  orcamentos.data    ?? [],
  }

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="poupaup-dados-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  })
}
