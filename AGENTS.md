# Gambit — Repo Instructions

Gambit is a local-first PWA: a strategic-advisor chat agent that applies a
set of prompt-based skills against a single goal, shown live on a dashboard
beside the chat. No backend, no accounts — goals, chat history, and the
user's own model API key live in the browser (IndexedDB). The user brings
their own key — Anthropic, OpenAI, OpenRouter, or any OpenAI-compatible
endpoint.

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
  src/ops.mjs         goal operations (write_section / append_log / set_status semantics)
  src/registry.mjs    display registry — maps each owned key to a dashboard renderer
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

`onboard` is the front door: it checks whether the goal is still a stub and
branches to `intake` (first-contact setup) or a welcome-back snapshot for a
returning session, then hands off to `strategy`. Other skills should assume
a real goal already exists — `strategy` defers to `onboard` if it doesn't,
rather than re-implementing intake.

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
100 characters each), listed on the Goal page under "Parts of this goal."
`subGoals` is distinct from `successCriteria`: a sub-goal is a condition on
the aim itself, a success criterion is a measurable definition of done.

Each key has exactly one owning skill, which replaces its own key's value
in place rather than accumulating:

- `subGoals` ← `intake` (same owner as `goal`)
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

`log` is the only append-only key, capped at the newest 30 entries —
`append_log` (`packages/core/src/ops.mjs`) drops the oldest entries past
that cap, except it always keeps the most recent entry that carries a
`focusLine`, even when older than the cap, since the dashboard's
highlighter reads it. Chat history is a rolling window, not a persisted
transcript: only the newest messages are kept in storage per goal (see
`CHAT_WINDOW` in `apps/pwa/src/lib/agent.ts`), and the model request applies
a further character budget on top of that (`HISTORY_CHAR_BUDGET`), dropping
the oldest whole turns first. The goal record is the durable memory across
both caps — old chat and old log entries are safe to lose because the
current goal state captures what matters.

Ownership is per key, not per full rewrite — `plan` owns
`nextActions[].status` even for a single-field flip. When the user simply
reports a next-action item done, blocked, or dropped in passing, that still
routes to `plan`'s lightweight status-update mode rather than sitting
unrecorded. Nothing else writes that field.

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
  dashboard knows how to draw its output. It needs a next-step section, an
  elicitation checkpoint if it writes to the goal, and — if it writes a new
  key — a declared entry in `goalSchema` plus a matching entry in
  `packages/core/src/registry.mjs`.
- Deploy is Vercel: the root `vercel.json` sets build and routing. Its CSP
  header must match the CSP the build itself emits — a test enforces this,
  so a change to one requires the matching change to the other.
