# Gambit — Repo Instructions

Gambit is a local-first PWA: a strategic-advisor chat agent that applies a
set of prompt-based skills against a single goal, shown live on a dashboard
beside the chat. No backend, no accounts — goals, chat history, and the
user's own model API key live in the browser (IndexedDB). The user brings
their own key — Google AI Studio (the default), Anthropic, OpenAI, or any
OpenAI-compatible endpoint (OpenRouter included).

This file is for coding agents working ON this repo, not the product's own
system prompt — the app's runtime instructions to the model live in
`apps/pwa/src/lib/skills.ts` (`PREAMBLE`) and in `skills/_shared/GUIDED.md`.

## Repository structure

```
apps/pwa/            the app — Vite + React + Dexie
  src/lib/           storage, agent loop, tools, providers, skills bundling
  src/components/    chat, dashboard (driven by packages/core's display registry), settings
  skills/            PWA-native skills: intake, elicit
  vendor/BMAD/       vendored elicitation method catalog (methods.csv, LICENSE, ATTRIBUTION.md)

packages/core/        shared logic, framework-agnostic
  src/schema.mjs      the Zod schema (goalSchema) — authoritative contract
  src/read.mjs        version-aware read path + in-code migrations
  src/ops.mjs         goal operations (write_section / append_log / set_status / remember / forget)
  src/registry.mjs    display registry — maps each owned key to a dashboard renderer
  src/flow.mjs        skill flow — load and write gates, due-skill suggestions
  src/rules.mjs, index.mjs

skills/               skill catalogue, bundled into the app at build time
  _shared/GUIDED.md    the guided-session rules (see below)
  _shared/HUMANIZE.md  writing-voice rules
  _shared/NO_HISTORY.md current-state-only rule for every goal write
```

Skills under `skills/` ship with the app via build + redeploy — there is no
runtime updater. A new or changed skill goes out on the next Vercel deploy.

## The skill catalogue

Each skill is a self-contained `SKILL.md`: trigger, purpose, voice, and an
execution sequence, grouped by what kind of move it makes.

**ORIENT**
| Skill | Purpose |
|---|---|
| `onboard` | entry point — new goal intake, or welcome-back for a returning one |
| `brief` | plain-language read of current state, jargon translated, read-only |
| `status` | read-only snapshot in the system's own terms, no writes |

**DIRECT**
| Skill | Purpose |
|---|---|
| `strategy` | assess progress, set posture, set focus (Schwerpunkt) |
| `systems` | CoG / PMESII / ASCOPE analysis, find the leverage point |
| `plan` | sequence the goal into a dependency-aware plan |
| `decide` | work an open choice to a recorded decision with a reverse-if condition |

**ESTABLISH**
| Skill | Purpose |
|---|---|
| `experiment` | smallest falsifiable test of an assumption, threshold set in advance |
| `forecast` | dated falsifiable predictions, scored later for calibration |

**STRESS**
| Skill | Purpose |
|---|---|
| `threat` | red-team the plan, assess network exposure |
| `premortem` | prospective hindsight — stipulate failure, explain it backwards |
| `exposure` | personal legal / financial / professional / safety risk |
| `capacity` | operator's real hours, money, energy, runway |

**PEOPLE**
| Skill | Purpose |
|---|---|
| `stakeholders` | map power and interests of third parties; find the movable middle |
| `negotiate` | prep a two-way conversation — interests, BATNA, ZOPA, concessions |
| `comms` | frame and sharpen outward communication |

**ASSESS**
| Skill | Purpose |
|---|---|
| `eval` | independent audit of progress against the goal |
| `review` | after-action review of a completed event — expected vs actual |

`intake` and `elicit` (`apps/pwa/skills/`) are PWA-native: `intake` runs
first-contact goal setup in place of a CLI's file-creation step, and
`elicit` is the pressure-test-before-committing checkpoint other skills
call. `elicit`'s method catalog (`apps/pwa/vendor/BMAD/methods.csv`) is
vendored from [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) —
attribution and license in the same directory.

