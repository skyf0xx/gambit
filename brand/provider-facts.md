# Provider facts — signup, key flow, in-browser auth, cost

Checked 2026-09-30.

## Summary table

| | Anthropic | OpenAI | OpenRouter |
|---|---|---|---|
| Signup | Email/Google/SSO, no card to register | Email + **phone verification** required | Email or GitHub, no card |
| Free tier / credits | No standing free tier; some accounts see small trial credit, terms vary | No reliable free trial credit as of 2026 (auto-credit program ended); phone-gated when offered | **$1 free credit** on signup; free-tagged models exist separately |
| Minimum to use paid API | **$5** minimum deposit (Tier 1) | Card + usage-based, no fixed deposit minimum published | **No minimum**; $5 unlocks higher day rate-limit tier, $10+ unlocks 1,000 req/day |
| Key shown once? | Yes — shown once at creation (`sk-ant-...`) | Yes — shown once at creation | Yes — shown once at creation (`sk-or-v1-...`) |
| In-browser OAuth key issuance (no copy-paste) | **No** — no third-party OAuth program; explicitly banned for subscription auth (Feb 2026 policy) | **No** for API keys — "Sign in with ChatGPT" is identity/subscription-allowance passthrough for a few named partners, not a general API-key OAuth flow | **Yes** — documented OAuth PKCE flow returns a user-controlled API key directly to a static SPA |
| Default model in `skills.ts` | `claude-sonnet-5` | `gpt-4.1` | `anthropic/claude-sonnet-4.5` |
| cost.ts price-table accuracy | Sonnet row ($3/$15) matches **legacy** Sonnet 4.5, not current Sonnet 5 ($2/$10); Opus/Haiku rows match current list prices | gpt-4.1 row matches current list price; no gpt-4.1-mini caching row implication issue | N/A (no OpenRouter-specific row; falls through to Anthropic-style regex matches for OpenRouter model strings) |

