import { NextRequest, NextResponse } from 'next/server'
import { createMiddlewareClient } from '@/lib/supabase-middleware'

const ROTAS_PUBLICAS = ['/login', '/cadastro', '/', '/sobre', '/precos', '/convite', '/setup', '/aceite-lgpd', '/privacidade', '/auth']

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request })
  const supabase = createMiddlewareClient(request, response)

  let user = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    // falha na rede ou token inválido → trata como não autenticado
  }

  const pathname = request.nextUrl.pathname
  const isPublic = ROTAS_PUBLICAS.some(r =>
    r === '/' ? pathname === '/' : pathname.startsWith(r)
  )
  const isApi    = pathname.startsWith('/api')
  const isSetup  = pathname.startsWith('/setup')

  // Usuário não autenticado → login
  if (!user && !isPublic && !isApi && !isSetup) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // Usuário autenticado mas email não confirmado → aviso no login
  if (user && !user.email_confirmed_at && !isPublic && !isApi) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('erro', 'email_nao_confirmado')
    return NextResponse.redirect(url)
  }

  // Usuário autenticado na tela de login → dashboard (só se email confirmado)
  if (user && user.email_confirmed_at && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // Usuário autenticado em rota protegida → verificar setup_completo
  if (user && !isSetup && !isPublic && !isApi) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('setup_completo')
      .eq('id', user.id)
      .single()

    const precisaSetup = !profile?.setup_completo

    if (precisaSetup) {
      const url = request.nextUrl.clone()
      url.pathname = '/setup'
      return NextResponse.redirect(url)
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
