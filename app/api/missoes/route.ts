import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { MISSOES_DIARIAS, MISSOES_SEMANAIS, getMissao, inicioDia, inicioSemana } from '@/lib/missoes'

// GET — retorna missões do dia/semana com progresso do usuário
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const agora     = new Date()
    const diaSel    = inicioDia(agora)
    const semanaSel = inicioSemana(agora)

    // Busca progresso salvo
    const { data: progressos } = await supabase
      .from('missoes_usuario')
      .select('*')
      .eq('user_id', user.id)
      .or(`periodo.gte.${diaSel},periodo.gte.${semanaSel}`)

    // Calcula progresso real de missões diárias via transações do dia
    const { data: txHoje } = await supabase
      .from('transactions')
      .select('id, created_at')
      .eq('user_id', user.id)
      .gte('created_at', diaSel)

    const txHojeCount = txHoje?.length || 0

    // Calcula progresso de missões semanais via transações da semana
    const { data: txSemana } = await supabase
      .from('transactions')
      .select('id, created_at')
      .eq('user_id', user.id)
      .gte('created_at', semanaSel)

    const txSemanaCount = txSemana?.length || 0

    // Calcula dias únicos com transações na semana
    const diasComTx = new Set(
      (txSemana || []).map(t => new Date(t.created_at).toISOString().slice(0, 10))
    ).size

    // Metas ativas
    const { data: metasAtivas } = await supabase
      .from('goals')
      .select('id')
      .eq('user_id', user.id)
      .eq('ativo', true)

    const metasCount = metasAtivas?.length || 0

    function progresso(missaoId: string): number {
      switch (missaoId) {
        case 'dia_lancamento_3':    return Math.min(txHojeCount, 3)
        case 'dia_abrir_app':       return 1  // chegou até aqui = abriu
        case 'dia_lancamento_1':    return Math.min(txHojeCount, 1)
        case 'sem_lancamento_diario': return Math.min(diasComTx, 7)
        case 'sem_upload':          return progressos?.find(p => p.missao_id === 'sem_upload' && p.periodo >= semanaSel)?.progresso || 0
        case 'sem_10_lancamentos':  return Math.min(txSemanaCount, 10)
        case 'sem_meta_progresso':  return Math.min(metasCount, 1)
        default:                    return 0
      }
    }

    const diarias = MISSOES_DIARIAS.map(m => {
      const prog = progresso(m.id)
      return { ...m, progresso: prog, concluida: prog >= m.meta, periodo: diaSel }
    })

    const semanais = MISSOES_SEMANAIS.map(m => {
      const prog = progresso(m.id)
      return { ...m, progresso: prog, concluida: prog >= m.meta, periodo: semanaSel }
    })

    return NextResponse.json({ diarias, semanais })
  } catch (err) {
    console.error('[missoes GET]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST — registra conclusão manual de missão (ex: upload)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { missao_id } = await request.json()
    const missao = getMissao(missao_id)
    if (!missao) return NextResponse.json({ error: 'Missão não encontrada' }, { status: 400 })

    const agora  = new Date()
    const periodo = missao.tipo === 'diaria' ? inicioDia(agora) : inicioSemana(agora)

    // Upsert do progresso
    await supabase
      .from('missoes_usuario')
      .upsert({
        user_id:   user.id,
        missao_id,
        periodo,
        progresso: missao.meta,
        concluida: true,
      }, { onConflict: 'user_id,missao_id,periodo' })

    return NextResponse.json({ ok: true, xp: missao.xp })
  } catch (err) {
    console.error('[missoes POST]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
