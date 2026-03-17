import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Archivos estáticos extra que querés cachear sí o sí
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'Logística PWA',
        short_name: 'Logística',
        description: 'Portal de seguimiento offline',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone', // Hace que se abra como app nativa sin barra de navegador
        icons: [
          {
            src: '/pwa-192x192.png', // Ojo: vas a tener que crear estos íconos en la carpeta public/
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        // Le indicamos a Workbox que cachee todo el código fuente y los assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
        // Al ser una SPA (Single Page App) en React, cualquier ruta debe devolver el index.html
        navigateFallback: '/index.html',
        // Limpiamos cachés viejos automáticamente
        cleanupOutdatedCaches: true
      }
    })
  ],
  server: {
    allowedHosts: ['all'],
  },
});