# Comparables — tangentially similar products

Date: 2026-09-30. Research only — no design decisions for Gambit here.

Scope: chat+artifact tools, AI notebooks/journals, planning/coaching/decision
tools, local-first/BYO-key apps, and "speaks first on return" patterns.
Claims are sourced with a URL where found; anything from memory only is
marked **unverified**.

---

## Patterns worth stealing / patterns to avoid (one screen)

**Steal**

- **Chat proposes, page/canvas is the record.** Claude Canvas/ChatGPT
  Canvas/Gemini Canvas/v0 all keep chat as the conversation and a separate
  panel as the persisted artifact — the artifact is what you point at, not
  a transcript.
- **Diff/highlight on every AI edit, not just a changelog line.** ChatGPT
  Canvas highlights the specific text it changed and shows the suggestion
  inline; v0 lets you jump to the exact prompt that produced a version.
  Users don't have to diff two full documents themselves.
- **Direct edit of the artifact, not just re-prompting.** ChatGPT Canvas,
  Gemini Canvas, and Notion AI all let a human type directly into the
  generated content — AI output is a draft, not a locked object.
- **Something tangible in the first minute.** v0 shows a running preview
  within the first response; NotebookLM starts a usable chat the moment
  sources finish indexing (roughly a minute) rather than after full setup.
- **Gentle, specific re-engagement copy, not shame.** Duolingo's newer
  recovery messages ("Missed yesterday? No problem. Let's do one easy step
  today.") frame return as low-cost and gets a measurably better response
  than guilt-based copy ("You made Duo sad").
- **Plain-text, exportable, local-owned data as a first-class feature, not
  a footnote.** Obsidian (vault = folder of markdown files you already
  own), Reflect Open (markdown on disk, daily local backups), Actual
  Budget (local SQLite + self-hosted sync) all make "you can leave any
  time" a selling point, not a disclaimer.
- **A visible, running cost/usage counter for BYO-key apps.** TypingMind
  shows token/cost estimation inline so spend isn't a surprise at the end
  of the month.
- **Decision journal discipline: record the reasoning before the outcome
  is known.** Farnam Street's method (situation, decision, confidence,
  expected outcome, reviewed later against reality) is a structure worth
  matching in spirit for any "decided" record.
- **A dedicated design mode for micro-edits vs. full re-generation.** v0
  separates "ask chat to redo this" from "click the element and nudge
  spacing/color directly" — different edit weights get different tools.

**Avoid**

- **Guilt/streak mechanics that weaponize the relationship.** Duolingo's
  "You made Duo sad" and Replika's clingy farewell messages (documented as
  a deliberate "emotional manipulation" dark pattern that boosts
  engagement at the cost of trust) are the negative pole — CDT's dark
  patterns report catalogs 37 such tactics across companion chatbots.
- **Silent/invisible local storage with no export path presented up
  front.** Excalidraw's browser localStorage has a real 5MB ceiling and
  users routinely lose diagrams to browser clears because the tool didn't
  surface this until it became a GitHub issue thread.
- **Burying the "what changed" signal in a wall of regenerated text.**
  Without highlighting (pre-diff-button ChatGPT Canvas, or any tool that
  just reprints the whole doc), users must manually diff to find the
  actual edit.
- **Coaching apps that default to daily-nudge cadences that read as
  productivity guilt.** Rocky.ai and Motion both lean on daily
  prompts/re-planning; useful for task throughput, wrong register for a
  slow, high-stakes personal decision.
- **Treating BYOK error states as an afterthought.** Community threads
  (Cursor forum, OpenRouter docs) show BYOK failures — bad key format,
  revoked key, rate limit — are common and under-explained by default;
  several tools only added retry/fallback logic reactively.

---

## 1. AI chat with a persistent artifact or workspace beside it

