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
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Skeello Cash',
        short_name: 'Skeello Cash',
        description: 'Seu dinheiro. Sob controle.',
        theme_color: '#111111',
        background_color: '#0a0a0a',
        display: 'standalone',
        start_url: mode === 'production' ? '/skeello-cash/' : '/',
        scope: mode === 'production' ? '/skeello-cash/' : '/',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
    }),
  ],
}))
