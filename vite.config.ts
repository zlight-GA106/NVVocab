import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'NVVocab-非易失性词库',
        short_name: 'NVVocab',
        theme_color: 'rgb(var(--m3-background))',
        background_color: 'rgb(var(--m3-surface))',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: '/bwolf.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/bwolf.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,webp,woff,woff2,ttf,ico}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/rest/v1'),
            handler: 'NetworkOnly',
            options: {
              cacheName: 'word-jiffy-supabase-rest',
            },
          },
          {
            urlPattern: ({ request }) =>
              ['script', 'style', 'image', 'font', 'document'].includes(request.destination),
            handler: 'CacheFirst',
            options: {
              cacheName: 'word-jiffy-local-assets',
              expiration: {
                maxAgeSeconds: 60 * 60 * 24 * 30,
                maxEntries: 160,
              },
            },
          },
        ],
      },
    }),
  ],
});
