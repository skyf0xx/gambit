# Gambit UX audit — walkthrough

Dev server: `npm run dev` (Vite, bound to `http://localhost:5175` in this
session — 5173/5174 were already occupied by other instances). Data seeded
directly into the `gambit` IndexedDB database via `page.evaluate` (no real
API key used anywhere; `sk-ant-invalid` was entered as the literal key
string to trigger the bad-key error path).

All screenshots are in `brand/research/screens/`.

## 1. Screens and states captured

| # | Screen / state | Screenshot(s) |
|---|---|---|
| 1 | First-run setup (no key entered) | `01-setup-desktop.png`, `01-setup-mobile.png` |
| 2 | Settings panel (Model/key section open) | `02-settings-desktop.png`, `02-settings-mobile.png` |
| 3 | Cost / usage panel (expanded) | `03-cost-panel-desktop.png`, `03-cost-panel-mobile.png` |
| 4 | New goal dialog | `04-newgoal-desktop.png`, `04-newgoal-mobile.png` |
| 5 | Empty chat, stub goal (just-created, no title yet sharpened) | `05-empty-chat-stub-desktop.png` |
| 5b | Empty chat, non-stub goal (Rosa — goal defined, no messages) | `05-empty-chat-nonstub-mobile.png` |
| 5c | Chat with full history (Lena, rich goal, desktop pane) | visible in `07-dashboard-rich-desktop.png` (left pane); mobile chat tab in `05-chat-rich-mobile.png` |
| 6 | Goal switcher (dropdown in header, 3 goals) | visible in header of `06-dashboard-nearempty-desktop.png`, `07-dashboard-rich-desktop.png` |
| 6b | Dashboard, near-empty goal (Rosa) | `06-dashboard-nearempty-desktop.png`, `06-dashboard-nearempty-mobile.png` |
| 6c | Dashboard, stub goal (no goal statement yet) | `06-dashboard-stub-mobile.png` |
| 7 | Dashboard, rich goal (Lena — plan, risk, stakeholders, exposure, capacity, forecasts, experiments, systems notes, 7-entry log) | `07-dashboard-rich-desktop.png`, `07-dashboard-rich-desktop-expanded-fullpage.png` (scrolled, sections expanded), `07-dashboard-rich-mobile.png`, `07-dashboard-rich-mobile-fullpage.png` (scrolled), `07-dashboard-rich-mobile-reference-expanded.png` (Reference tab / Systems notes expanded on mobile) |
| 8 | Bad-key error state (`sk-ant-invalid` submitted, chat send attempted) | `08-bad-key-error-desktop.png`, `08-bad-key-error-mobile.png` |
| 9 | Invalid-schema dashboard error (hit incidentally when a seeded field exceeded a schema string-length cap) | `09-invalid-schema-error-desktop.png` |
| — | Data-safety banner ("Your goals haven't been exported in a while") | visible across most post-seed screenshots (banner row under header) |

Not captured (not reachable without a live/valid provider key): a
successful assistant turn actually streaming and writing to the goal, the
install-prompt banner (requires a real `beforeinstallprompt` event, which
Playwright/Chromium headless does not fire in this environment), and the
service-worker "new version ready" banner (requires a real SW update
cycle).

## 2. Friction points

### Mobile chat/dashboard space-sharing
Desktop uses a fixed two-pane CSS grid (`md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]`,
`App.tsx:89`) so chat and dashboard are always both visible side by side.
Mobile collapses to a single pane switched by a two-button tab bar at the
bottom (`App.tsx:93-97`, `tab === 'chat' ? 'block' : 'hidden'` /
`tab === 'dashboard' ...`). There is no badge, dot, or any indicator on the
"dashboard" tab button when the dashboard changes while the user is looking
at chat — a user who sends a message and stays on the chat tab has no cue
that the dashboard even updated, let alone what changed in it. **Severity: high.** (`apps/pwa/src/App.tsx:90-97`)

