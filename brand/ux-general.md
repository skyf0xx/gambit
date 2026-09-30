# Gambit core experience

Stage 1 of the UX rethink: the core experience after a key is entered. Onboarding (stage 2) builds on this.

Supporting research, all in `brand/`:
- `research/walkthrough.md`: screen-by-screen audit with file:line references
- `research/screens/`: screenshots at desktop 1440×900 and mobile 390×844, with seeded persona goals
- `research/comparables.md`: patterns from about 25 tangentially similar products
- `provider-facts.md`: signup flows, in-browser key options, real costs (checked 2026-09-30)

---

## 1. The current core experience

**In one line:** a chat app with a dashboard attached. The notebook exists in the data model but not in the experience.

### What the user sees

| Moment | What happens | Screenshot |
|---|---|---|
| First goal | A modal asks for a title before any conversation. The page shows "Not yet defined" and nothing else. | `research/screens/06-dashboard-stub-mobile.png` |
| During a session, desktop | Chat on the left (40%), page on the right (60%). A change shows only as a green text line under the reply. | `research/screens/07-dashboard-rich-desktop.png` |
| During a session, mobile | Chat fills the screen. The page is a second tab with no signal when it changes. | `research/screens/05-chat-rich-mobile.png` |
| The page, mobile | A good summary card on top (goal, criteria bar, focus, next move), then group tabs and collapsible cards | `research/screens/07-dashboard-rich-mobile.png` |
| A week later | A blank chat saying "Ask for a status, a next step, or a hard question about the plan", under an export nag. The next move is already recorded, one tab away. | `research/screens/05-empty-chat-nonstub-mobile.png` |
| Settings | A developer form: "Model id", "Proxy / base URL", "Persistent storage: not granted", "Bind backup file" | `research/screens/02-settings-desktop.png` |

What already works and should survive any redesign:
- The **Bridge card** at the top of the page (`Dashboard.tsx:57-92`). It shows the goal, criteria, weeks left, focus and next move, and it's the best "where you stand" view in the app.
- **Tickable steps** on the plan. They're the one place the page behaves like a notebook.
- **Undo per turn.** It builds trust, but it's attached to the chat and not to the page.

### Friction points, ranked

**High: these break the "notebook that thinks back" promise**

1. **A return visit opens to a blank chat.** The record already holds the next move, the focus and the deadline, but the first screen shows none of it and Gambit says nothing. This is the moment the brand exists for, and it's empty. `App.tsx:59-68`, `Chat.tsx:52-55`
2. **On mobile, the page is hidden and silent.** The app opens on the chat tab and the page tab never signals a change, so a phone user can finish a session without seeing the page fill in. `App.tsx:90-97`, `persist.ts:46`
3. **Nothing on the page marks what changed.** The only record is a chat line such as "Goal updated: +2 risk, systems notes updated", made from schema key names by `summarizeChange` (`packages/core/src/ops.mjs:67-104`). Every comparable product that keeps a record marks AI edits on the record itself (`comparables.md`).
4. **The schema's vocabulary is the UI's vocabulary.**
   - Card titles are generated from keys: "Systems notes", "Criteria status", "Risk notes" (`Sections.tsx:13-16`).
   - The `schwerpunkt` value renders as an unlabelled bold headline (`Sections.tsx:116`).
   - Other terms appear as-is: "Posture L2 Committed…" and `control`/`influence` pills (`Dashboard.tsx:84-88`), "4 lines · 2 need attention", "on schedule", and a group called "Reference" (`registry.mjs:55-61`).
   - voice.md forbids all of this.
5. **Editing the page means editing JSON, and only on desktop.** Apart from ticking a step and double-clicking the title, correcting the page means a raw JSON textarea (`Dashboard.tsx:22-40`), hidden on mobile (`Dashboard.tsx:51`). A notebook you can't write in isn't a notebook.

**Medium: these erode trust or cost people their work**

6. **Data safety is nagging, not protection.**
   - Up to four stacked banners (`App.tsx:28-56`). The stale-export one can't be dismissed and returns on every load after 14 days (`App.tsx:42,53`).
   - The install banner copy reads as a threat.
   - The settings panel talks in browser internals (`Settings.tsx:33-60`).
   - Meanwhile the real risk is under-explained: Safari's 7-day storage cap for sites that aren't installed can delete an iPhone user's whole notebook.