The set draws on several domains deliberately, and the divisions matter
when extending it. Operational planning doctrine supplies `strategy`,
`systems`, `plan`, `threat`, `review`. Negotiation and stakeholder theory
supply `stakeholders` and `negotiate`. Forecasting and behavioural science
supply `forecast` and `premortem`. Lean experimentation supplies
`experiment`. Operations and risk supply `capacity` and `exposure`.

Skills that look adjacent are kept separate because they ask genuinely
different questions, and collapsing them loses the distinct one:

- `threat` red-teams from outside; `premortem` stipulates failure and reasons
  backwards. The second reliably surfaces what the first misses.
- `threat` covers exposure of the effort; `exposure` covers exposure of the
  person.
- `eval` audits progress toward the goal; `review` extracts lessons from a
  finished action.
- `systems` finds the culminating point abstractly; `capacity` finds it in
  the operator's actual hours and money.
- `comms` prepares outward broadcast; `negotiate` prepares a two-way
  exchange where the other side has leverage.

`onboard` is the front door: it branches to `intake` (first-contact setup)
for a stub goal or a welcome-back snapshot for a returning session, then
hands off to `strategy`. Other skills assume a real goal already exists and
never re-implement intake; the flow gate below refuses to load them on a
stub.

## The skill flow

The session rules the product depends on are checked in code
(`packages/core/src/flow.mjs`, called from the agent tools in
`apps/pwa/src/lib/tools.ts`), not left to the model's memory of the prompt.
Each skill declares its place in the flow in its `SKILL.md` frontmatter:

- `writes` — the keys it may write (`log` for `append_log`)
- `requires` — `goal` (needs a defined goal) or `any`
- `next` — the skills it naturally hands off to
- `reads` — the keys its section is built from (the section is the first
  key in `writes`)
- `checkpoint: true` — runs inside the active skill instead of replacing it
  (`elicit`)

The gates:

- `load_skill` refuses a `requires: goal` skill while the goal is a stub
  and points to `intake`.
- `write_section`, `set_status` and `append_log` need an active skill whose
  `writes` holds the key; with no active skill, none of them writes.
  `remember` and `forget` (the `memory` key) are the exception: they
  record what the user just said, whatever skill is active.
