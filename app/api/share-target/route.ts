import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// Recebe arquivo compartilhado pelo Android (Web Share Target API)
// Salva temporariamente no Supabase Storage e redireciona para /dashboard/lancamento?share=<path>
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.redirect(new URL('/dashboard/lancamento', request.url))
  }

  const arquivo = formData.get('arquivo') as File | null
  if (!arquivo || arquivo.size === 0) {
    return NextResponse.redirect(new URL('/dashboard/lancamento', request.url))
  }

  if (arquivo.size > 15 * 1024 * 1024) {
    return NextResponse.redirect(new URL('/dashboard/lancamento?share_erro=tamanho', request.url))
  }

  const ext  = arquivo.name.split('.').pop()?.toLowerCase() || 'bin'
  const path = `share-temp/${user.id}/${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from('uploads')
    .upload(path, await arquivo.arrayBuffer(), {
      contentType: arquivo.type || 'application/octet-stream',
      upsert: true,
    })

  if (error) {
    return NextResponse.redirect(new URL('/dashboard/lancamento?share_erro=upload', request.url))
  }

  const encoded = encodeURIComponent(path)
  return NextResponse.redirect(
    new URL(`/dashboard/lancamento?share=${encoded}`, request.url)
  )
}
