import type { Metadata, Viewport } from 'next'
import { Cinzel, Crimson_Text } from 'next/font/google'
import { ThemeProvider } from '@/components/ThemeProvider'

const cinzel = Cinzel({
  subsets: ['latin'],
  variable: '--font-cinzel',
  weight: ['400', '600', '700', '900'],
})

const crimsonText = Crimson_Text({
  subsets: ['latin'],
  variable: '--font-crimson',
  weight: ['400', '600', '700'],
  style: ['normal', 'italic'],
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export const metadata: Metadata = {
  metadataBase: new URL('https://www.poupaup.com.br'),
  title: 'PoupaUp — Poupe. Evolua. Conquiste.',
  description: 'Controle financeiro familiar com IA e WhatsApp',
  icons: {
    icon: [
      { url: '/logo.png' },
      { url: '/launchericon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/logo.png',
  },
  openGraph: {
    title: 'PoupaUp',
    description: 'Poupe. Evolua. Conquiste.',
    images: ['/logo.png'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* Critical layout — inline so it applies before any HTML renders, zero flash */}
        <style dangerouslySetInnerHTML={{ __html: `
          html, body { overscroll-behavior: none; touch-action: pan-x pan-y; background: #071a07; }
          .mobile-nav-spacer { display: none; }

          /* Desktop: esconde nav mobile */
          @media (min-width: 768px) {
            .mobile-bottom-nav { display: none !important; }
          }

          /* Mobile: nav fixa no rodapé, conteúdo com padding para não ficar embaixo */
          @media (max-width: 767px) {
            body { font-size: 15px; }
            /* padding-bottom garante que o conteúdo não some atrás da nav fixa */
            .dashboard-content   { padding-bottom: 5rem !important; }
            .dashboard-page-body { padding-bottom: 5rem !important; }
            aside[data-tour="tour-sidebar"] { display: none !important; width: 0 !important; min-width: 0 !important; }
            .dashboard-page-root { min-height: 100vh !important; }
            .dashboard-page-root > aside { display: none !important; width: 0 !important; }
            [data-tour="tour-metricas"] { grid-template-columns: 1fr !important; }
            input, select, textarea { font-size: 16px !important; min-height: 44px; }
            .lancamento-grid { grid-template-columns: 1fr !important; }
            .lancamento-right-col { display: none !important; }
            .login-desktop-col { display: none !important; }
            .login-mobile-hero { display: flex !important; }
          }
        `}} />
        {/* Detecta mobile e aplica classe + tema antes do primeiro render */}
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            if (window.matchMedia('(max-width: 767px)').matches) document.documentElement.classList.add('is-mobile');
            var t = localStorage.getItem('poupaup_tema');
            if (t) document.documentElement.setAttribute('data-tema', t);
          } catch(e) {}
        ` }} />
        {/* Captura beforeinstallprompt antes do React montar */}
        <script dangerouslySetInnerHTML={{ __html: `
          window.__pwaPrompt = null;
          window.addEventListener('beforeinstallprompt', function(e) {
            e.preventDefault();
            window.__pwaPrompt = e;
          });
        ` }} />
        {/* Registro global do SW com auto-reload na atualização */}
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js').then(function(reg) {
                reg.addEventListener('updatefound', function() {
                  var sw = reg.installing;
                  if (!sw) return;
                  sw.addEventListener('statechange', function() {
                    if (sw.state === 'activated') window.location.reload();
                  });
                });
              });
            });
          }
        ` }} />
      </head>
      <body className={`${cinzel.variable} ${crimsonText.variable}`} style={{ margin: 0, padding: 0 }}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