7. **Goals are a bare `<select>`.**
   - There's no status or last-touched date per goal, and no archive.
   - Delete sits in Settings → Danger zone, works only on the active goal, and is guarded by `confirm()` (`App.tsx:77`, `Settings.tsx:107`).
8. **Errors come straight from the machinery.**
   - Provider errors reach the chat as raw `Error.message` (`Chat.tsx:43`).
   - A goal that fails validation shows Zod paths and says "fix the JSON" (`Dashboard.tsx:106`).
   - Nothing is written in the voice.md error style ("what happened, what to do").
9. **The intake opener is off-voice.** "👋 I am Gambit. Expert on getting things done. Give me a goal, I'll help you get there." (`apps/pwa/skills/intake/SKILL.md`, step 1) is a self-introduction and a claim, where voice.md wants one question.
10. **The cost figure is misleading.**
    - The header shows spend over a rolling 6-hour window fixed when the page loads (`CostPanel.tsx:7`). It isn't a session and isn't a month.
    - The price table is stale. Opus is 3× too high, and the Sonnet row matches Sonnet 4.5, not the default `claude-sonnet-5` at $2/$10 (`cost.ts:6-7`, `provider-facts.md`).

**Low**

11. **New goal asks for a title before any thinking.** The first thing typed is a guess, and it becomes the dropdown label (`NewGoal.tsx`).
12. **"Clear chat" sits under the composer** behind `confirm()` (`Chat.tsx:109`), and the Settings modal doesn't close on Escape.
13. **Stub detection relies on the magic string** "define success criteria", duplicated in `App.tsx:66` and `Dashboard.tsx:65`. That makes "first session" a fragile state to design around.

Walkthrough caveats: no live model turn was captured (no real key). Some screenshot filenames in `research/screens/` are mislabelled: `08-bad-key-error-mobile.png` shows Settings, and several files are byte-identical duplicates. Treat the table above as the verified set.

### What the research says

From `comparables.md`, the patterns that apply most:

- **The kept record is separate from the transcript, and it's the thing you come back to.** Claude Artifacts, ChatGPT and Gemini Canvas, v0 and NotebookLM all work this way.
- **Every AI edit is visible on the record itself** as a highlight or diff, not only described in chat.
- **The record stays directly editable.** AI output is a draft you can change.
- **Return prompts that know your state work without guilt.** Rosebud skips a reminder if you've already done the thing. Replika's affect-laden "don't leave" messages are the documented counter-example.
- **Local-first data safety works as a headline feature** (Obsidian), not as a banner. Excalidraw's silent storage limits caused real data loss.

From `provider-facts.md`:

- **A session costs cents.** About $0.15 per 15-turn session on the default `claude-sonnet-5`, and about $0.60–3 a month. OpenRouter's current default (Sonnet 4.5, uncached) is the most expensive at about $0.48 a session. Cost doesn't need a place in the UI.
- **OpenRouter sign-in works from the static PWA without copy-paste.** OAuth PKCE was verified: the exchange endpoint returns `access-control-allow-origin: *` and is already in `connect-src`. Anthropic and OpenAI have no equivalent. This is mainly stage 2, but it means settings can stop being about keys.
- **The whole skill catalogue is never sent.** Each turn sends the fixed preamble and index (about 4.5k tokens) plus one active skill. Chat history is the main cost driver in long sessions, so "start a fresh conversation, keep the page" is cheaper as well as tidier.

---

## 2. Directions

The four directions share a baseline of no-regret fixes: plain names, a visible mark on anything that changed, a return screen that isn't blank, and dismissible data-safety messages. They differ in what the product *is*.

### A. Two-page spread (improve what's there)

Keep chat and page side by side, but give the page the weight.
- **Desktop:** page 60–65% and chat as a narrower column.
- **Mobile:** stays tabbed, but the page tab shows a dot when it changes. Each reply ends with a "What changed" strip that jumps to the highlighted cards.
- **Return visit:** opens on the page's summary card.

| | |
|---|---|
| Good | Smallest change, and keeps everything that works. Fixes friction 2–4 directly. |
| Bad | It's still a chat app with a dashboard. On mobile the notebook is still the second tab. It doesn't deliver on the brand line, only stops contradicting it. |
| Assumes | The people who return are mainly people who want to talk. |
| Cost | Small to medium. Changes to `App.tsx` layout, a change feed from the `summarizeChange` data, and highlight state on cards. No schema change. |

