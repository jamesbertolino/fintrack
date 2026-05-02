import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { calcularXP, calcularNivel } from '@/lib/calcularXP'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    // Busca o grupo do usuário
    const { data: membro } = await supabase
      .from('grupo_membros')
      .select('grupo_id')
      .eq('user_id', user.id)
      .eq('status', 'ativo')
      .single()

    if (!membro) return NextResponse.json({ ranking: [] })

    // Busca todos os membros ativos do grupo
    const { data: membros } = await supabase
      .from('grupo_membros')
      .select('user_id')
      .eq('grupo_id', membro.grupo_id)
      .eq('status', 'ativo')

    if (!membros || membros.length === 0) return NextResponse.json({ ranking: [] })

    const ids = membros.map(m => m.user_id)

    // Busca perfis
    const { data: perfis } = await supabase
      .from('profiles')
      .select('id, nome, avatar_url')
      .in('id', ids)

    // Busca transações e metas de todos os membros
    const [{ data: todasTx }, { data: todasMetas }] = await Promise.all([
      supabase.from('transactions').select('user_id, valor, tipo').in('user_id', ids),
      supabase.from('goals').select('user_id, valor_total, valor_atual, ativo').in('user_id', ids),
    ])

    const ranking = ids.map(uid => {
      const perfil   = perfis?.find(p => p.id === uid)
      const txUser   = (todasTx   || []).filter(t => t.user_id === uid)
      const metasUser = (todasMetas || []).filter(m => m.user_id === uid)

      const { xpTotal } = calcularXP({ transacoes: txUser, metas: metasUser })
      const nivel = calcularNivel(xpTotal)

      return {
        nome:      perfil?.nome || 'Usuário',
        avatar_url: perfil?.avatar_url || null,
        xp:        xpTotal,
        nivel:     nivel.nivel,
        nomeNivel: nivel.nome,
        cor:       nivel.cor,
      }
    }).sort((a, b) => b.xp - a.xp)

    return NextResponse.json({ ranking })
  } catch (err) {
    console.error('[grupo/ranking]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
