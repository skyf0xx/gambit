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
| `brief` | plain-language read of current state, jargon translated; also a terse quick snapshot, read-only |
| `sitrep` | take several updates at once and route each to the skill that writes it |

**DIRECT**
| Skill | Purpose |
|---|---|
| `strategy` | assess progress, set posture, set focus (Schwerpunkt) |
| `systems` | CoG / PMESII / ASCOPE analysis, find the leverage point |
| `plan` | sequence the goal into a dependency-aware plan of linked tasks: what waits on what, what escalates if a message gets no reply, what happens only if something occurs |
| `options` | develop and wargame up to three distinct courses of action, recommend one |
| `decide` | work an open choice to a recorded decision with a reverse-if condition; also a quit check with kill criteria |

**ESTABLISH**
| Skill | Purpose |
|---|---|
| `experiment` | smallest falsifiable test of an assumption, threshold set in advance |
| `forecast` | dated falsifiable predictions, scored later for calibration |
| `recon` | priority intelligence requirements: dated questions with a way to find out, answers recorded |

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
| `negotiate` | prep a two-way conversation — interests, BATNA, ZOPA, concessions — one `prep` entry per counterpart, then a debrief that records the outcome |
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
`systems`, `plan`, `threat`, `review`; `options` draws on the same
doctrine's course-of-action development and wargaming, and `recon` on its
intelligence requirements. Negotiation and stakeholder theory
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
- `recon` finds out what is already knowable (ask, look up); `experiment`
  tests an assumption by acting; `forecast` predicts what hasn't happened.
- `options` builds the distinct courses and wargames them; `decide` takes
  one open choice, however it arose, to a recorded call with a reverse-if.
- `comms` prepares outward broadcast; `negotiate` prepares a two-way
  exchange where the other side has leverage.

`onboard` is the front door: it branches to `intake` (first-contact setup)
for a stub goal or a welcome-back snapshot for a returning session, then
hands off along the method. Other skills assume a real goal already exists
and never re-implement intake; the flow gate below refuses to load them on
a stub.

## The method

Every goal moves through one fixed cycle, so skills follow one order
rather than whichever comes to mind. It follows the military planning
process (US Army FM 5-0, Joint Publication 5-0): understand the situation,
develop courses of action, decide, plan with branches, then assess and
loop. Each skill declares its phase in its frontmatter (`phase:`).

| # | Phase | Question | Skills | Done when |
|---|---|---|---|---|
| 1 | `define` | What exactly do we want? | `intake` | the goal is not a stub |
| 2 | `understand` | Who decides, what moves them, what can we spend? | `stakeholders`, `systems`, `capacity`, `recon` | `stakeholders` mapped, if any criterion is `influence` |
| 3 | `direct` | Where do we push, and how hard? | `strategy` | a focus is set (`posture`, or a `strategy` log entry with a focus) |
| 4 | `develop` | What are the real routes? | `options`, `decide` | a course is `chosen`; needed only for an `influence` goal with no plan yet, or courses with none chosen |
| 5 | `plan` | What happens, in what order, and what if it stalls? | `plan` | a plan whose focus line carries a conditional task (an escalation or a fork) |
| 6 | `stress` | How does it fail, and what does it cost the user? | `threat`, `premortem`, `exposure` | a `threat` risk, if the goal rests on others or the plan escalates; an `exposure` entry, if a `power` escalation is still to go |
| 7 | `run` | What happened, what now? | `sitrep`, `comms`, `negotiate`, `forecast`, `experiment`, `review`, `eval` | never: it loops back to `direct` on a review, a stale focus, or a branch taken |

`onboard`, `brief` and `elicit` sit outside the cycle (`phase: any`).

How much each phase asks scales with the goal, read from the goal itself
rather than a size the user picks. A goal that rests on other people's
decisions (an `influence` criterion) needs its stakeholders mapped, its
routes compared and its plan red-teamed. A picnic or a running habit goes
from focus to plan in two turns. The one requirement every goal shares is
the phase order and a conditional task on the plan's focus line.

