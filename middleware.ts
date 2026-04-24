import { NextRequest, NextResponse } from 'next/server'
import { createMiddlewareClient } from '@/lib/supabase-middleware'

const ROTAS_PUBLICAS = ['/login', '/cadastro', '/', '/sobre', '/precos', '/convite', '/setup']

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request })
  const supabase = createMiddlewareClient(request, response)

  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isPublic = ROTAS_PUBLICAS.some(r => pathname.startsWith(r))
  const isApi    = pathname.startsWith('/api')
  const isSetup  = pathname.startsWith('/setup')

  // Usuário não autenticado → login
  if (!user && !isPublic && !isApi && !isSetup) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // Usuário autenticado na tela de login → dashboard
  if (user && pathname === '/login') {
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

    console.log('[middleware] user:', user?.id)
    console.log('[middleware] profile:', JSON.stringify(profile))
    console.log('[middleware] pathname:', pathname)
    console.log('[middleware] precisaSetup:', precisaSetup)

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
