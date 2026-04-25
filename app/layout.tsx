import type { Metadata } from 'next'
import { Geist } from 'next/font/google'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'PoupaUp — Poupe. Evolua. Conquiste.',
  description: 'Controle financeiro familiar com IA e WhatsApp',
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
    <html lang="pt-BR">
      <body className={geist.className} style={{ margin: 0, padding: 0 }}>
        {children}
      </body>
    </html>
  )
}