`methodStep` (`packages/core/src/flow.mjs`) derives the first phase not yet
done from the goal; nothing about the method is stored. Escalation follows
the same sources: a plan's forks are that doctrine's branches at decision
points, and its escalations climb interests → rights → power (Ury,
Brett & Goldberg, *Getting Disputes Resolved*): ask whoever can fix it, then
use formal channels, then go public.

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
- `phase` — its place in the method (`define`, `understand`, `direct`,
  `develop`, `plan`, `stress`, `run`), or `any` for a skill outside it

The gates:

- `load_skill` refuses a `requires: goal` skill while the goal is a stub
  and points to `intake`. A skill further on in the method than the goal
  has reached still loads, with a warning naming the skipped phase; the
  model says so in one line and offers that phase's skill first.
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
- `route_updates` is accepted only while `sitrep` is active. It checks
  that each routed skill exists and writes something (`canRoute`), and
  stores the routing on the session (`routed`), which the chat record
  keeps for the next turn. `sitrep` shows the routing as a `confirm`
  reply. In the turn that answers it, each routed skill is in the
  session's `cleared` list, so its `write_section` passes in the turn it
  loads, and the state block lists the confirmed updates for the model to
  load and write one after another. Clearance lasts that one turn: the
  turn ends by storing its own routing, if any, in place of the old one.

A refusal comes back as a tool error naming the rule, so the model fixes it
in the same turn. Each turn's state block also names the active skill,
where the goal sits in the method (`methodText`), and what the goal says is
due now, most pressing first (`suggestSkills`; `dueNow` gives the top three
the state block and the page show). Dated items come first: forecasts to
score, experiments past their date, live moves past their `when`, an
escalation come due (its message went out with no reply for its `days`), a
reply with nothing recorded of what they said, a fork past its `by` with
its event unsettled, a milestone whose every task was dropped, open
`intel` questions due, a `prep` talk
past its date with no outcome, decisions to review, a deadline within 14
days with no premortem risk. Then the method's next phase. Then the reviews
that keep a running goal honest: a stale focus, an overdue `eval`,
unchecked or stale capacity. Last, any section built before one of its
`reads` changed.

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
- `intel` ← `recon`
- `courses` ← `options`
- `prep` ← `negotiate`

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

`intel` holds open questions whose answer would change the plan, each
with how to find out (`via`), an optional date to know by (`by`), and its
answer once it comes in; at most 8. `courses` holds up to 3 distinct
courses of action, compared side by side, with at most one `chosen`.
`prep` holds up to 5 two-way conversations to prepare: who it is with (a
`people` or `stakeholders` name, verbatim), when (`on`), the ask, the
BATNA, the walk-away line, up to 5 concessions, and `done` plus `outcome`
once it has happened.

A plan line's next actions are tasks that can point at each other, so
ordering, escalation and forks are links the page draws, not words the
model writes into a move (`packages/core/src/schema.mjs`). A task is a
plain todo plus, optionally:

- `id`: a short slug, unique in the plan, for a task others point at.
- `after: [ids]`: the tasks it waits on. It is `blocked` until they are
  done (a dropped one no longer holds it).
- `to`: a message's recipient, a `people` or `stakeholders` name, verbatim,
  never the user ("me", "you"); a skill write naming anyone else is
  refused, and `reconcileGoal` warns when a later write drops that name.
  Done means it went out, and `doneOn` starts the wait of any escalation
  of it. `replied` is the date they answered and `reply` what they said.
- `if: {noReply: id, days}`: an escalation of that message. It needs `to`
  and a `level` (`interests` → `rights` → `power`, never lower than the
  message it follows), and is `waiting` until the message went out, got no
  reply, and `days` passed.
- `if: {event, by?, happened?}`: a fork, a move made only if the event
  happens. `waiting` until `happened`; a fork that didn't happen is
  dropped. The event is one phrase of at most 8 words (`BRANCH_MAX_WORDS`),
  with no leading "if", no colon, semicolon or second sentence, and no
  absence in headline form ("names no", "sets no": say "hasn't set"
  instead); `writeSection` saves it starting in lower case unless its first
  word is a name. The reading-grade check can't catch a run-on or
  headline-speak line of short words, so these are rules of their own, on
  the write path only.

