import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serverar projektsidor under /<repo>/. Workflowen sätter VITE_BASE.
const base = process.env.VITE_BASE ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png', 'icons/favicon.svg'],
      manifest: {
        name: 'Receptappen',
        short_name: 'Recept',
        lang: 'sv',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#f5ead8',
        theme_color: '#f5ead8',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: 'index.html',
        // Textläsningens stora filer förladdas inte, utan sparas första gången de används.
        globIgnores: ['**/tesseract/**'],
        runtimeCaching: [{
          urlPattern: ({ url }) => url.pathname.includes('/tesseract/'),
          handler: 'CacheFirst',
          options: { cacheName: 'tesseract', expiration: { maxEntries: 10 } },
        }],
        // Supabase-anrop ska aldrig cachas av service workern.
        navigateFallbackDenylist: [/^\/auth/, /^\/rest/, /^\/functions/],
      },
    }),
  ],
});