- `write_section` is refused in the turn its skill was loaded: the skill
  shows its read as a `confirm` reply and writes after the user answers
  (GUIDED.md's elicit-before-committing). Status flips and log entries
  record what the user just said, so they pass.
- A checkpoint skill keeps its caller's write rights; `finish_skill` from it
  hands back to the caller. From any other skill, `finish_skill` ends it.

A refusal comes back as a tool error naming the rule, so the model fixes it
in the same turn. Each turn's state block also names the active skill and
what the goal says is due now (`suggestSkills`: forecasts to score,
experiments past their date, decisions to review, no posture or plan, a
stale focus, an overdue `eval`, unchecked capacity, and any section built
before one of its `reads` changed).

`writeSection` stamps each key it changes in the goal's `updated` map.
`staleSections` (`flow.mjs`) compares those stamps: when `stakeholders`
changes after `systemsNotes` was last written, `systems` is due with
"stakeholders changed since systems last ran". A section with no stamp of
its own falls back to its `lastReviewed`. A skill whose section draws on
other keys declares them in `reads`, so the dependency is checked in code
rather than remembered.

## The goal contract

Every skill reads and writes a single goal record. `packages/core/src/schema.mjs`
(`goalSchema`, Zod) is the authoritative contract — any human-readable
summary here or in a skill's own `SKILL.md` yields to the schema if they
ever disagree. The record holds the goal, success criteria, deadline, an
optional `people` array and `posture` object, the current plan, and a
running log.

The goal sentence itself is capped at **10 words** on every new write —
plain, one idea, no dash-joined clauses. This is enforced on the write path
(`writeSection` in `packages/core/src/ops.mjs`), not in the schema itself,
so an existing goal written before this rule still reads fine; the owning
skill proposes a shorter sentence, confirms it with the user, and writes it
on the next touch. Parts or conditions of the aim that don't fit in that
one short sentence — the clause that used to follow a dash — go in the
optional `subGoals` key instead: up to 5 short entries (about 12 words /
100 characters each), listed on the Goal page as a short list under the title.
`subGoals` is distinct from `successCriteria`: a sub-goal is a condition on
the aim itself, a success criterion is a measurable definition of done.

Each key has one owning skill, which replaces its own key's value in place
rather than accumulating. Which skills may write a key is the `writes`
frontmatter above; the owners are:

- `goal`, `subGoals`, `successCriteria`, `deadline`, `people` ← `intake`
- `posture` ← `strategy`
- `plan` ← `plan`
- `systemsNotes` ← `systems`
- `riskNotes` ← `threat`
- `decisions` ← `decide`
- `stakeholders` ← `stakeholders`
- `exposure` ← `exposure`
- `capacity` ← `capacity`
- `forecasts` ← `forecast`
- `experiments` ← `experiment`
- `criteriaStatus` ← `eval`

A few skills also write a key they don't own, for one narrow purpose:
`plan` sets each success criterion's `lineOfOperation`, and `stakeholders`
moves someone into `people` once the user deals with them directly and
keeps `people[].status` current.

`updated` holds when each key last changed. Only `writeSection` writes
it; no skill does, and it is left out of the goal state the model reads.

`memory` holds what the user told the advisor that no owned key holds:
`{ kind: fact | preference | constraint | rejected, text, date }`, at most
20 entries (`MEMORY_CAP`). No skill owns it. The `remember` and `forget`
tools edit it one entry at a time, from any skill or none, because the
user says these things at any point. `remember` (`packages/core/src/ops.mjs`)
refuses an entry that says the same as an existing one and points at it,
and refuses a 21st. Either way the model has to pass `replaces` with the
entry's index, so a correction overwrites what it corrects and nothing
drops off silently. The whole list is in every turn's goal state, so
nothing needs retrieving. `rejected` entries are the moves the user turned
down, which the advisor doesn't propose again. The user can strike any
entry from the Settings page.

`log` records what happened in each exchange, not where things stand: the
owning keys hold that. An entry has at most 3 notes (`LOG_NOTES_MAX`), and
`append_log` refuses a note that says the same as one in the newest 5
entries (`LOG_RECENT`, the same entries the model reads each turn) or in
its own entry. `sameLine` makes that call: at least 4 content words in
common, covering 60% of the shorter line's.

`log` is the only append-only key, capped at the newest 30 entries —
`append_log` (`packages/core/src/ops.mjs`) drops the oldest entries past
that cap, except it always keeps the entry holding the current focus
(`currentFocusEntry`: the newest entry that sets a `focus`, from `strategy`),
even when older than the cap, since the dashboard's highlighter reads its
`focusLine`. Only `strategy` names that line: `append_log` stamps each
entry's `source` with the writing skill and drops a `focusLine` from any
other skill. A newer focus with no single line clears the highlight rather
than leaving an old one on the page. Chat history is a rolling window, not a persisted
transcript: only the newest turns are kept in storage per goal (see
`CHAT_TURNS` in `apps/pwa/src/lib/agent.ts`), counted the same way for the
model's history and the chat the user sees, and the model request applies
a further character budget on top of that (`HISTORY_CHAR_BUDGET`), dropping
the oldest whole turns first. The goal record, `memory` included, is the
durable memory across both caps. Old chat and old log entries are safe to
lose because the current goal state captures what matters.

A name lives in `people` or `stakeholders`, never both — two owners writing
about one person drift apart, and the stale copy reads as current.
`writeSection` (`packages/core/src/ops.mjs`) refuses a `stakeholders` write
that names someone in `people`, and a `people` write takes that person off
`stakeholders`. A record written before this rule can still hold both; it
reads fine, the People page shows that person once, and `reconcileGoal`
warns until `stakeholders` is rewritten without them.

Ownership is per key, not per full rewrite — `plan` owns
`nextActions[].status` even for a single-field flip. When the user simply
reports a next-action item done, blocked, or dropped in passing, that still
routes to `plan`'s lightweight status-update mode rather than sitting
unrecorded. No other skill writes that field.

The user can also edit the page directly, outside the skill flow. They can
reword a move, step, sub-item, success criterion, sub-goal, the goal
sentence, a risk, what a person is doing, or an open decision's question.
They can also add a `pending` move, and tick, keep or toss one. Names stay
chat-only, because they keep `people` and `stakeholders` apart. A decided
decision changes only through `decide`. Forecasts and experiments aren't
editable at all, because their worth is being fixed in advance. Text edits go
through `editLine` and `addNextAction` (`packages/core/src/ops.mjs`), which
call `writeSection`. So a page edit meets every write rule a skill write
does (schema caps, grade-7 reading level, the goal word cap) and stamps
`updated`. `editLine` takes the text the user started from and refuses the
edit if the line changed since then. One table in `ops.mjs` (`LINES`) says which field holds
each line's text and whether it is editable. `lineText` and
`isEditableLine` read it, and so does the page's change diff
(`apps/pwa/src/lib/changes.ts`). Every page edit, status flips included, is queued on the chat record
(`pendingEdits`, `apps/pwa/src/lib/edits.ts`). The next turn's state block
lists the queue as the user's own word, and the queue clears once that turn
completes.

A move the advisor suggests that the user hasn't agreed to yet is written
as a next action with `status: "proposed"`, which the page shows as a
sticky note. The user keeping or tossing it flips that status to
`pending` or `dropped`; nothing else promotes it.

`premortem` and `review` deliberately own no key — they append to
`riskNotes` and `plan.nextActions` respectively, labelled with their
source, so findings live where the owning skill will see them. A new skill
that writes to the goal needs its own declared key in `goalSchema` plus an
entry in `packages/core/src/registry.mjs` — a write to an undeclared key
fails validation.

Success criteria carry a `control` or `influence` marker. `control` means
the user can cause it directly; `influence` means it depends on someone
else's decision. `eval` scores them differently, and skills should not
treat a stalled influence criterion as a failure of execution.

Goal text is held to a grade-7 Flesch-Kincaid reading level, enforced on
the write path (`plainLanguage` in `packages/core/src/readability.mjs`, run
by `writeSection` and `append_log`) and, like the goal word cap, never on
read. Only strings of 12+ words are scored — the formula is noise on short
labels — and capitalized names and acronyms past a sentence's first word
are left out of the count.

The goal always reads as current state, not a history of how it got
there — skills replace a key's value in place rather than layering
"(updated)" notes into it. History belongs in `log`, not the rest of the
record.

## Guided-session rules

`skills/_shared/GUIDED.md` is the product prompt text the app bundles into
every session — elicit-before-committing, staying opinionated through
pushback, always leaving a next step, closing on a decision not a
narrative, and the formatting and validation rules that go with them.
Skills reference it rather than restating it; so does this file. Read it
there rather than assuming a duplicate summary is current.

`skills/_shared/HUMANIZE.md` and `skills/_shared/NO_HISTORY.md` are the
writing-voice and current-state-only rules applied to skill output and
every goal write — same treatment, read them rather than duplicating them.

## Working on this repo

- Root scripts: `npm run dev`, `build`, `preview`, `test`, `typecheck`,
  `check`. `npm run check` is what CI runs — it must pass after touching
  anything in `packages/core` or `apps/pwa`.
- Schema changes happen once, in `packages/core/src/schema.mjs` — every
  reader (the store, the dashboard, the agent tools) validates through it.
  Changing a field's shape or constraints happens there, not independently
  in each reader.
- Adding a skill: give it its own `skills/<name>/` directory with a
  `SKILL.md` carrying YAML frontmatter (`name`, `description`, `display` —
  one of the renderer types in `packages/core/src/registry.mjs`) so the
  dashboard knows how to draw its output, plus the flow fields (`writes`,
  `requires`, `next`) described under "The skill flow" — a test checks
  them against the goal keys and the other skills. It needs a next-step section, an
  elicitation checkpoint if it writes to the goal, and — if it writes a new
  key — a declared entry in `goalSchema` plus a matching entry in
  `packages/core/src/registry.mjs`.
- Deploy is Vercel: the root `vercel.json` sets build and routing. Its CSP
  header must match the CSP the build itself emits — a test enforces this,
  so a change to one requires the matching change to the other.