### No diff/highlight for what a message changed
The only signal that a turn changed the goal is a single green line under
the assistant's message: `Goal updated: {m.summary!.join(', ')}`
(`Chat.tsx:70-72`) — and the join is literally the raw section keys the
agent returned (e.g. "systemsNotes updated, criteriaStatus updated" as
seen live in the seeded Lena transcript). Nothing in the dashboard itself
highlights the changed card, scrolls to it, or shows before/after values.
A non-technical user has no way to answer "what exactly did that message
just change" beyond guessing from a camelCase key name. **Severity: high.** (`apps/pwa/src/components/Chat.tsx:70-72`)

### Returning-user experience has no picker, no confirmation
On load, `App.tsx:64` picks `current = goals?.find(g => g.id === activeId) ?? goals?.[0]` and
immediately renders straight into that goal's chat/dashboard — there is no
"Welcome back" screen, no goal picker, no summary of what changed since
last visit. If `activeId` doesn't match any goal (e.g. it was deleted),
it silently falls back to the first goal in `updatedAt` order with zero
notice to the user that their previously-open goal is gone. **Severity: medium.** (`apps/pwa/src/App.tsx:59-68`)

### Goal switching, creation, archiving
Switching goals is a plain `<select>` in the header (`App.tsx:77-79`) —
functional but the only affordance; there's no visual distinction between
goals (no status color, no last-updated hint) in the option list, just
raw titles. Creating a goal is a single-field modal (`NewGoal.tsx`).
**There is no archive and no per-goal "delete" from the switcher itself** —
deletion only exists buried in Settings → Danger zone → "Delete active
goal" (`Settings.tsx:107`), which deletes whatever goal happens to be
currently active, with a plain `confirm()` browser dialog as the only
safeguard, and no undo. A user cannot delete a goal that isn't currently
open without first switching to it. **Severity: medium.** (`apps/pwa/src/components/Settings.tsx:107`, `apps/pwa/src/App.tsx:77-81`)