`taskState` reads a task as `blocked`, `waiting` or `live`; only a live
task is a move to make now, so only a live one can be the top move, count
as overdue, or go on the calendar. Links point at real tasks and never loop.
A conditional task is a fork: its move is one the user wouldn't make
otherwise, so one saying the plan carries on ("anyway", "still", "keep
chasing", "continue"), or matching a move already in the plan
unconditionally, is refused. The focus line (else the first) must carry at
least one conditional task, and a `plan` write without one is refused
(page edits are let through, since they change one line's text, not the
plan's shape). A line with no natural fork carries the one every plan has:
no measurable progress by a date, then rethink the approach (back to
`strategy`). A line holds up to 10 tasks (`NEXT_ACTIONS_MAX`), waiting ones
included.

The line's `criticalPath` steps are its milestones: points it passes, not
things to do: `{id, label, detail?, after}`, with no status and no
sub-items. A milestone shares the plan's ids with the tasks: it lists in
`after` the tasks that reach it, and a task may list a milestone in its own
`after`, staying `blocked` until the milestone is reached. Reaching is
derived, never stored: `milestoneReached` (`schema.mjs`) holds once every
task it lists is done or dropped, with at least one done, so unticking a
task un-reaches it, and `set_status` on a milestone is refused. Every
milestone has an id and lists at least one task, or the `plan` write is
refused; the due list flags an older one that lists none ("Link milestones
to their moves") and one whose every task was dropped ("Find a new way
to").

A task is something to do; a milestone is something that becomes true. So
the page never gives a milestone a box. It draws it as a checkpoint, the
way a notebook draws a line under a column of figures and writes the total
beneath: a line under the tasks that reach it, then its name, a size
smaller than a task and not bold, beside a diamond in the marker column.
The diamond is open until those tasks are done, then filled, with the day
it was reached pencilled beside it. A passed milestone stays in place with
its line in ink; the one the plan is heading to has a pencil line; one
further on has a faint broken line and its name in grey. Done tasks never
fold away: they stay where they were, ticked and grey, so a passed
milestone keeps the moves that reached it above its line. A task no
milestone lists sits before the one the line is heading to. The top move,
on the index card, is listed in its place too, so its milestone always
has the move toward it above its line.

A next action's `when` is the date it is due by (YYYY-MM-DD), optional.
`doneOn` is the date it was done: `setStatus` stamps it with today when the
action flips to `done` and removes it on any other status. A `plan`
rewrite keeps a valid `doneOn` the model passes, carries it over for an
action still done under the same text, stamps today on one newly done, and
drops it from any action not done.

Ownership is per key, not per full rewrite — `plan` owns
`nextActions[].status` even for a single-field flip. When the user simply
reports a next-action item done, blocked, or dropped in passing, that still
routes to `plan`'s lightweight status-update mode rather than sitting
unrecorded. No other skill writes that field.

The user can also edit the page directly, outside the skill flow. They can
reword a move, milestone, success criterion, sub-goal, the goal
sentence, a risk, what a person is doing, or an open decision's question.
They can also add a `pending` move, and tick, keep or toss one, mark a sent
message replied (`markReplied`), and settle a waiting fork as happened or
not (`resolveFork`). Names stay chat-only, because they keep `people` and
`stakeholders` apart. A decided decision changes only through `decide`,
and the links between tasks only through `plan`. Forecasts and experiments aren't
editable at all, because their worth is being fixed in advance; nor are
`intel`, `courses` and `prep`, which change through their skills. Text edits go
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
  `requires`, `next`, `phase`) described under "The skill flow" — a test
  checks them against the goal keys, the method's phases and the other
  skills. It needs a next-step section, an
  elicitation checkpoint if it writes to the goal, and — if it writes a new
  key — a declared entry in `goalSchema` plus a matching entry in
  `packages/core/src/registry.mjs`.
- Deploy is Vercel: the root `vercel.json` sets build and routing. Its CSP
  header must match the CSP the build itself emits — a test enforces this,
  so a change to one requires the matching change to the other.