### B. Page first (the notebook is the screen)

The page is home on every device. The conversation is how the page gets written.
- **Mobile:** you open to your page. A composer sits at the bottom ("Talk it through"), and the conversation rises as a sheet over the page. When it closes, the new marks are visible where they landed.
- **Desktop:** the page is the centre column, and the conversation is a right-hand margin that can be hidden.
- **Edits are marked like a red pencil:** a short-lived highlight, plus a small margin note ("added by Gambit · 30 Sep") that you can tap to see what changed or undo it.
- **You can write on the page:** tick, edit a line in place, add a next step. Each edit is recorded as yours.

| | |
|---|---|
| Good | Matches the brand and identity.md ("The page is the product") directly. The page becomes the thing people screenshot and share. Mobile finally shows the notebook. Undo moves to where the change is. |
| Bad | Conversation-heavy sessions such as intake and negotiation prep need a full-height chat, so the sheet has to expand to full screen gracefully. Direct editing needs plain-language forms per section, which is the biggest build item. |
| Assumes | People come back to see where they stand and what to do, and talk second. |
| Cost | Medium to large. A new layout shell, a per-section edit UI instead of JSON, change marks keyed to paths, and a "user edit" provenance in the log. It also needs an exception to single-key ownership for user edits. |

### C. Dated notebook (sessions are entries)

The notebook has a living **front page**, which is the current state, and **dated entries** behind it. Each conversation is an entry that Gambit closes with a short written note: what was decided and what changed on the front page. The existing `log` already has this shape. It's append-only and dated, with one entry per session. Today it's collapsed at the bottom of the page.

| | |
|---|---|
| Good | The most "notebook" of the options. It turns the transcript's cost problem into a feature: each entry is its own conversation, so history stays short and cheap. Reviewing the past is reading, not scrolling a chat. Maps onto existing data. |
| Bad | Adds a navigation level (front page, entries, conversation). Risks feeling like a journaling app, which the audience section says to avoid for motivation seekers. Long-running threads like fundraising span entries awkwardly. |
| Assumes | Sessions have natural beginnings and ends. That's true for most personas (Rosa on Sunday nights, Sam before meetings). |
| Cost | Medium. Chats are keyed per goal today (`db.chats` keyed by `goalId`), so they would become per-entry. The close-out note is generated at session end, which is a single extra model call. |

### D. Bold: Gambit writes first

There's no chat box on open. Every visit starts with one card, written in the margin:

> **Your next move was:** email the landlord's agent for the break clause, by Friday.
> *Done · Not yet · Something changed*

Your answer starts the conversation. "Done" ticks the step and asks what you learned. "Not yet" asks what's in the way. "Something changed" goes into reassessment. Other due items come after: a forecast that resolves this week, a decision whose review date has passed, a test whose deadline is up.

