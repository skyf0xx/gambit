# Gambit PWA

Local-first web app: chat with an agent that applies Gambit's skills, next to a live dashboard of your goal. No backend, no accounts. Goals, chats and your API key live in the browser's IndexedDB.

```bash
npm install                         # from the repo root
npm run dev -w @gambit/pwa          # dev server
npm run build -w @gambit/pwa        # static output in apps/pwa/dist
npm run typecheck -w @gambit/pwa && npm test -w @gambit/pwa
```

Deploy `apps/pwa/dist` to any static host (Cloudflare Pages, GitHub Pages). The build emits a `_headers` file carrying the same strict Content-Security-Policy as the `<meta>` tag.

## Layout

- `src/lib/` — storage (Dexie), agent loop (Vercel AI SDK), tools, providers, key encryption, update system, export/import.
- `src/components/` — chat, dashboard (driven by the shared display registry), settings.
- `skills/` — PWA-native skills (`intake`, `elicit`). Everything else comes from the repo's `skills/`, bundled at build time and updatable from npm.
- Shared logic (schema, read path, migrations, goal operations, display registry) lives in `packages/core`.

## Notes

- **Providers**: Anthropic (direct, browser-access header), OpenAI, OpenRouter, and any OpenAI-compatible endpoint. Anthropic optionally gets provider-side web search.
- **CSP and custom origins**: `connect-src` is limited to the providers above plus `registry.npmjs.org`. To allow a self-hosted proxy, build with `VITE_EXTRA_CONNECT_SRC="https://proxy.example.com"`. The Settings form refuses origins the build does not allow.
- **Skill text is the source of truth**: the preamble's "Guided, not just capable" section is sliced from the repo's `AGENTS.md` at build time (a test fails if the heading moves). Web bindings for CLI instructions live only in `src/lib/skills.ts`.
- **Skill pack updates** poll `registry.npmjs.org/@skyf0xx/gambit/latest`, gate on `gambit.appVersionMin` in the package's `package.json`, verify the tarball against `dist.integrity` (sha512), show a diff, and apply only on approval with a snapshot and rollback. Migrations are declarative rules under `gambit.migrations`.