### Data-safety banners
Three banners share one `Banners()` component (`App.tsx:28-56`):
- Install banner: dismissible via `dismissInstall`, and the dismissal
  appears to be permanent per `installDismissed` state — reasonable, not
  alarming, but the copy ("browsers can erase data for sites that aren't
  installed") is genuinely alarming for a first-time non-technical user
  with no immediate action they understand how to take beyond "Install."
- Sync/backup-file re-authorization banner: not dismissable at all, shown
  whenever `fileSyncState() === 'needs_permission'`.
- Stale-export banner ("Your goals haven't been exported in a while"):
  **has no dismiss/close button at all** (`Banner` only renders a close
  `✕` when `onClose` is passed, and this banner is rendered without one,
  `App.tsx:53`). It reappears on every load once 14 days pass
  (`App.tsx:42`) with no way to snooze or say "not now" — a user who
  doesn't want to export yet has no way to make it stop except exporting.
  **Severity: medium.**
- None of the banners explain in plain language what "export," "goals,"
  or "backup file" mean in a way a first-time user (who has never used a
  browser-based, backend-less app before) would parse as urgent-but-safe
  rather than alarming.

### Jargon leaking into user-facing UI
- **"Schwerpunkt" is the literal internal/military term used as a variable
  name in the schema (`schema.mjs:108`, `systemsNotes.schwerpunkt`), and
  its rendered value is shown as a bold, unlabeled headline inside the
  "Systems notes" card with zero explanation of what concept it
  represents (`Sections.tsx:116`: `<div className="font-medium ...">{data.schwerpunkt}</div>`).
  The card title itself is machine-derived from the key name via
  `titleForKey('systemsNotes')` → "Systems notes" (`Sections.tsx:13-16`),
  which is fine, but the field inside carries no caption at all — a
  first-time user sees an unexplained bolded sentence with no idea it's
  meant to answer "what's the one thing that determines everything else."
  **Severity: high.**
- **"Goal updated: systemsNotes updated, criteriaStatus updated, plan
  updated, log entry added"** — every one of these is a raw camelCase
  schema key surfaced directly in chat (`Chat.tsx:72`,
  `m.summary!.join(', ')`), with no human translation layer. **Severity: high.**
- The dashboard group label "Reference" (`registry.mjs:60`,
  `GROUP_ORDER`) houses "Systems notes," which is itself the
  Schwerpunkt/PMESII-style analysis — the grouping gives no hint what
  "Reference" means either.
- "Line of operation," "critical path," and "posture" (with numbered
  "levels," e.g. "L2 Committed, executing legal track" rendered verbatim
  in `Dashboard.tsx:88`) are operational-planning-doctrine terms shown
  as plain section labels with no glossary or tooltip anywhere in the
  UI. A user has to infer meaning entirely from surrounding data.
  **Severity: medium.**
- Model/provider jargon in Setup and Settings: "Model id" as a bare
  labeled text input with placeholder "model id" and no explanation of
  what a model or a model id is (`Setup.tsx:48-49`); "skill loads" and
  "Active skill" percentage bars, unexplained, in the Cost panel
  (`CostPanel.tsx:26,33`). **Severity: medium.**
- Did **not** find "PMESII," "BATNA," "ASCOPE," "CoG," or "ZOPA" rendered
  anywhere in the currently reachable UI — those concepts may only ever
  surface inside assistant chat prose (skill-generated), not in
  structural UI labels, so they weren't observed here; worth a follow-up
  content audit of actual assistant responses under `skills/`.
- "Dexie" does not leak into the UI (only in code/comments) — confirmed
  not user-facing.

### Other friction noticed while capturing screens
- The Settings modal does not close on `Escape` — only via the explicit
  `✕` button; verified by pressing Escape with the dialog open and it
  stayed open. No file:line to cite (no keydown handler exists at all in
  `Settings.tsx`), but the absence itself is the bug. **Severity: low.**
- Seeded schema violations (string-length caps on `shortLabel`,
  `mediumLabel`) surfaced the "This goal doesn't match the current
  schema" error path unexpectedly (`Dashboard.tsx:106`) — the message is
  technically accurate (`path: message` list from Zod) but entirely
  developer-facing: a real user seeing e.g.
  `plan.linesOfOperation.1.criticalPath.0.label: String must contain at
  most 40 character(s)` would have no idea what to do with it beyond
  "Restore it from a backup or fix the JSON," which assumes JSON literacy.
  **Severity: medium** (this is reachable in production if any writer
  path — including the agent itself — ever emits an over-length field).
- The "Edit" affordance on dashboard cards is `hidden md:block`
  (`Dashboard.tsx` via `Sections.tsx` is not directly hidden, but
  `Card`'s edit button is `className="mt-3 hidden text-xs ... md:block"`,
  `Dashboard.tsx:51`) — **raw-JSON editing of a goal section is
  desktop-only**; mobile users have no way to hand-correct a section
  short of chatting the agent into fixing it. Reasonable for JSON editing
  specifically, but worth noting as a capability gap on mobile.
  **Severity: low.**

## Summary of key file locations
- `apps/pwa/src/App.tsx` — shell, tabs, banners, goal selection/routing
- `apps/pwa/src/components/Chat.tsx` — chat pane, turn summaries, undo
- `apps/pwa/src/components/Dashboard.tsx` — dashboard shell, group tabs, cards
- `apps/pwa/src/components/Sections.tsx` — per-section renderers (incl. `schwerpunkt` leak)
- `apps/pwa/src/components/Settings.tsx` — settings modal, data/durability, danger zone
- `apps/pwa/src/components/CostPanel.tsx` — usage/cost panel
- `apps/pwa/src/components/Setup.tsx` — first-run provider/key form
- `apps/pwa/src/lib/db.ts` — Dexie schema (`gambit` DB: goals, chats, snapshots, settings, secrets, usage)
- `apps/pwa/src/lib/goals.ts` — goal CRUD, active-goal setting, migration
- `packages/core/src/schema.mjs` — goalSchema (authoritative field shapes/caps)
- `packages/core/src/registry.mjs` — `GROUP_LABELS`/`GROUP_ORDER` dashboard grouping
