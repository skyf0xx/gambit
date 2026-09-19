import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../..');
const rootPkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const appPkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8'));

// Origins the built app may talk to. Add self-hosted proxy origins at build
// time: VITE_EXTRA_CONNECT_SRC="https://proxy.example.com https://x.example"
export const BASE_CONNECT_SRC = [
  'https://api.anthropic.com',
  'https://api.openai.com',
  'https://openrouter.ai',
  'https://registry.npmjs.org',
];
const extra = (process.env.VITE_EXTRA_CONNECT_SRC ?? '').split(/\s+/).filter(Boolean);
const connectSrc = [...BASE_CONNECT_SRC, ...extra];

const csp = (frameAncestors = false) =>
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
// meta tag plus a `_headers` file for Cloudflare Pages / Netlify.
function cspPlugin(): Plugin {
  return {
    name: 'gambit-csp',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: csp() }, injectTo: 'head-prepend' },
    ],
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: '_headers',
        source: `/*\n  Content-Security-Policy: ${csp(true)}\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n`,
      });
      // Vendored BMAD material ships with its attribution and license.
      for (const f of ['ATTRIBUTION.md', 'LICENSE']) {
        this.emitFile({
          type: 'asset',
          fileName: `licenses/BMAD/${f}`,
          source: readFileSync(resolve(root, 'vendor-skills/BMAD', f), 'utf8'),
        });
      }
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    cspPlugin(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Gambit',
        short_name: 'Gambit',
        description: 'Local-first strategy and planning with your own model key.',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: { navigateFallback: '/index.html', globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'] },
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(appPkg.version),
    __PACK_VERSION__: JSON.stringify(rootPkg.version),
    __PACK_NAME__: JSON.stringify(rootPkg.name),
    __CONNECT_SRC__: JSON.stringify(connectSrc),
  },
  server: { fs: { allow: [root] } },
  test: { environment: 'node', include: ['test/**/*.test.ts'] },
});
