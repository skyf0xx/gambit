import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../..');
const appPkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8'));

// Origins the built app may talk to. Add self-hosted proxy origins at build
// time: VITE_EXTRA_CONNECT_SRC="https://proxy.example.com https://x.example"
// Editing this list also requires editing vercel.json's CSP header by hand —
// the test in test/vercel.test.ts only checks the two stay in sync when no
// VITE_EXTRA_CONNECT_SRC is set at build time.
export const BASE_CONNECT_SRC = [
  'https://generativelanguage.googleapis.com',
  'https://api.anthropic.com',
  'https://api.openai.com',
  'https://openrouter.ai',
];
const extra = (process.env.VITE_EXTRA_CONNECT_SRC ?? '').split(/\s+/).filter(Boolean);
const connectSrc = [...BASE_CONNECT_SRC, ...extra];

export const csp = (frameAncestors = false) =>
  [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    `connect-src 'self' ${connectSrc.join(' ')}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    ...(frameAncestors ? ["frame-ancestors 'none'"] : []),
  ].join('; ');

// Strict CSP for production builds only (dev needs HMR inline scripts), as a
// meta tag. The frame-ancestors variant is set as a response header by
// vercel.json instead, since that directive has no effect in a meta tag.
function cspPlugin(): Plugin {
  return {
    name: 'gambit-csp',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: csp() }, injectTo: 'head-prepend' },
    ],
    generateBundle() {
      // Vendored BMAD material ships with its attribution and license.
      for (const f of ['ATTRIBUTION.md', 'LICENSE']) {
        this.emitFile({
          type: 'asset',
          fileName: `licenses/BMAD/${f}`,
          source: readFileSync(resolve(__dirname, 'vendor/BMAD', f), 'utf8'),
        });
      }
    },
  };
}

// Link-preview scrapers need absolute URLs for og:image / og:url. The origin
// comes from SITE_URL (e.g. "https://gambit.example"), else Vercel's
// production domain; with neither, the image falls back to a relative path.
const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
const siteUrl = (process.env.SITE_URL ?? (vercelHost ? `https://${vercelHost}` : '')).replace(/\/+$/, '');

function ogPlugin(): Plugin {
  return {
    name: 'gambit-og',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { property: 'og:image', content: `${siteUrl}/og-image.jpg` }, injectTo: 'head' },
      { tag: 'meta', attrs: { name: 'twitter:image', content: `${siteUrl}/og-image.jpg` }, injectTo: 'head' },
      ...(siteUrl
        ? [
            { tag: 'meta', attrs: { property: 'og:url', content: `${siteUrl}/` }, injectTo: 'head' as const },
            { tag: 'link', attrs: { rel: 'canonical', href: `${siteUrl}/` }, injectTo: 'head' as const },
          ]
        : []),
    ],
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    cspPlugin(),
    ogPlugin(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'favicon-16x16.png', 'favicon-32x32.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Gambit',
        short_name: 'Gambit',
        description: 'Local-first strategy and planning with your own model key.',
        theme_color: '#F8F5EE',
        background_color: '#F8F5EE',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: { navigateFallback: '/index.html', globPatterns: ['**/*.{js,css,html,svg,png,webmanifest,woff2}'] },
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(appPkg.version),
    __CONNECT_SRC__: JSON.stringify(connectSrc),
  },
  // Font files must never be inlined as data: URIs — the CSP's img-src
  // allows data: but there is no font-src exception for it, so an inlined
  // font would be blocked at runtime. 8KB default -> 0 disables inlining.
  build: { assetsInlineLimit: 0 },
  server: { fs: { allow: [root] } },
  test: { environment: 'node', include: ['test/**/*.test.{ts,tsx}'] },
});