Sources: [Anthropic Console billing](https://platform.claude.com/settings/billing), [Claude pricing](https://claude.com/pricing), [OpenAI pricing](https://developers.openai.com/api/docs/pricing), [OpenRouter pricing](https://openrouter.ai/pricing), [OpenRouter OAuth PKCE docs](https://openrouter.ai/docs/guides/overview/auth/oauth).

---

## Anthropic (console.anthropic.com → now platform.claude.com)

Note: `console.anthropic.com` 301-redirects to `platform.claude.com` as of this check — same product, new host.

1. Sign up at platform.claude.com with Google, email, or SSO; agree to Commercial Terms, Usage Policy, Privacy Policy.
2. Go to Settings → Plans & Billing, add a payment method, deposit **$5 minimum** to activate Tier 1 usage.
3. Go to API Keys → Create Key → key is displayed **once**, format `sk-ant-...`. Must be copied immediately; not retrievable again.
4. No standing free tier for the API; occasional/variable small trial credits have been reported but are not guaranteed or documented as policy — treat as unverified per-account promo, not a baseline.
5. No phone or ID verification observed in the documented flow (unlike OpenAI).

Sources: [Anthropic Console billing/signup](https://platform.claude.com/settings/billing) (redirected from console.anthropic.com), [How to get an Anthropic API key](https://www.getmaxim.ai/bifrost/guides/api-keys/how-to-get-an-anthropic-api-key), [Free Anthropic API key claims — unverified](https://www.linkmodel.ai/blog/free-anthropic-api-key).

## OpenAI (platform.openai.com)

1. Sign up with email; account creation requires **phone number verification** before API key creation is unlocked.
2. Add a payment method (usage-based billing; no fixed minimum deposit found in current docs — pay-as-you-go with usage caps you set).
3. Historically OpenAI gave new accounts ~$5 in trial credit; as of 2026 this auto-credit program has reportedly ended for most signups (community reports conflict; some say a small trial credit still appears, others say none) — treat as **not reliable**.
4. Create key under API Keys → shown **once** at creation; must be saved immediately.
5. "Sign in with ChatGPT" (announced 2026) lets a handful of named partners (Airtable, GitLab, HubSpot, Notion, Supabase, Vercel, and coding tools like Amp/Devin/Lovable) let a ChatGPT Plus/Pro subscriber's plan allowance authenticate inside that partner's product — this is an **identity/subscription-passthrough OAuth for named partners**, not a general-purpose "get an API key via OAuth" flow available to any developer/PWA. It does not fit Gambit's bring-your-own-key model without an approved partnership.

Sources: [OpenAI API keys community discussion](https://community.openai.com/t/openai-api-keys-in-free-account/348972), [OpenAI free trial credits discussion](https://community.openai.com/t/how-can-i-get-free-trial-credits/26742), [Sign in with ChatGPT — help center](https://help.openai.com/en/articles/20001410-sign-in-with-chatgpt), [The New Stack coverage](https://thenewstack.io/sign-in-with-chatgpt/).

## OpenRouter (openrouter.ai)

1. Sign up at openrouter.ai/keys with email or GitHub — **no card required**.
2. New accounts get **$1 free credit** (roughly 300–500 gpt-4o-mini-class queries). No minimum purchase to use the API at all.
3. Purchasing **$10+** lifetime raises the daily unauthenticated/low-tier rate limit from 50 req/day to 1,000 req/day; $5 is cited elsewhere as the practical top-up minimum via the billing UI, but $0 use is possible on the free-credit/free-model tier.
4. Create key under Keys tab → shown **once**, format `sk-or-v1-...`.
5. Free-tagged models (`:free` suffix) exist separately from the $1 signup credit and can be used at $0 ongoing, subject to low rate limits.

Sources: [OpenRouter pricing](https://openrouter.ai/pricing), [OpenRouter guide — top-up & usage](https://codepick.dev/en/guides/openrouter-guide/), [OpenRouter free models list](https://costgoat.com/pricing/openrouter-free-models).

---

## Google AI Studio / Gemini API (aistudio.google.com/api-keys): the chosen default

Not yet a provider in `providers.ts`. Checked 2026-09-30 against the live API with a throwaway free-tier key.

**Getting a key**
- Sign in with a Google account, accept the terms, and AI Studio creates a Cloud project and an API key automatically ([API key docs](https://ai.google.dev/gemini-api/docs/api-key), updated 2026-09-25).
- The free tier needs no billing account.
- **Moving to the paid tier (Tier 1) needs a credit card and a $5 minimum prepayment.** New accounts are prepay by default. You click **Set up billing** next to the project on the AI Studio API keys page and follow the dialog. The upgrade usually shows within 10 minutes. You can set a monthly spending cap per project on the [Spend page](https://aistudio.google.com/spend), and Tier 1 is capped at $250 a month per billing account. Google Cloud's $300 welcome credit doesn't apply to the Gemini API for accounts created after 2 March 2026 ([billing](https://ai.google.dev/gemini-api/docs/billing), updated 2026-09-28).
- Keys issued today use the `AQ.…` format, not the older `AIza…`.
- Unverified: whether a key can be copied again later, and the exact free-tier limits. The docs point to the AI Studio dashboard for per-model limits.
- You must be 18 or older ([terms](https://ai.google.dev/gemini-api/terms)).

**Data use: this conflicts with the brand's privacy promise**
- On the **free tier**, Google "uses the content you submit to the Services and any generated responses to provide, improve, and develop Google products", and "human reviewers may read, annotate, and process your API input and output". Content is disconnected from the account before review ([terms](https://ai.google.dev/gemini-api/terms), updated 2026-04-28; [pricing](https://ai.google.dev/gemini-api/docs/pricing) shows "Content used to improve our products: Yes" for free).
- On the **paid tier**, content is not used to improve products and is logged only briefly, for abuse detection.
- In the **EEA, UK and Switzerland**, the paid-tier data terms apply to all use, including the free tier. The terms also say only paid services may be used "when making API Clients available to users" there. How that applies to a bring-your-own-key client, where the user holds the key, is unclear.

**Browser access and CSP**
- CORS works. A preflight from a foreign origin to both `/v1beta/openai/chat/completions` and native `:streamGenerateContent` returns 200, echoes the origin, and allows `authorization`, `content-type` and `x-goog-api-key`.
- `https://generativelanguage.googleapis.com` is **not** in `connect-src` today. It has to be added to both `vercel.json` and the build-emitted CSP, which a test keeps in sync.
- Google's docs warn against putting keys in client-side apps. That warning is aimed at developers shipping their own key. Here the key belongs to the user and never leaves their device, which is the same model Gambit already uses for Anthropic and OpenAI.

**Behaviour observed with the test key**
- The OpenAI-compatible model list includes `gemini-3.8-flash` (Google's recommended fast model), `gemini-3.5-flash`, `gemini-3.5-flash-lite`, `gemini-flash-latest`, the 2.5 series and previews.
- `gemini-3.8-flash` returned **503 "This model is currently experiencing high demand"** on 3 of 3 attempts on the free key.
- Response times: `gemini-3.5-flash` 27 s, `gemini-flash-latest` 5.7 s, `gemini-3.5-flash-lite` 1.1 s, each for a single short tool call.
- **Tool calls carry a `thought_signature`, and it must be sent back.** A second turn that returns a tool result without it fails with `400 INVALID_ARGUMENT` ("Function call is missing a thought_signature"), on both `gemini-3.5-flash-lite` and `gemini-flash-latest`. Gambit's generic OpenAI-compatible path (`createOpenAICompatible`) does not keep this field, so Gemini needs a provider path that stores and replays signatures, including in the chat history saved to IndexedDB ([thought signatures](https://ai.google.dev/gemini-api/docs/thought-signatures)).

**Price per 1M tokens, paid tier** ([pricing](https://ai.google.dev/gemini-api/docs/pricing), updated 2026-09-24)

| Model | Input | Output | Cached input |
|---|---|---|---|
| Gemini 3.8 Flash | $0.75 until 31 Dec 2026, then $1.50 | $3.75, then $7.50 | $0.075, then $0.15 |
| Gemini 3.5 Flash-Lite | $0.30 | $2.50 | $0.03 |
| Gemini 3.1 Flash-Lite | $0.25 | $1.50 | $0.025 |

The free tier costs $0, with rate limits. At Gemini 3.8 Flash paid prices, the 15-turn session modelled below comes to about **$0.05–0.07**, roughly a third to a half of the Sonnet 5 estimate.

## In-browser key issuance without copy-paste

### OpenRouter OAuth PKCE — verified concretely against our CSP

Flow (per [OpenRouter OAuth docs](https://openrouter.ai/docs/guides/overview/auth/oauth)):

1. Redirect the browser to `https://openrouter.ai/auth?callback_url=<origin>&code_challenge=<S256 hash>&code_challenge_method=S256`.
2. User authorizes; OpenRouter redirects back to `callback_url` with a `code` query param.
3. The app `POST`s to `https://openrouter.ai/api/v1/auth/keys` with `{ code, code_verifier, code_challenge_method }`; response is `{ key }` — a user-controlled API key, no copy-paste.

**Callback URL constraint:** localhost is explicitly supported "on any port" per the docs — good for local dev, but a localhost callback app "won't appear in the marketplace" (cosmetic restriction only, not a functional block). No allow-list of production origins was found in the docs; the callback is passed as a query param at redirect time, not pre-registered.

**Is the exchange endpoint in our connect-src?** Yes — `https://openrouter.ai` is already in both `vercel.json`'s CSP header and `apps/pwa/vite.config.ts`'s `BASE_CONNECT_SRC`. `https://openrouter.ai/api/v1/auth/keys` is a path under that already-allowed origin, so **no CSP change would be needed** to call the exchange endpoint from Gambit's production build. The `/auth` authorization page itself is a top-level navigation (not fetched via `connect-src`), so it isn't CSP-relevant either.

**CORS check (verified live via curl, 2026-09-30):**

```
curl -s -i -X OPTIONS "https://openrouter.ai/api/v1/auth/keys" \
  -H "Origin: https://gambit-app.vercel.app" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type"
```

Response: `HTTP/2 204`, `access-control-allow-origin: *`, `access-control-allow-methods: GET,OPTIONS,PATCH,DELETE,POST,PUT`, `access-control-allow-headers` includes `Content-Type`. **OpenRouter does send permissive CORS headers (wildcard origin) on this endpoint** — a static PWA with no backend can call it directly from the browser.

**Conclusion: this flow is technically viable for Gambit as-is** — no CSP change, no backend proxy needed, works from any static origin including localhost during dev. The `/auth` step is a full-page redirect (fine under `frame-ancestors 'none'` since it's not framed), and the callback lands back on Gambit's own origin with a `code` param that the app then exchanges client-side.

### Anthropic / OpenAI equivalents in 2026 — verified, neither exists for this use case

- **Anthropic:** confirmed no OAuth program for third-party apps to obtain API keys or bill through a user's Claude plan. A Feb 19, 2026 policy update explicitly **bans** using Claude.ai/Claude Code OAuth tokens in third-party tools; enforcement (blocking Max-plan OAuth in third-party clients) began Jan 9, 2026. Third-party integrations must use API keys with usage-based billing. No general "Sign in with Claude" exists for getting an API key without copy-paste.
- **OpenAI:** "Sign in with ChatGPT" exists but is scoped to a small named-partner list (Airtable, GitLab, HubSpot, Notion, Supabase, Vercel, plus coding tools like Codex/Amp/Devin) and passes through **subscription allowance**, not a general API key — and Gambit is not a listed partner. No general-purpose "get an API key via OAuth" exists for OpenAI as of this check.

Sources: [OpenRouter OAuth PKCE](https://openrouter.ai/docs/guides/overview/auth/oauth), [OpenRouter exchange endpoint reference](https://openrouter.ai/docs/api/api-reference/oauth/exchange-authorization-code-for-api-key), curl output above (verified live), [Anthropic third-party OAuth ban coverage](https://winbuzzer.com/2026/02/19/anthropic-bans-claude-subscription-oauth-in-third-party-apps-xcxwbn/), [Sign in with ChatGPT help center](https://help.openai.com/en/articles/20001410-sign-in-with-chatgpt).

---

## Cost

### Method

Measured real character counts of the bundled skill files with `wc -c`, then divided by ~3.8 chars/token (the standard rough English-text ratio). Did not run the actual bundler; approximated by reading `skills.ts`'s literal template strings (`PREAMBLE`, `SECTION_SHAPES`) directly plus `skills/_shared/GUIDED.md` and the generated skill index text (name + description per skill).

### What's sent every turn vs. on demand

Per `apps/pwa/src/lib/skills.ts` and `agent.ts`: **only** the fixed `PREAMBLE` (which inlines `SECTION_SHAPES` and `GUIDED.md`) plus the **skill index** (name + one-line description for all 20 skills, not full bodies) is sent as the "stable" system-prompt block on every turn. A **full `SKILL.md` body is loaded on demand** via the `load_skill(name)` tool call and then held in a second system-prompt block (`skillBlock`) only while that skill is active — it is not concatenated with all other skills. The full 20-skill catalogue (~162,000 chars / ~42,600 tokens) is **never** sent in one shot; the largest single skill (`plan/SKILL.md`, 17,906 chars ≈ 4,712 tokens) is the practical per-turn ceiling for the skill portion.

Baseline "stable" block, measured:

| Component | Chars | ≈Tokens |
|---|---|---|
| PREAMBLE literal prose (excl. substituted content) | 1,846 | 486 |
| SECTION_SHAPES (schema caps) | 1,856 | 489 |
| GUIDED.md (guided-session rules) | 6,743 | 1,774 |
| Skill index (20 name+description lines) | 6,856 | 1,804 |
| **Total stable/system block** | **17,301** | **~4,553** |

Plus, once a skill is loaded: + one `SKILL.md` body, 2,074–17,906 chars (~550–4,712 tokens); average ~7,905 chars (~2,080 tokens) across the 18 catalogue skills (excludes the two PWA-native skills `intake`/`elicit`, 4,469 and 3,018 chars respectively, and the 14,854-char `methods.csv` that `elicit` also references separately).

Anthropic-only prompt caching (`agent.ts` line 17, `CACHE = { anthropic: { cacheControl: { type: 'ephemeral' } } }`) is applied to **both** the stable system block and the active-skill block when the provider is Anthropic — confirmed in code (`agent.ts` lines 86–88). OpenAI and OpenRouter get no explicit caching directive from this code; OpenAI's own API applies automatic caching server-side for prompts ≥1024 tokens at no code cost (verified against OpenAI's caching docs), OpenRouter's caching behavior is model/upstream-dependent and not verified here.

### Price table vs. current list prices

`cost.ts`'s `TABLE` (checked 2026-09-30):

| Row (regex) | cost.ts price (in/out per MTok) | Current list price | Match? |
|---|---|---|---|
| `/opus/i` | $15 / $75 | Opus 4.6–4.8: $5 / $25 (per [claude.com/pricing](https://claude.com/pricing)) | **Mismatch — cost.ts is 3x too high** for current Opus |
| `/sonnet/i` | $3 / $15 | Sonnet 4.5 (legacy): $3/$15 — matches. Sonnet 5 (current default in `providers.ts`, `claude-sonnet-5`): $2/$10 | **Mismatch for the actual default model** — cost.ts undercounts savings, i.e. overestimates cost for `claude-sonnet-5` |
| `/haiku/i` | $1 / $5 | Haiku 4.5: $1/$5 | Match |
| `/gpt-4\.1-mini/i` | $0.4 / $1.6 | $0.40/$1.60 (verified) | Match |
| `/gpt-4\.1/i` | $2 / $8 | $2.00/$8.00 (verified) | Match |

Anthropic caching discount used elsewhere: `costOf()` in `cost.ts` applies a flat `p.in * 0.1` for cached tokens (i.e., assumes cache-hit reads cost 10% of input price) — this matches Anthropic's actual cache-read discount ratio closely (e.g. Sonnet 5: $0.20 read vs $2 input = 10%) but doesn't separately price cache **writes** (Anthropic charges a premium, e.g. $2.50/MTok write for Sonnet 5, ~125% of input price) — `cost.ts` has no write-tier line, so a session's first cache-writing turn is under-costed.

Sources: [Claude pricing](https://claude.com/pricing), [OpenAI pricing](https://developers.openai.com/api/docs/pricing).

### Worked estimates

Assumptions: 15-turn session, growing history (trimmed at an 80,000-char budget per `agent.ts` `HISTORY_CHAR_BUDGET`), one skill loaded per turn on average (skill body re-sent as a fresh system block turn-to-turn since it isn't chat history — it's a system message, so it does **not** benefit from history trim but the code doesn't show cache being reused for the skill block beyond the ephemeral 5-minute TTL Anthropic applies). Assume: stable block ~4,553 tokens (cached after turn 1 on Anthropic), skill block ~2,080 tokens average (also cacheable turn-to-turn if the same skill stays active, which `GUIDED.md`'s multi-turn session design makes likely), growing history averaging ~2,000 tokens/turn by mid-session, output averaging ~400 tokens/turn.

**Claude Sonnet 5 (`claude-sonnet-5`, actual default), using real $2/$10, cache read $0.20:**
- Turn 1 (cache write): (4,553+2,080) input tokens × $2/M + write premium ≈ $0.013 + history ≈ negligible → **~$0.013–0.02**
- Turns 2–15 (cache hit on stable+skill blocks): ~6,633 cached tokens × $0.20/M ≈ $0.0013, plus ~2,000 fresh history tokens × $2/M ≈ $0.004, plus 400 output × $10/M ≈ $0.004 → **~$0.009/turn**
- 15-turn session ≈ $0.02 + 14×$0.009 ≈ **~$0.15/session**
- Light use (4 sessions/mo) ≈ **~$0.60/mo**; heavy use (20 sessions/mo) ≈ **~$3.00/mo**

**Claude Haiku 4.5 (cheap option), $1/$5, cache read $0.10:**
- Same shape, roughly half the per-token cost of Sonnet on input/output → **~$0.08/session**, **~$0.30/mo light**, **~$1.50/mo heavy**

**OpenAI gpt-4.1 (default), $2/$8, no explicit caching code (relying on OpenAI's automatic ≥1024-token caching, ~50% discount when it applies):**
- No ephemeral cache control set in Gambit's code for this provider, but OpenAI applies its own automatic prompt caching server-side, so real cost likely lands between "no cache" and "cache" estimates.
- Without caching: turn 1 ≈ 6,633 in × $2/M + 400 out × $8/M ≈ $0.016; later turns ≈ (6,633+~2,000) in × $2/M + 400×$8/M ≈ $0.020 → 15 turns ≈ **~$0.28/session**
- With OpenAI's automatic caching on the repeated ~6,633-token prefix (~50% off that portion): ≈ **~$0.20/session**
- Light use ≈ **~$0.80–1.10/mo**; heavy use ≈ **~$4.00–5.60/mo**

**gpt-4.1-mini (cheap option), $0.40/$1.60:**
- Same shape at ~1/5th the price → **~$0.04–0.06/session**, **~$0.16–0.22/mo light**, **~$0.80–1.10/mo heavy**

**OpenRouter, `anthropic/claude-sonnet-4.5` (current default in `providers.ts`), $3/$15 (legacy Sonnet 4.5 pricing carried through OpenRouter) — no caching directive from Gambit's code, and OpenRouter caching support is upstream-model-dependent (not verified here):**
- Without caching, full stable+skill+growing history resent each turn: turn ≈ 6,633+2,000 in × $3/M + 400 out × $15/M ≈ $0.032/turn → 15 turns ≈ **~$0.48/session**
- Light use ≈ **~$1.90/mo**; heavy use ≈ **~$9.60/mo**

**OpenRouter free-tagged model (cheap option, $0 list price, subject to low rate limits):** **~$0/session** but capacity-constrained (20 req/min, 50–1,000 req/day depending on lifetime spend) — not a reliable substitute for a real session, only for light/testing use.

These are order-of-magnitude estimates from a rough architecture read, not a token-exact trace of a live run.

---

## Facts that would change the core UX

- **Google AI Studio is the default, and its free tier isn't private.** Outside the EEA, UK and Switzerland, free-tier prompts may be used for training and read by human reviewers. The line "Private by construction… data stays on the device" is true of Gambit's storage but not of what the provider does with each turn. Either the product copy changes, or the key setup steers people to link billing, which costs a $5 prepayment by card, and get paid-tier terms.
- **Gemini needs its own provider path.** Thought signatures must be stored and replayed, or the second tool turn fails with a 400. Using the generic OpenAI-compatible path is not enough.
- **Free-tier capacity is uneven.** The recommended model returned 503s on every attempt during testing, so the default model and the error copy for "provider busy" both matter from day one.

- **OpenRouter OAuth PKCE is genuinely viable today** — verified CORS wildcard, verified endpoint already inside the CSP `connect-src`, verified localhost works. This could let the OpenRouter path skip the "paste your key" step entirely and replace it with a "Continue with OpenRouter" button — a real UX simplification for at least one of the three providers, without any CSP change.
- **Anthropic and OpenAI have no equivalent** in 2026 — Anthropic actively polices against subscription-OAuth passthrough, and OpenAI's "Sign in with ChatGPT" is a closed partner list Gambit isn't on. The three providers can't be treated uniformly for onboarding; only OpenRouter gets the no-copy-paste path.
- **cost.ts's Opus row is 3x too high and its Sonnet row doesn't match the actual default model** (`claude-sonnet-5`) — anyone using the in-app cost estimator with defaults is seeing meaningfully wrong numbers for the two most likely-used paid tiers; worth fixing the table regardless of UI decisions.
- **Session cost across all provider/model combos checked lands well under $0.50/session and under ~$10/month even at heavy use** — cost is not high enough on its own to demand a persistent cost meter in the main chat UI; the existing Settings-level display (`sessionCost`/`fmtUsd` in `cost.ts`) is probably sufficient, though OpenRouter's uncached default (~$0.48/session, ~$9.60/mo heavy) is the one combination worth flagging to a user choosing that path over Anthropic direct.
- **The skill catalogue is never sent in full** — the "40k+ token catalogue" fear doesn't apply; the real per-turn ceiling is one skill body (≤4,712 tokens for the largest, `plan`) plus the ~4,553-token stable block, both cacheable on Anthropic. This means growing chat history, not skill bundling, is the dominant long-session cost driver — worth confirming `HISTORY_CHAR_BUDGET` (80,000 chars ≈ ~21,000 tokens) is tuned deliberately, since it, not the skills, sets the cost ceiling for a long-running goal.
