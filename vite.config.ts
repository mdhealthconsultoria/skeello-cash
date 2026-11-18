import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/skeello-cash/' : '/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icone-esquilo-180.png', 'icone-esquilo-192.png', 'icone-esquilo-512.png', 'icone-esquilo-maskable-512.png'],
      manifest: {
        name: 'Skeello Cash',
        short_name: 'Skeello Cash',
        description: 'Seu dinheiro. Sob controle.',
        theme_color: '#111111',
        background_color: '#0a0a0a',
        display: 'standalone',
        start_url: mode === 'production' ? '/skeello-cash/' : '/',
        scope: mode === 'production' ? '/skeello-cash/' : '/',
        icons: [
          { src: 'icone-esquilo-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icone-esquilo-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icone-esquilo-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
}))
