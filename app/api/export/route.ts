import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const [
    profile,
    transactions,
    contas,
    metas,
    orcamentos,
    conquistas,
    desafios,
    notificacoes,
    missoes,
    iaLogs,
    auditLog,
  ] = await Promise.all([
    supabase.from('profiles')
      .select('nome, sobrenome, plano, whatsapp, timezone, idioma, data_nascimento, genero, created_at, lgpd_aceito_em')
      .eq('id', user.id).single(),
    supabase.from('transactions')
      .select('descricao, valor, tipo, categoria, data_hora, origem, ref_externa, created_at')
      .eq('user_id', user.id).order('data_hora', { ascending: false }),
    supabase.from('contas')
      .select('nome, tipo, saldo_inicial, created_at')
      .eq('user_id', user.id),
    supabase.from('goals')
      .select('nome, valor_total, valor_atual, contribuicao_mensal, prazo, ativo, created_at')
      .eq('user_id', user.id),
    supabase.from('orcamentos')
      .select('categoria, valor_planejado, mes, created_at')
      .eq('user_id', user.id),
    supabase.from('conquistas_usuario')
      .select('conquista_id, desbloqueada_em')
      .eq('user_id', user.id),
    supabase.from('desafios_usuario')
      .select('desafio_id, status, iniciado_em, termina_em, progresso_atual')
      .eq('user_id', user.id),
    supabase.from('notificacoes')
      .select('titulo, mensagem, tipo, lida, created_at')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(200),
    supabase.from('missoes_usuario')
      .select('missao_id, status, concluida_em, created_at')
      .eq('user_id', user.id),
    supabase.from('ia_usage_logs')
      .select('endpoint, provider, modelo, prompt_tokens, completion_tokens, total_tokens, created_at')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(500),
    supabase.from('audit_log')
      .select('action, resource_id, metadata, created_at')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(500),
  ])

  const payload = {
    exportado_em:   new Date().toISOString(),
    formato:        'PoupaUp LGPD Data Export v2',
    titular: {
      email: user.email,
      ...profile.data,
    },
    transacoes:     transactions.data    ?? [],
    contas:         contas.data          ?? [],
    metas:          metas.data           ?? [],
    orcamentos:     orcamentos.data      ?? [],
    conquistas:     conquistas.data      ?? [],
    desafios:       desafios.data        ?? [],
    notificacoes:   notificacoes.data    ?? [],
    missoes:        missoes.data         ?? [],
    uso_ia:         iaLogs.data          ?? [],
    historico_acoes: auditLog.data       ?? [],
  }

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="poupaup-dados-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  })
}
