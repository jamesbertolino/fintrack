import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PoupaUp',
    short_name: 'PoupaUp',
    description: 'Controle financeiro familiar com IA e WhatsApp',
    start_url: 'https://www.poupaup.com.br/dashboard',
    scope: 'https://www.poupaup.com.br/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#071a07',
    theme_color: '#16a34a',
    lang: 'pt-BR',
    categories: ['finance', 'productivity'],
    share_target: {
      action: '/api/share-target',
      method: 'POST',
      enctype: 'multipart/form-data',
      params: {
        files: [
          {
            name: 'arquivo',
            accept: ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'text/csv', '.ofx', '.ofc'],
          },
        ],
      },
    },
    icons: [
      {
        src: 'https://www.poupaup.com.br/launchericon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: 'https://www.poupaup.com.br/launchericon-512x512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