| | |
|---|---|
| Good | This is what "thinks back" means in practice. It encodes GUIDED.md's "always leave a next step" as the product's front door, and the return prompt knows your state (the Rosebud pattern, not Duolingo's guilt). The card can be **built locally from the record** (next action, due dates, review dates), so it's free, instant, private and works offline. Nothing is sent until you answer. |
| Bad | Tone risk: if it's done badly it feels like a habit tracker, which positioning.md refuses. There's no streaks or counts of days away, and the card never mentions how long you've been gone. It isn't enough on its own as the whole product, because it needs a home to sit on. |
| Assumes | The recorded next move is usually still the right question to open with. |
| Cost | Small to medium. A local "what's due" function over the goal record, one card component, and three answer paths that send a prepared first message into the existing agent loop. |

### Constraints that shape these

- **No constraint blocks any direction.** Speaking first with *model-written* text would need an API call on every open: about $0.01–0.02 each, a working key, network access, and a wait. Direction D avoids this by building the card locally. That's cheaper, and it's also more honest, because it quotes what you agreed to rather than improvising.
- **Local-only storage on iPhone is the one constraint that costs something real.** Safari can delete storage for sites that aren't installed after 7 days without use. With no backend, the only protections are installing the app or exporting a file. File write-through (`bindExportFile`) is Chromium-only. So for iPhone users, installing to the home screen *is* the backup. It can't stay an optional banner. It has to be a step in the first session.

---

## 3. Chosen direction

**Page first (B), opening on the next move (D), with the log as visible history (from C), on a paper page.** It's delivered in two steps, so step 1 ships value even if step 2 waits. The [layout canvas](https://claude.ai/artifact/RH171w62jhMXFwRxfaDVJ5), row B, shows the structure. The visual system is set by `identity.md`: paper as hierarchy, where the material says what's settled, what's open and what you can touch.

**The shape:**
- **The page is home on every device.** On mobile, the app opens on the page. On desktop, the page is a centred column at reading width.
- **The page shows only what has content.**
  - Top: the next move, on a taped index card.
  - Then the goal title, with its weeks left pencilled under it.
  - Then three sections: "What done looks like", "Who's involved", "What could go wrong".
  - Other sections, such as the plan, decisions, predictions and tests, appear only once a conversation has written them. They follow as plain headings and text.
  - Session notes sit at the foot.
  - There are no badges, status colours or progress bars, and no containers around ordinary text. Status is a pencilled word.
- **Every open starts with the next move**, on an index card taped to the top of the page. It's built on the device from the goal record: the recorded next action, plus anything whose date has come up (predictions to score, decisions due for review, tests past their deadline). Three understated text actions follow it: *Done · Not yet · Something changed*. Nothing is sent to the model until you tap one, and the tap sends a prepared first message into the conversation. When nothing is due, the card asks "What's your next move?".
- **The conversation is a loose leaf over the page.** It's a torn-topped leaf on mobile and a hideable leaf along the right on desktop, with no bubbles and no avatars. The advisor's words read like writing added to the notebook. A line the conversation just changed gets a pencilled accent loop and a small note ("new, from your chat · undo") while it's new. A suggestion the person hasn't taken yet arrives as a sticky note on the page, to keep or toss.
- **You can write on the page.** You can tick, reword a line in place, and add a next step. Every edit you make is recorded in `log` as "you edited". Skills still own each section's structure, and full editing of a section isn't offered. The JSON editor goes.
- **Skills are visible by name while they're working.** While a skill is active, the conversation shows its plain name ("Pressure-testing", "Prepping a conversation") in the accent colour. The name is informational and doesn't link to the skill. There's no skill picker. You talk, and the agent chooses the skill and does all the writing to the page. To ask for one on purpose, you say it in plain words ("pressure-test this").
- **One notebook per goal.** Each goal is its own notebook, with its own page, notes and conversations. The shelf of notebooks sits one tap away in the menu and lists each notebook with its status word and last-touched date. Archive replaces delete on the shelf, and delete lives in the archived view.
- **Each session gets a fresh conversation, and the goal is loaded into it.**
  - The app reopens the notebook you used last.
  - A new session starts a new transcript, with the full current page loaded as context and the previous session's closing note carried in.
  - Each session ends with a one-line dated note in `log`, and those notes are listed at the foot of the page as "Notes".
  - A new session begins when you come back after 6 or more hours away, or tap "New conversation". Past transcripts aren't shown as navigation.
- **Keeping the notebook safe is a required step**, right after the first page is written:
  - iPhone and iPad: Add to Home Screen, with Safari's steps shown
  - Chromium browsers: the install prompt, then an offer to bind a backup file
  - Browsers that can't install: a downloaded backup file instead

  After that, safety lives in the menu ("Saved on this device · backed up 3 days ago"). A single small line appears on the page only when there's something to do, never a banner.
- **Chrome is minimal.** A small notebook name at the top, one menu (shelf, settings, safety), and a torn composer slip at the bottom reading "Think out loud…". "What's your next move?" stays at the top of the page and is never the input's placeholder. Everything else is one tap away.
- **Google AI Studio (Gemini) is the default provider**, with a short step-by-step blurb on getting a key. `ux-onboarding.md` covers that screen. What it means for the core experience is below.

**Why B over A:** A fixes the contradictions but keeps a chat product. On mobile, where most of this audience lives, A still hides the page behind a tab.

**Why not C in full:** entries as a navigation level add structure that most sessions don't need. The session notes carry the useful part of it.

### What the Gemini default means for the core experience

From `provider-facts.md`, checked live on 2026-09-30:

- **Billing waits for the free limit.** On the free tier, Google may train on prompts, and human reviewers may read them. Paid-tier terms rule both out, and getting them takes a card and a prepayment. The key step stays free and says nothing about billing. Adding credit comes up only when someone reaches the free limit, alongside switching provider. Gambit never quotes prices. The privacy copy promises what Gambit controls ("Your notebook stays on this device").
- **Gemini needs its own provider path.** Tool calls carry a `thought_signature` that must be replayed. Without it, the second tool turn fails with a 400. Signatures must survive in the saved chat history too.
- **The default model is `gemini-flash-latest`, with an automatic fallback to `gemini-3.5-flash-lite` on a 503.** Google's recommended `gemini-3.8-flash` returned 503 on every attempt during testing on a free key. A fallback turn is noted quietly in the conversation, and a calm retry message in voice.md style covers the case where both are busy. The default needs a quality check on real skill runs before it ships.
- **Cost drops.** A session is about $0.05–0.07 on paid Gemini 3.8 Flash, and $0 on the free tier.
- **CSP:** `https://generativelanguage.googleapis.com` has to be added to `connect-src` in `vercel.json` and in the build.

### Step 1: fixes that ship without the layout change

1. A plain-language naming layer (the table below) in `titleForKey`, `hintFor`, `GROUP_LABELS`, the Bridge, and `summarizeChange` labels
2. Change marks: a pencilled accent loop and a small "new, from your chat · undo" note on the lines a turn changed
3. The next move on open, built on the device, on the taped index card with three text actions
4. Keep-your-notebook-safe as a required first-session step. Afterwards, safety lives in the menu, and every banner goes except the app update.
5. Errors in voice.md style for each provider failure (bad key, no credit, rate limit, provider busy, provider down), with raw details behind a "details" link
6. Gemini as a provider with signature replay and the CSP entry. The in-app cost display goes.
7. A fresh conversation per session, with the goal loaded and the previous note carried in
8. The active skill's plain name shown in the accent colour while it works
9. The paper system from `identity.md`: page, ink, pencil and slip materials, Inter, Noto Serif and Caveat, perfect-freehand marks, no badges, bubbles, status colours or criteria bar

### Step 2: the page-first layout and writing on the page

- The page becomes home, with the conversation as a sheet (mobile) or side column (desktop), and undo sits in the note beside each changed line
- Inline editing: reword a line, tick, add a next step. The JSON editor is removed.
- The notebook shelf in the menu, with archive

### Plain names

Plain name first, method name as a small grey secondary label (identity.md: "Plain labels, methods underneath").

| Key / term | UI name | Secondary label |
|---|---|---|
| `successCriteria` / `criteriaStatus` | What done looks like | success criteria |
| `control` / `influence` | In your hands / Up to others | — |
| `plan` | Plan | — |
| line of operation | Track | line of operation |
| critical path | Steps | critical path |
| `systemsNotes` | Where to push | systems analysis |
| `schwerpunkt`, focus | Focus | Schwerpunkt |
| `posture` | Stance (no level numbers) | posture |
| `riskNotes` | What could go wrong | risks · premortem |
| `decisions` | Decisions | — |
| reverse if | Would change my mind if | — |
| `people` | Who's involved | — |
| `stakeholders` | Who matters | stakeholder map |
| `exposure` | What you're putting on the line | personal exposure |
| `capacity` | Your time and money | capacity |
| `forecasts` | Predictions | forecasts |
| `experiments` | Tests | experiments |
| `log` | Notes | log |
| Groups | Plan · People and risks · Predictions and tests · You · Background | — |

---

## 4. Decisions

| Question | Decision |
|---|---|
| Layout | Page first (B) |
| Writing on the page | Edit existing lines and add next steps. Edits are logged as "you edited". |
| Speaking first | The next move, built on the device, as plain text at the top of the page. The model replies only once you answer. |
| Installing | A required step right after the first page is written, adapted to each platform |
| Skill visibility | Plain name in the accent colour while a skill is active, not linked. No skill picker: the agent chooses from what you say. |
| Goals | One notebook per goal, on a shelf in the menu, with archive |
| Visual system | Absolute minimalism: less interface, more thinking (`identity.md`) |
| Conversations | Fresh per session. The last notebook reopens with its goal loaded. |
| Names | The plain names in section 3 |
| Default provider | Google AI Studio (Gemini), with a short instruction blurb |
| Free-tier data terms | The key step recommends linking billing and says plainly what the free tier means. The user chooses. |
| Default model | `gemini-flash-latest`, falling back to `gemini-3.5-flash-lite` on a 503 |
| Regional terms (EEA, UK, Switzerland) | Out of scope. Users can pick a paid key or another provider. |
