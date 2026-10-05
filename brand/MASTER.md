# Gambit UX: master doc

The single entry point for the UX rethink: what Gambit is, where each decision lives, and what's left to do.

## Context

**Gambit** is a local-first PWA. You think through one hard goal with a candid AI strategist, and it keeps a written notebook of the plan: what done looks like, next moves, what could go wrong, who's involved, decisions. There's no backend and no account, usage is counted only anonymously, and the user brings their own model key.

- **Brand line:** "The notebook that thinks back." The recurring question is "What's your next move?"
- **For:** ambitious generalists aged 25–55 with one hard goal and nobody to plan it with. The personas are Rosa (salons), Kwame (a new business), Ines (fundraising), Joanne (a career change), Sam (a tenants' campaign) and Lena (moving the family abroad), plus Alex, the developer friend who sets it up for them. Most have never seen an API key.
- **Voice:** a sharp friend's margin notes. Candid, plain, brief, and never hype.
- **Look:** a real pad of paper, where the material carries the meaning. A grained ivory page (`#F8F5EE`) on a desk, typed ink (`#1F2733`) for what's settled, grainy pencil and a Caveat hand for what can change, and slips laid on top (an index card, a sticky note, torn paper) for what you can touch. One accent (`#B83A26`) is used extremely sparingly. Inter does almost all the work, with Noto Serif for the wordmark and goal title and Noto Sans Mono for keys. No badges, bubbles, status colours or props.

**Fixed constraints**
- No backend, no accounts. Data stays in the browser.
- Usage counts are anonymous and cookie-free (Umami Cloud, through a same-origin rewrite): event names and fixed words like a provider kind or skill name, never goal text, chat or the key. No third-party script runs in the page (`apps/pwa/src/lib/analytics.ts`).
- A strict CSP. Network calls go only to the configured provider and the app's own origin, and fonts and assets are self-hosted.
- A PWA that works mobile-first.
- Skills and the goal schema change only as far as the user experience needs them to.

## The chosen experience, in brief

1. **You open to your question, not a form.** "What are you trying to make happen?" A nearly empty key screen follows to get a free Google AI Studio key
2. **The page is home.** Each notebook holds one goal. Every visit opens on the next move, on an index card taped to the top of the page, with three text actions (*Done · Not yet · Something changed*). It's built on the device, and nothing is sent until you answer. The page shows only sections with content.
3. **The conversation writes the page.** It's a loose leaf laid over the page, with no bubbles: torn-topped on mobile, and along the right-hand side on desktop. A changed line gets a pencilled accent loop and a small "new, from your chat · undo" note. A suggestion you haven't taken yet arrives as a sticky note to keep or toss. You can reword lines and add next steps yourself.
4. **Each session starts a fresh conversation** with the page loaded and the last session's note carried in. The active skill's plain name shows in the accent colour while it works ("Pressure-testing").
5. **Keeping the notebook safe is a required step** after the first page: installing, or a backup file where installing isn't possible. After that it lives in the menu.

## Documents

| File | What it holds |
|---|---|
| `context.md`, `audience.md`, `positioning.md`, `voice.md`, `identity.md` | Brand foundations: who it's for, positioning, tone, visual direction |
| `ux-general.md` | Stage 1, the core experience: current-state audit, directions, the chosen direction, plain names, decisions |
| `ux-onboarding.md` | Stage 2, onboarding: the current first run, directions, the chosen direction, failure paths, decisions |
| `provider-facts.md` | Provider signup, billing, data terms, live API checks and costs (checked 2026-09-30) |
| `research/walkthrough.md`, `research/screens/` | Screen-by-screen audit and screenshots of the current app |
| `research/comparables.md`, `research/onboarding-comparables.md` | Patterns from comparable products |
| `research/stitch-prompt.md` | The Google Stitch prompt for inspiration screens. It predates the paper system, and is kept as a record of the prompt that was used. |
| `mockups/` | HTML mockups of every screen in the paper system, light and dark (`index.html` shows them all; `python3 serve.py` serves them on port 4719). `tokens.css`, `notebook.css`, `sheet.css` and `marks.js` are the reference implementation for `identity.md` §05. |
| [Layout canvas](https://claude.ai/artifact/RH171w62jhMXFwRxfaDVJ5) | Unwired mockups of the page-first layout (B) against the side-by-side spread (A) |

## To do

### Research and decisions
- [x] Brand foundations (context, audience, positioning, voice, identity)
- [x] Walkthrough of the current app, with screenshots at mobile and desktop width
- [x] Comparable products: the core experience, and bring-your-own-key onboarding
- [x] Provider facts, including live checks of Gemini's browser access, tool-call behaviour and error codes
- [x] Stage 1 decisions (`ux-general.md` §4)
- [x] Layout mockups: page first against the spread
- [x] Stage 2 decisions (`ux-onboarding.md` §4)
- [x] README cleared of the copy positioning.md flagged ("10X", "anything you can imagine", ⭐)

### Visual design
- [x] Stitch inspiration run. The prompt that worked is in `research/stitch-prompt.md`.
- [x] Visual direction: paper as hierarchy. Page, ink, pencil, margin and slips, with a single accent (`identity.md` §01, §03)
- [x] Typography: Inter by default, Noto Serif for the goal title and wordmark, Caveat for pencilled words, Noto Sans Mono for keys and figures (`identity.md` §04)
- [x] HTML mockups in the paper system (`mockups/index.html`), in light and dark, with perfect-freehand pencil marks (`mockups/marks.js`)
- [x] Mock the remaining screens: the menu with the notebook shelf, the setup kit, the keep-it-safe step (iPhone and Chrome), and the busy, free-limit and offline errors
- [x] Every mockup screen in the paper system: the taped index card, the sticky note, the torn composer slip, the conversation as a loose leaf, ruled writing lines, and pencil circles on hover
- [x] `ux-general.md` and `ux-onboarding.md` decisions brought in line with the paper system

### Foundations
- [ ] Gemini provider: `thought_signature` replay (saved history included), its CSP entry, and `gemini-flash-latest` as the default once it holds up on real skill runs
- [ ] Error messages in voice.md style (`ux-onboarding.md` §3)
- [ ] Remove the cost display: the header figure, `CostPanel` and `cost.ts`

### Core experience, step 1 (no layout change)
- [ ] Plain-names layer: card titles, hints, group labels, the summary card, change summaries (`ux-general.md` §3)
- [x] Change marks: a pencilled accent loop and a "new, from your chat · undo" note on lines a turn changed
- [x] Goal schema v2 for the marks: proposed next actions (sticky notes), `riskNotes[].dependsOn` (arrows), `criteriaStatus` `met` (ticks), open decisions ("?"), `log[].focusLine` (highlighter). Only next actions can be proposed. The star isn't stored: it's the first pending step on the focus line's critical path.
- [x] Schema v2 wired through: the v1→v2 migration, core tests, the owning skills (`plan`, `threat`, `eval`, `decide`, `strategy`), `AGENTS.md`, the model-facing contract in `skills.ts` and the tool inputs in `tools.ts`. The current dashboard shows open decisions, proposed moves and met criteria.
- [x] The other pencil marks (`identity.md` §05), drawn with perfect-freehand: tick, highlighter, star, arrow, squiggle, eraser, margin "?"
- [x] Sticky-note suggestions: render proposed next actions as sticky notes, with Keep it and Toss flipping the status
- [ ] The next move on open, built on the device, on the taped index card with three text actions
- [ ] Keep-your-notebook-safe step. Safety then lives in the menu, and every banner goes except the app update.
- [ ] A fresh conversation per session, with the goal loaded and the previous note carried in
- [ ] The active skill's plain name in the accent colour while it works
- [ ] Rewrite the intake opener in voice.md style (`apps/pwa/skills/intake/SKILL.md`, step 1)
- [x] The paper system: tokens, grain, the graphite and bleed filters, fonts including Caveat, perfect-freehand marks, slips, plain sections in place of cards, no bubbles, pills or criteria bar (`identity.md` §05, §10)
- [x] Contrast check of pencilled text on grained paper in both themes (`identity.md` §03)

### Core experience, step 2 (page first)
- [ ] Page-first layout: a conversation sheet on mobile and a side column on desktop
- [ ] Inline editing (reword a line, add a next step) logged as "you edited". Record this exception to single-key ownership in `AGENTS.md`.
- [ ] Notebook shelf in the menu, with archive in place of delete

### Onboarding
- [ ] Question-first screen, with the draft kept on the device
- [ ] Key screen: three steps, one button to AI Studio, a paste field with a Paste action, a check on paste, provider detection by prefix, the trust line, "Other options"
- [ ] Send the first message automatically and take the title from the goal. Remove the title dialog.
- [ ] "Use a different provider": Anthropic, OpenAI and a custom endpoint
- [ ] Setup kit: a message template, a `#setup=google` link, a printable key sheet

### Housekeeping
- [ ] De-duplicate and relabel `research/screens/`. Two runs overlapped, and some filenames don't match their contents.
- [ ] Revoke the throwaway Gemini test key in AI Studio
- [ ] Find out why the `qa-tester` agent keeps handing work to other agents instead of running it (`~/.claude/agents/qa-tester.md`)
- [ ] Update `AGENTS.md` for the Gemini provider and user edits
