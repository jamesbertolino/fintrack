import type { Metadata } from 'next'
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

export const metadata: Metadata = {
  title: 'PoupaUp — Poupe. Evolua. Conquiste.',
  description: 'Controle financeiro familiar com IA e WhatsApp',
  manifest: '/manifest.json',
  icons: {
    icon: '/logo.png',
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
        {/* Aplica o tema antes do render para evitar flash */}
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            var t = localStorage.getItem('poupaup_tema');
            if (t) document.documentElement.setAttribute('data-tema', t);
          } catch(e) {}
        ` }} />
      </head>
      <body className={`${cinzel.variable} ${crimsonText.variable}`} style={{ margin: 0, padding: 0 }}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
