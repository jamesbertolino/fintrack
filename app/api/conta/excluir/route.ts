import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function DELETE() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 1. Busca dados do usuário antes de deletar
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('evolution_instancia, grupo_id_principal')
    .eq('id', user.id)
    .single()

  // 2. Deleta instância Evolution se existir
  if (profile?.evolution_instancia) {
    await fetch(
      `${process.env.EVOLUTION_URL}/instance/delete/${profile.evolution_instancia}`,
      {
        method: 'DELETE',
        headers: { 'apikey': process.env.EVOLUTION_API_KEY! },
      }
    )
  }

  // 3. Encerra grupo se for admin
  if (profile?.grupo_id_principal) {
    await supabaseAdmin.from('grupos')
      .update({ ativo: false })
      .eq('id', profile.grupo_id_principal)
      .eq('criado_por', user.id)

    await supabaseAdmin.from('grupo_membros')
      .update({ status: 'removido' })
      .eq('grupo_id', profile.grupo_id_principal)
  }

  // 4. Remove avatar do storage
  await supabaseAdmin.storage
    .from('avatares')
    .remove([`${user.id}/avatar.jpg`])

  // 5. Deleta o usuário (cascade deleta profiles, transactions, etc)
  await supabaseAdmin.auth.admin.deleteUser(user.id)

  return NextResponse.json({ ok: true })
}
