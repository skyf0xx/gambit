# Gambit PWA

Local-first web app: chat with an agent that applies Gambit's skills, next to a live dashboard of your goal. No backend, no accounts. Goals, chats and your API key live in the browser's IndexedDB.

```bash
npm install       # from the repo root
npm run dev       # dev server
npm run build     # static output in apps/pwa/dist
npm run check     # core tests, typecheck, app tests, build (what CI runs)
```

Deployed on Vercel — the root `vercel.json` sets the build command, output directory, and headers.

## Layout

- `src/lib/` — storage (Dexie), agent loop (Vercel AI SDK), tools, providers, key encryption, export/import.
- `src/components/` — chat, dashboard (driven by the shared display registry), settings.
- `skills/` — PWA-native skills (`intake`, `elicit`). Everything else comes from the repo's `skills/`, bundled at build time.
- `vendor/BMAD/` — the vendored elicitation method catalog (`methods.csv`, `LICENSE`, `ATTRIBUTION.md`) that `elicit` reads.
- Shared logic (schema, read path, migrations, goal operations, display registry) lives in `packages/core`.

## Notes

- **Providers**: Anthropic (direct, browser-access header), OpenAI, OpenRouter, and any OpenAI-compatible endpoint. Anthropic optionally gets provider-side web search.
- **CSP and custom origins**: `connect-src` is limited to the providers above. To allow a self-hosted proxy, build with `VITE_EXTRA_CONNECT_SRC="https://proxy.example.com"` and update the matching CSP in the root `vercel.json`. A test checks that the two match for the default build. The Settings form refuses origins the build does not allow.
- **Skill text is the source of truth**: the preamble's guided-session rules are read from `skills/_shared/GUIDED.md`, bundled into the app at build time. The surface description (tools, dashboard, intake/elicit routing) lives in the preamble in `src/lib/skills.ts`.
- **Skills ship with the app**: there is no runtime updater. A new or changed skill goes out on the next Vercel deploy.
