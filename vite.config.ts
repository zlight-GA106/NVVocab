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
        name: '单词速记首航',
        short_name: '速记首航',
        theme_color: 'rgb(var(--m3-background))',
        background_color: 'rgb(var(--m3-surface))',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: '/favicon.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
          {
            src: '/favicon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable',
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
