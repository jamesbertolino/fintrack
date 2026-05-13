import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { email, permissao = 'leitura' } = await req.json()
  if (!email) return NextResponse.json({ error: 'E-mail obrigatório' }, { status: 400 })

  const { data: grupo } = await supabase
    .from('familia_grupos')
    .upsert({ dono_id: user.id }, { onConflict: 'dono_id' })
    .select()
    .single()

  if (!grupo) return NextResponse.json({ error: 'Erro ao criar grupo' }, { status: 500 })

  const { data: convite, error: convErr } = await supabase
    .from('familia_convites')
    .upsert(
      { grupo_id: grupo.id, email, permissao, aceito: false, expires_at: new Date(Date.now() + 7 * 86400_000).toISOString() },
      { onConflict: 'grupo_id,email' }
    )
    .select()
    .single()

  if (convErr) return NextResponse.json({ error: convErr.message }, { status: 500 })

  const { data: prof } = await supabase.from('profiles').select('nome').eq('id', user.id).single()
  const nomeDono = prof?.nome || 'Alguém'
  const baseUrl  = process.env.NEXT_PUBLIC_APP_URL || 'https://poupaup.com.br'
  const link     = `${baseUrl}/convite/${convite.token}?tipo=familia`

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from:    'PoupaUp <noreply@poupaup.com.br>',
      to:      email,
      subject: `${nomeDono} te convidou para o PoupaUp Família`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0a0f0a;color:#e5e7eb;border-radius:16px">
          <h2 style="color:#4ade80;margin-bottom:8px">👨‍👩‍👧 Convite Família PoupaUp</h2>
          <p style="color:#9ca3af;margin-bottom:24px">
            <strong style="color:#fff">${nomeDono}</strong> te convidou para acompanhar as finanças compartilhadas no PoupaUp com permissão de <strong style="color:#fff">${permissao === 'edicao' ? 'edição' : 'leitura'}</strong>.
          </p>
          <a href="${link}" style="display:inline-block;padding:12px 28px;background:#16a34a;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">
            Aceitar convite
          </a>
          <p style="margin-top:24px;font-size:12px;color:#6b7280">
            Link válido por 7 dias. Se você não conhece ${nomeDono}, ignore este e-mail.
          </p>
        </div>
      `,
    })
  } catch (e) {
    console.error('[familia/convite] resend error:', e)
  }

  return NextResponse.json({ ok: true, token: convite.token })
}