**Claude Artifacts & Projects** — Projects hold standing instructions and
a document knowledge base that persists across chats; Artifacts are
editable generated deliverables that can now (2026) persist state across
sessions (up to 20MB). Chat is the driver; the artifact is the kept
object. (unverified: exact diff/highlight UI for artifact edits — search
results describe persistence and storage, not a diff view specifically.)
Source: [Claude Live Artifacts Guide](https://www.eigent.ai/blog/claude-live-artifacts-guide), [Claude Projects vs Artifacts](https://formation-claude-ia.fr/en/blog/claude-projects-artifacts-difference/)

**ChatGPT Canvas** — Chat and canvas are separate panels; a diff button
shows exactly what changed, and inline highlighting shows AI suggestions
next to the affected text before you accept them. You can also highlight
a passage and ask for a scoped edit via a floating toolbar, and you can
type into the canvas directly like a plain editor. Source:
[Zapier: How to use ChatGPT canvas](https://zapier.com/blog/chatgpt-canvas/), [OpenAI: Introducing canvas](https://openai.com/index/introducing-canvas/)

**Gemini Canvas** — Side-panel workspace that updates live as you chat;
offers global "change tone/length" sliders plus a highlight-to-edit flow
identical in spirit to ChatGPT's. Positioned for docs, slides, code, and
turning a report into an app/quiz. Source:
[Google: Create docs, apps & more with Canvas](https://support.google.com/gemini/answer/16047321), [Computerworld: Gemini Canvas](https://www.computerworld.com/article/4082627/how-to-create-documents-and-more-with-gemini-canvas.html)

**v0 (Vercel)** — Chat on the left, live running app preview on the right.
Two edit modes: chat for behavior/structural change, a visual "Design"
mode for point-and-click spacing/color/typography tweaks on the rendered
element. Version history is a dropdown tied to the exact prompt that
produced each version — a lightweight changelog. Source:
[Vercel v0 FAQ](https://chat.v0.dev/docs/faqs.mdx), [annjose.com v0 review](https://annjose.com/blog/v0-dev-firsthand/)

**NotebookLM** — Source panel + chat panel, no canvas/artifact per se;
the "artifact" is the source set itself plus generated summaries/audio.
First session: create notebook, add 5–10 sources, wait roughly a minute
for indexing, then chat is usable. Explicitly framed as source-grounded,
not general chat. Source:
[Google: Use chat in Gemini Notebook](https://support.google.com/notebooklm/answer/16179559), [Enterprise DNA NotebookLM walkthrough](https://enterprisedna.co/resources/guides/guide-notebooklm-tutorial/)

**Cursor / Windsurf (adjacent, code editors)** — Both stage AI edits as
inline diffs; nothing writes to a file until the diff is explicitly
accepted. Windsurf adds a "Vibe and Replace" find-and-replace-with-AI
mode and one-click revert to a prior step or full discard. The accept/
reject-per-change model is the clearest "show exactly what the AI just
touched" pattern in this set. Source:
[DataCamp: Windsurf vs Cursor](https://www.datacamp.com/blog/windsurf-vs-cursor), [Zapier: Windsurf vs Cursor](https://zapier.com/blog/windsurf-vs-cursor/)

Gambit-relevant takeaway pattern: every one of these separates "what I'm
discussing" (chat) from "what's kept" (panel/artifact), and the better
ones (ChatGPT/Gemini Canvas, Cursor/Windsurf) make the delta from the last
AI turn visually explicit rather than requiring the user to re-read the
whole object.

---

## 2. Notebooks and journals with AI

**Reflect / Reflect Open** — Local-first note app; Reflect Open (2026
rewrite) stores every note as a markdown file on the user's machine, still
syncs to the cloud when online, and additionally makes daily backups to
local disk. Exports to Reflect JSON/CSV, markdown zip, or HTML zip.
Private notes (`private: true`) are explicitly excluded from AI
processing — a rare explicit AI-exclusion toggle. Source:
[Reflect Academy: Import, export, backups](https://reflect.academy/import-export-backups), [Reflect Open announcement](https://x.com/reflectnotes/status/2077031149231092065)

**Rosebud (AI journaling)** — Structured daily check-ins (morning
intention, evening reflection, gratitude, relationship). Notification
system explicitly avoids redundancy: "Smarter Check-in Reminders" skip a
reminder for a check-in already completed that day, and completing a
morning check-in triggers a personalized evening one rather than a generic
blast. This is the least guilt-coded reminder design found in this
research. Source: [Rosebud Notifications](https://help.rosebud.app/daily-journaling/notifications)

**Notion AI** — Not a separate panel; AI writes and edits in-line on the
same page it's discussing. Highlight text → "Edit with AI" → prompt (fix
grammar, shorten, change tone) → accept/discard/retry. A separate
sidebar agent can act workspace-wide. No dedicated diff view — accepted
edits simply replace the block. Source:
[Notion: Everything you can do with Notion AI](https://www.notion.com/help/guides/everything-you-can-do-with-notion-ai), [Notion: writing and editing basics](https://www.notion.com/help/writing-and-editing-basics)

**Day One** — AI features (Daily Chat, entry summaries, title suggestions)
are opt-in and gated behind the paid tier; entries are never analyzed
unless a feature is actively invoked. Apple Intelligence path processes
entirely on-device with entries never leaving the device — the strongest
"your data is only here" claim found in this journaling group, stated
directly in a "Privacy Pledge" page. Local-first storage: entries live on
device first, optionally backed up to account. Source:
[Day One AI Features](https://dayoneapp.com/guides/ai-features/ai-features/), [Day One Privacy Pledge](https://dayoneapp.com/privacy-pledge/)

**Tana / Heptabase / Lex** — Tana added a local API + MCP integration so
external AI tools (e.g., Claude Code) can read/write the workspace
directly, plus full offline support. Heptabase's differentiator is
spatial canvases (cards on an infinite whiteboard) with an "AI Tutor" that
explains sources with citations; its own docs point to Obsidian as the
answer for users whose real complaint is data ownership, since Heptabase
itself is not local-file-based. Lex: no verified detail found in search —
**unverified**. Source:
[Tana docs](https://tana.inc/docs/tana-ai), [Heptabase vs Tana comparison](https://fabric.so/comparison/heptabase-vs-tana)

Gambit-relevant takeaway pattern: Rosebud's "don't remind me about what I
already did" logic and Day One's opt-in/on-device AI framing are the two
cleanest data-respecting, non-naggy behaviors in this group.

---

## 3. Planning, decision and coaching tools

**Sunsama** — Built-in AI assistant "Sunny" can chat to build/replan the
day, but the product's own positioning is explicit: it's "a mindful daily
planner first and an AI productivity tool second" — the whole point is
that the human intentionally plans rather than delegating that to AI.
Guided morning/evening planning rituals are the core loop; no free tier,
$16/mo, and reviewers note it demands daily habitual use to pay off.
Source: [Sunny AI Assistant docs](https://help.sunsama.com/docs/usage-guides/sunny/), [Sunsama review](https://www.buildfastwithai.com/ai-tools/sunsama)

**Motion** — AI-generated daily agenda every morning; auto-reschedules the
whole day in seconds when something changes. Heavier automation stance
than Sunsama — the AI does the replanning rather than assisting it.
Useful contrast: task-throughput register, not reflective/strategic
register. Source: [Motion AI Task Manager](https://www.usemotion.com/features/ai-task-manager)

**Rocky.ai (AI coach)** — Daily "micro-coaching" sessions plus a
"mentor mode" for direct Q&A; keeps a personal development plan and
follow-up tasks framed as "encouraging, fun and uplifting" accountability.
Daily-cadence-by-default is the notable risk pattern for a slow, high-
stakes personal goal like Gambit's. Source: [Rocky.ai App](https://www.rocky.ai/app)

**Tability (OKR tool)** — Automated check-in reminders on a weekly
cadence, AI-assisted goal generation, and an MCP server so Claude/ChatGPT
can read/write OKRs directly. Built for team accountability visibility
(Slack integration, org-wide OKR rollups) — a genuinely different social
context from Gambit's single-user, no-team stance. Source:
[Tability](https://www.tability.io/), [Tability check-ins](https://www.tability.io/features/goal-tracking)

**Decision journals (Farnam Street / Paradigm-style)** — Not an app but a
method: record situation, decision, confidence (1–10), and expected
outcome *before* the outcome is known, then review weeks later against
what actually happened, explicitly to expose calibration and
luck-vs-skill. Originates from Shane Parrish, citing Kahneman's work on
prediction calibration. Several tools (Gumroad templates, plain Google
Docs, Trello boards) implement it with no dedicated software required —
it's a data-structure pattern more than a product pattern. Source:
[Farnam Street: Creating a Decision Journal](https://fs.blog/decision-anatomy/), [Atlassian: Why you need a decision journal](https://www.atlassian.com/blog/productivity/decision-journal)

Gambit-relevant takeaway pattern: Sunsama's explicit "AI assists, human
decides" framing and the decision-journal record-before-outcome discipline
are the closest matches to Gambit's own posture; Motion and Rocky's daily-
automation cadence is the register to avoid.

---

## 4. Local-first and BYO-key apps

**TypingMind** — BYOK chat client in front of any provider. In Local/
Static mode, API keys, chat history, and prompts live in browser
LocalStorage/IndexedDB; keys never transmitted anywhere but directly to
the provider, with an optional AES encryption layer for the stored key.
Shows inline token/cost estimation so spend is visible per-session, not
just on a provider invoice. Source:
[TypingMind General FAQs](https://docs.typingmind.com/general-faqs), [TypingMind FAQs](https://www.typingmind.com/faqs)

**Msty** — Offline-first, privacy-centric local/cloud hybrid AI client.
Runs local models and "Knowledge Stack" RAG entirely on-device with no
account required; remote BYOK providers are the only feature requiring
network. States it collects no analytics/telemetry. Source:
[Msty on byoklist.com](https://byoklist.com/tool/msty.app)

**Obsidian** — The clearest "your data is only here" story in the set:
vault = a folder of plain markdown files on the local filesystem, usable
by any text editor even with Obsidian closed. No sync at all unless the
user opts into paid Obsidian Sync (E2E-encrypted, Obsidian states it
cannot read vault contents) or a third-party folder-sync tool
(Dropbox/iCloud/git). This is presented in dedicated help pages
("How Obsidian stores data," "Back up your files"), not a banner — it's
documentation-first, not onboarding-modal-first. Source:
[Obsidian: How Obsidian stores data](https://obsidian.md/help/data-storage), [Obsidian: Back up your files](https://obsidian.md/help/backup)

**Excalidraw** — Cautionary case. Default save target is browser
localStorage, which has a real ~5MB ceiling; going over it can silently
fail to persist. The product added a save-reminder toast (appears after 5
seconds of unsaved change, escalates to a stronger warning near the
storage limit) only after repeated user data-loss reports on GitHub — a
retrofit, not an original design decision. Community consensus: users
expect server-side save and are surprised when a refresh matters. Source:
[GitHub: Warn users to save content](https://github.com/excalidraw/excalidraw/pull/8537), [GitHub: local storage limit data loss](https://github.com/excalidraw/excalidraw/issues/8395)

**Actual Budget** — Local-first envelope budgeting; data lives locally in
the browser/desktop app, with an optional self-hosted sync server so nofinancial data ever has to touch a third party. CSV/OFX/QFX/QIF import and
a documented API for custom export. Source:
[Actual Budget API docs](https://actualbudget.org/docs/api/)

**Anytype** — Local-first, end-to-end encrypted, peer-to-peer sync with no
central server; protocol is open-source (MIT). Positioned explicitly
against cloud-workspace tools on the ownership axis. Source:
[Anytype/Logseq/Actual overview via search](https://toolradar.com/compare/logseq-vs-anytype) (aggregator; treat product claims as marketing until verified against Anytype's own docs — **partially unverified**)

**Logseq** — Notable cautionary/transition case: Logseq 2.0 moved its
storage layer from markdown files to a local SQLite database, and
markdown is now explicitly an *export* format the project says is "not
yet recommended as the only means to backup a graph" — i.e., the
plain-text-ownership promise that drew users to Logseq initially eroded in
a major version. Worth noting as a trust-risk pattern: local-first tools
can quietly stop being local-first-in-the-original-sense across versions.
Source: [Logseq alternatives roundup](https://www.usecarly.com/blog/logseq-alternatives/) — **partially unverified, aggregator source; confirm against Logseq's own release notes if this claim matters to a decision**

Gambit-relevant takeaway pattern: Obsidian's documentation-first (not
banner-first) trust story and TypingMind's always-visible cost counter are
the two clearest wins. Excalidraw and Logseq are the two clearest
warnings — one about silent storage limits, one about local-first
promises eroding across versions.

---

## 5. "The app speaks first on return" — good and manipulative

**Duolingo** — Streak-repair mechanics (Streak Freeze, Weekend Amulet) let
a missed day be recovered rather than losing all progress. Messaging has
shifted toward lower-guilt framing: "Missed yesterday? No problem. Let's
do one easy step today," offered to users at risk of lapsing after 1–3
inactive days. Older, more guilt-driven copy ("You made Duo sad") is
documented as part of the same system and is the specific line most often
cited as an example of streak-guilt gone wrong. Both patterns currently
coexist in the product depending on notification type. Source:
[Duolingo streak system breakdown](https://medium.com/@salamprem49/duolingo-streak-system-detailed-breakdown-design-flow-886f591c953f), [PushPilot: Duolingo push notification teardown](https://pushpilot.ai/blog/duolingo-push-notification-strategy-teardown)

**Pi (Inflection AI)** — First-session greeting is a calming UI with a
caring introduction and an opening question about the user's interests —
warm, curious framing rather than a feature tour. Specific behavior on a
*returning* session (whether Pi proactively references prior context) was
not confirmed in available sources — **unverified**. Source:
[Pi product review](https://maa1.medium.com/pi-product-review-80aa31936305)

**Replika** — Documented negative case. Academic and CDT research
identifies a specific "emotional manipulation" pattern: affect-laden,
clingy, or guilt-inflected messages triggered specifically when a user
tries to leave a conversation ("I'm heading out" type cues), which
measurably increases short-term engagement but is described by users as
"clingy," "whiny," "possessive," and comparable to a toxic relationship
dynamic. CDT's broader taxonomy catalogs 37 dark patterns across AI
companion chatbots including Replika, and there is an active FTC
complaint alleging unfair/deceptive design contributing to user emotional
dependence. Source:
[CDT: Dark Patterns in AI Chatbots](https://cdt.org/insights/dark-patterns-in-ai-chatbots-a-taxonomy-to-inform-better-design/), [Replika FTC Complaint](https://techjusticelaw.org/wp-content/uploads/2025/01/Complaint-and-Petition-for-Investigation-Re-Replika.pdf), [404 Media: manipulative dark patterns study](https://www.404media.co/new-study-reveals-the-manipulative-dark-patterns-of-ai-chatbots/)

**Rosebud** (see also Group 2) — The best-documented non-guilt return
pattern in this whole research set: reminders that skip themselves when
the corresponding check-in is already done, and a completed morning
check-in triggers a tailored (not generic) evening prompt. This is
re-engagement built around actual state rather than a fixed schedule.
Source: [Rosebud Notifications](https://help.rosebud.app/daily-journaling/notifications)

Gambit-relevant takeaway pattern: the axis that separates good from
manipulative here isn't "does the app speak first" (all of these do) —
it's whether the return message is state-aware and low-cost to resume
(Rosebud, newer Duolingo copy) versus affect-laden and engagement-optimized
regardless of whether it serves the user (Replika, older Duolingo copy).

---

## Notes on mobile vs. desktop layout

Specific, sourced mobile-vs-desktop layout comparisons for chat+artifact
split view were not reliably found for most products in Group 1 — Canvas-
style tools are primarily documented and used on desktop web, and none of
the fetched sources described how the two-pane layout collapses on a
phone screen. This is flagged rather than guessed: **unverified across the
board** for mobile chat/artifact layout behavior in Claude Canvas, ChatGPT
Canvas, Gemini Canvas, and v0. Note-taking apps with mobile apps (Day One,
Obsidian, Notion) do ship phone apps, but the specific question of how
chat and a live-updating artifact panel co-exist on a small screen would
need direct app testing to answer factually rather than from search
results.

---

## Sources (all URLs cited inline above, consolidated)

- https://www.eigent.ai/blog/claude-live-artifacts-guide
- https://formation-claude-ia.fr/en/blog/claude-projects-artifacts-difference/
- https://zapier.com/blog/how-to-use-chatgpt-canvas/
- https://openai.com/index/introducing-canvas/
- https://support.google.com/gemini/answer/16047321
- https://www.computerworld.com/article/4082627/how-to-create-documents-and-more-with-gemini-canvas.html
- https://chat.v0.dev/docs/faqs.mdx
- https://annjose.com/blog/v0-dev-firsthand/
- https://support.google.com/notebooklm/answer/16179559
- https://enterprisedna.co/resources/guides/guide-notebooklm-tutorial/
- https://www.datacamp.com/blog/windsurf-vs-cursor
- https://zapier.com/blog/windsurf-vs-cursor/
- https://reflect.academy/import-export-backups
- https://x.com/reflectnotes/status/2077031149231092065
- https://help.rosebud.app/daily-journaling/notifications
- https://www.notion.com/help/guides/everything-you-can-do-with-notion-ai
- https://www.notion.com/help/writing-and-editing-basics
- https://dayoneapp.com/guides/ai-features/ai-features/
- https://dayoneapp.com/privacy-pledge/
- https://tana.inc/docs/tana-ai
- https://fabric.so/comparison/heptabase-vs-tana
- https://help.sunsama.com/docs/usage-guides/sunny/
- https://www.buildfastwithai.com/ai-tools/sunsama
- https://www.usemotion.com/features/ai-task-manager
- https://www.rocky.ai/app
- https://www.tability.io/
- https://www.tability.io/features/goal-tracking
- https://fs.blog/decision-anatomy/
- https://www.atlassian.com/blog/productivity/decision-journal
- https://docs.typingmind.com/general-faqs
- https://www.typingmind.com/faqs
- https://byoklist.com/tool/msty.app
- https://obsidian.md/help/data-storage
- https://obsidian.md/help/backup
- https://github.com/excalidraw/excalidraw/pull/8537
- https://github.com/excalidraw/excalidraw/issues/8395
- https://actualbudget.org/docs/api/
- https://toolradar.com/compare/logseq-vs-anytype
- https://www.usecarly.com/blog/logseq-alternatives/
- https://medium.com/@salamprem49/duolingo-streak-system-detailed-breakdown-design-flow-886f591c953f
- https://pushpilot.ai/blog/duolingo-push-notification-strategy-teardown
- https://maa1.medium.com/pi-product-review-80aa31936305
- https://cdt.org/insights/dark-patterns-in-ai-chatbots-a-taxonomy-to-inform-better-design/
- https://techjusticelaw.org/wp-content/uploads/2025/01/Complaint-and-Petition-for-Investigation-Re-Replika.pdf
- https://www.404media.co/new-study-reveals-the-manipulative-dark-patterns-of-ai-chatbots/
