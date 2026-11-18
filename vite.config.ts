import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';
import {injectTrackingIntoDocument} from './src/lib/gtm-injection';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
        manifest: {
          id: '/',
          name: 'Shuddho — Pure Bangladeshi Natural Foods',
          short_name: 'Shuddho',
          description: 'Lab-tested Bangladeshi honey, deshi ghee, cold-pressed oils, dates, nuts, and spices.',
          theme_color: '#0E5E6F',
          background_color: '#EEF5F5',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,ico,png,svg,jpg,webp,woff,woff2}'],
          navigateFallback: null,
          runtimeCaching: [
            {
              urlPattern: ({ request, url }) =>
                request.mode === 'navigate' &&
                !url.pathname.startsWith('/api/') &&
                !url.pathname.startsWith('/admin'),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'storefront-html',
                networkTimeoutSeconds: 3,
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
      {
        // Vercel: bake Google Tag Manager into the static HTML at build time.
        // On Vercel, pages are served as static files (not through server.ts), and the
        // demo SQLite settings are per-instance and reset on restart, so the GTM ID saved
        // in Admin can't reliably reach visitors. Set GTM_CONTAINER_ID in the Vercel
        // project's environment variables instead; it is injected here with the same
        // markup server.ts would inject, so the storefront's client-side check keeps it.
        name: 'vercel-build-gtm',
        apply: 'build',
        transformIndexHtml(html: string): string {
          const gtmId = (process.env.GTM_CONTAINER_ID || '').trim();
          if (!process.env.VERCEL || !gtmId) return html;
          return injectTrackingIntoDocument(html, {
            gtmEnabled: true,
            gtmContainerId: gtmId,
            consentDefaultAnalytics: 'granted',
            consentDefaultAds: 'granted',
          });
        },
      },
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const srcAssets = path.resolve(__dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
