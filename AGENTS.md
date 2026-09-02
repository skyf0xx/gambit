# Gambit — Agent Instructions

Gambit is a set of agent-agnostic skills that help an AI agent act as a
strategic advisor for someone running a goal — personal, or one that
involves coordinating other people.

## Start of session

Before the first substantive reply in any session, resolve `GOAL.json` per
the rule below and read it if resolution finds one. This is silent
context-loading, not a skill invocation — don't narrate it, don't run
`onboard` or `strategy` unprompted, and don't treat it as green light to
take action. It exists so the agent already knows the goal, current
posture, plan, and log the moment the user says anything, instead of
asking them to re-explain state they already recorded. If resolution finds
no goal, say nothing about it until a skill (typically `onboard`) needs it.

## Resolving GOAL.json

Gambit holds state for many goals at once, one active at a time, in a
global store outside any project directory:

```
~/.gambit/                      the global store (goal state)
  gambit.db                     index only — rebuildable, see below
  active                        one line: slug of the active goal
  goals/
    park-cleanup/GOAL.json      a full GOAL.json, schema unchanged
    job-search/GOAL.json
```

`~/.gambit` is `$GAMBIT_HOME` if set, else `$XDG_DATA_HOME/gambit`, else
the literal path `~/.gambit`. `gambit.db` is an index, not the source of
truth — goal state is the JSON in `goals/<slug>/GOAL.json`, validated
against the Zod schema in `src/store/schema.mjs`; the database exists only
so the CLI can list, switch, and search across goals quickly. Deleting it
and running `gambit reindex` loses nothing.

Which file "`GOAL.json`" means, for any skill, is decided by one precedence
rule, spelled out in full in `skills/_shared/RESOLVING.md`:

1. `GOAL.json` in the current working directory → use it. A repo-local goal
   always wins, so existing per-project installs keep working unchanged.
2. Otherwise, the goal named by `~/.gambit/active` → its `GOAL.json` in the
   store.
3. Otherwise, if exactly one goal exists in the store → use it, and set it
   active.
4. Otherwise, if no goals exist anywhere → `onboard` runs first-contact
   intake.
5. Otherwise (several goals, none active) → `onboard` lists them and asks
   which. This is the only case in the rule that asks anything.

Skills reference this rule rather than restating it — see
`skills/_shared/RESOLVING.md` for the canonical text.

## Repository structure

```
skills/
  ORIENT
  onboard/SKILL.md      entry point — new goal intake, or welcome-back for a returning one
  brief/SKILL.md        plain-language read of current state, jargon translated, read-only
  status/SKILL.md       read-only snapshot in the system's own terms, no writes

  DIRECT
  strategy/SKILL.md     assess progress, set posture, set focus (Schwerpunkt)
  systems/SKILL.md      CoG / PMESII / ASCOPE analysis, find the leverage point
  plan/SKILL.md         sequence the goal into a dependency-aware plan
  decide/SKILL.md       work an open choice to a recorded decision with a reverse-if condition

  ESTABLISH
  research/SKILL.md     live, dated, source-rated research; supersedes intel when recency matters
  experiment/SKILL.md   smallest falsifiable test of an assumption, threshold set in advance
  forecast/SKILL.md     dated falsifiable predictions, scored later for calibration
  intel/SKILL.md        source-rated research where recency isn't the risk

  STRESS
  threat/SKILL.md       red-team the plan, assess network exposure
  premortem/SKILL.md    prospective hindsight — stipulate failure, explain it backwards
  exposure/SKILL.md     personal legal / financial / professional / safety risk
  capacity/SKILL.md     operator's real hours, money, energy, runway

  PEOPLE
  stakeholders/SKILL.md map power and interests of third parties; find the movable middle
  negotiate/SKILL.md    prep a two-way conversation — interests, BATNA, ZOPA, concessions
  comms/SKILL.md        frame and sharpen outward communication

  ASSESS
  eval/SKILL.md         independent audit of progress against the goal
  review/SKILL.md       after-action review of a completed event — expected vs actual

  _shared/RESOLVING.md  the GOAL.json resolution rule — no SKILL.md, not a skill itself
  _shared/HUMANIZE.md   writing-voice rules applied to skill output and log entries
  _shared/NO_HISTORY.md current-state-only rule for every GOAL.json write
```

The set draws on several domains deliberately, and the divisions matter when
extending it. Operational planning doctrine supplies `strategy`, `systems`,
`plan`, `threat`, `review`. Intelligence tradecraft supplies `research` and
`intel`.
Negotiation and stakeholder theory supply `stakeholders` and `negotiate`.
Forecasting and behavioural science supply `forecast` and `premortem`. Lean
experimentation supplies `experiment`. Operations and risk supply `capacity`
and `exposure`.

Skills that look adjacent are kept separate because they ask genuinely
different questions, and collapsing them loses the distinct one:

- `threat` red-teams from outside; `premortem` stipulates failure and reasons
  backwards. The second reliably surfaces what the first misses.
- `threat` covers exposure of the effort; `exposure` covers exposure of the
  person.
- `eval` audits progress toward the goal; `review` extracts lessons from a
  finished action.
- `systems` finds the culminating point abstractly; `capacity` finds it in the
  operator's actual hours and money.
- `comms` prepares outward broadcast; `negotiate` prepares a two-way exchange
  where the other side has leverage.

`onboard` is the front door: it checks whether `GOAL.json` exists and branches
to first-contact intake (one question at a time, not a form) or a
welcome-back snapshot for a returning session, then hands off to `strategy`.
Other skills should assume `GOAL.json` already exists — `strategy` explicitly
defers to `onboard` if it's missing rather than re-implementing intake.

Each `SKILL.md` is self-contained: trigger, purpose, voice, and an execution
sequence. They are written to be read and followed directly by any capable
agent — Claude Code, Codex, a custom agent loop, or a human — not just tools
that natively auto-load a `skills/` directory.

## The GOAL.json contract

Every skill reads and writes a single file, `GOAL.json` — resolved per the
rule above, not assumed to be in any fixed location (not this repo). It is
strict JSON validated against the Zod schema `goalSchema` in
`src/store/schema.mjs` — that schema is the authoritative contract; this
section and `skills/strategy/SKILL.md`'s **GOAL.json format** are
human-readable summaries of it, and if they ever disagree with the schema,
the schema wins. It holds the goal, success criteria, deadline, current
plan, an optional `people` array and `posture` object, and a running log.
`onboard` creates it on first use via `gambit new`, which writes a
schema-default stub (every array empty, every optional key `null`).

Skills write to `GOAL.json` with their own file-edit tool, the same
mechanism used for the old Markdown file — there is no CLI subcommand for
writing individual fields, and nothing enforces field shapes or length
caps at write time. A skill must honor the constraints described in its
own `SKILL.md` when it writes, then immediately run `gambit check` — it
validates the resolved `GOAL.json` against `goalSchema` and exits nonzero
with the offending paths if it doesn't match, the same check the
visualize server and `adopt` run, but on demand right after the write
instead of only surfacing the next time someone opens the visualizer. If
`gambit check` fails, fix the reported fields and re-run it before ending
the turn — don't leave a skill-writing turn on a file that fails
`gambit check`.

`GOAL.json` should always read as current state, not a history of how it
got there — skills replace a key's value in place rather than layering
"(updated)" notes into it. History belongs in git or the user's own notes,
not in the file itself.

Each key has exactly one owning skill, which replaces its own key's value
rather than accumulating: `plan` ← `plan`, `systemsNotes` ← `systems`,
`riskNotes` ← `threat`, `decisions` ← `decide`, `stakeholders` ←
`stakeholders`, `exposure` ← `exposure`, `capacity` ← `capacity`,
`forecasts` ← `forecast`, `experiments` ← `experiment`, `criteriaStatus` ←
`eval`. The `log` array is the only append-only key.

`premortem` and `review` deliberately own no key — they append to
`riskNotes` and `plan.nextActions` respectively, labelled with their
source, so findings live where the skill that owns the key will see them
rather than in a parallel list nobody reads. If you add a skill that
writes to `GOAL.json`, give it its own key in the schema and the format
spec in `skills/strategy/SKILL.md` — that spec is the contract, and skills
that write to keys the schema doesn't declare will fail validation on the
next read.

Success criteria carry a `control` or `influence` marker. `control` means
the user can cause it directly; `influence` means it depends on someone
else's decision. `eval` scores them differently, and skills should not
treat a stalled influence criterion as a failure of execution.

## Guided, not just capable

These skills run a guided session, not a query interface. Four rules carry
most of that weight, and all four are easy to skip under time pressure:

**Elicit before committing.** Any skill that writes to `GOAL.json` shows the
user its read and asks what they think first. The user holds situational
facts the file doesn't contain, and the cheap moment to surface them is
before a focus is locked in — not after three skills have built on it. One
exchange, then commit; this is a checkpoint, not a negotiation.

**Stay opinionated through pushback.** The user is consulting these skills
*because* they want a strategic read, not because they want their own
question reflected back. Elicitation surfaces facts the skill couldn't see —
it never becomes a way to hand the actual call to the user. When new
information lands (disagreement, a blocker, a low-conviction answer),
the skill re-reasons and returns a new committed recommendation — situation,
options weighed, one answer — not an open "what would you do instead?".
The only exception is a choice the user is genuinely holding themselves
between two live options they can't resolve — that's `decide`'s job, and
handing it off there is correct because the user, not the skill, holds the
open question. Everywhere else, "the user knows things I don't" means feed
their answer back into the analysis and reason again — it does not mean
defer the analysis itself.

**Always leave a next step.** No skill ends without naming the single most
useful next move plus a short menu of alternatives. A user handed an
analysis with no route onward is worse off than before they asked. Where a
skill has a clear recommendation it gives one — `status` is the exception,
since it reports rather than steers. The menu is for the user's awareness,
not an invitation to poll: naming alternatives means stating the
recommendation as the default action and letting the user redirect, not
pausing on a formal choice between options the skill is equipped to make
itself.

**Close on a decision, not a narrative.** When the user asks for a verdict
— "was that right", "what should I do", "is this working" — the reply ends
with the call itself: a committed answer, an updated focus, a yes/no on the
question asked. Explaining what happened or what went wrong is analysis,
not the deliverable; a skill that stops at analysis has left the actual
decision sitting unmade for the user to draw out themselves. State the
decision, then stop.

**Write like a person, not a template.** Apply
`skills/_shared/HUMANIZE.md` to any prose a skill produces and to every
`log` entry it appends: vary sentence rhythm, use the plain verb,
commit to specific checkable claims over safe generic ones, and cut
padded transitions and unearned rule-of-three lists. It doesn't override
the structural formatting rules below (headings, bullets, bold labels)
— those are scanning aids, not the padding this rule targets.

**No history in the output itself.** Apply
`skills/_shared/NO_HISTORY.md` on every write to `GOAL.json`. Every key
but `log` reads as current state only — no `"(updated)"` labels, no
"originally X, now Y" narration, no trace of a prior version. `log` is
still the one append-only array (the sequence of entries is the
history, by design), but each individual entry states what's true as of
that entry, not a replay of the discussion that produced it — a decision
gets its outcome and rationale, not the back-and-forth.

**Validate every write.** Nothing enforces `goalSchema`'s field shapes,
length caps, or enums at write time — a skill that writes a sentence
past a 120-character cap, or the wrong enum value into a `source` or
`status` field, produces a file that looks fine in the conversation and
only fails later, in the visualizer or `gambit check`, disconnected from
the write that caused it. Immediately after any write to `GOAL.json`, run
`gambit check`. If it reports a mismatch, fix the reported fields and
re-run it before ending the turn — don't hand back a turn that leaves
`GOAL.json` failing `gambit check`.

**Write GOAL.json fields like a plan, not an essay.** This governs every
write to `GOAL.json` only — your own replies to the user in conversation
stay normal prose. Inside the file: signal-dense, verbosity-light string
fields. Max ~5 words per short-label field. Few sentences, not one long
one, where a field allows longer text. Short labels and arrow chains over
paragraphs — a human planning by hand writes a mind map, not an essay,
and every owned key (`plan`, `systemsNotes`, `riskNotes`, `decisions`,
`stakeholders`, `exposure`, `capacity`, `forecasts`, `experiments`,
`criteriaStatus`) follows that, including each individual `log` entry a
skill appends. Cut the field down to the fact; drop the clause explaining
it unless the fact is unreadable without it. The schema enforces field
*shape* (type, enum, length cap) — it does not enforce that the content is
actually terse or actually a real label rather than a lazy placeholder;
that's still this rule's job, in prose, on every write.

Almost every string field is one of exactly two hard caps in
`goalSchema`: `shortLabel` (40 chars) or `mediumLabel` (120 chars) — see
`src/store/schema.mjs` for which each field is. "A few words" or "short"
in a `SKILL.md` means one of these two numbers, not a stylistic
suggestion. Treat 120 chars as roughly one plain sentence with no
subordinate clause — a composed string (a template prefix like `"Review:
"` plus a finding, or two clauses joined by `—`) is the most common way
to blow it, because the prefix's length is easy to forget when judging
whether the rest "looks short." When a field is a composed string, count
the full rendered string, not just the part you're actively drafting.

Gloss framework vocabulary once per session on first use, then use it
freely. The analysis stays dense; only the entry cost comes down. A user
who wants the whole picture in ordinary language has `brief`.

**Format for scanning, not for reading start to finish.** A dense strategic
read delivered as prose paragraphs makes the user work to extract the
structure that's already in your head — put it on the page instead.
Default any substantive reply (an assessment, a recommendation, a focus, a
brief) to:

- A `##` heading per distinct move (e.g. Assessment, Situation, Focus,
  Before I lock this in) rather than a topic sentence buried in a
  paragraph.
- Bullets for anything that is actually a list — options weighed, criteria,
  open questions — instead of comma-spliced prose.
- **Bold** for the label on a line, not for emphasis mid-sentence.
- At most one emoji per heading, used only to mark which kind of section it
  is (e.g. a target for a focus, a warning for a risk flag), never for
  decoration or one per bullet. Omit entirely on skills where a source
  document, external audience, or the user's own stated preference calls
  for plain text (`comms` drafting for a formal audience, anything destined
  to be copy-pasted elsewhere).

This is a default, not a template to force onto short answers — a one-line
confirmation or a narrow fact-check doesn't need headings. Match the
formatting weight to the substance of the reply.

## Working on this repo

- The skills themselves are prompt/procedure files, not code — changes are
  reviewed by reading the skill file itself, no build or lint step applies
  to them. `src/store/` and `src/visualize/` are real code (an npm package,
  `bin/cli.mjs` as entry point); run `node scripts/check.mjs` after
  touching any of `src/store/`, `src/visualize/`, or `bin/cli.mjs`.
- `src/store/schema.mjs` is the single Zod schema (`goalSchema`) every
  reader validates through — the store index, the visualize server, the
  CLI, and `gambit check`. Changing a field's shape or constraints happens
  there once, not independently in each reader.
- If you add a new skill, give it a `SKILL.md` inside its own
  `skills/<name>/` directory, with YAML frontmatter (`name`, `description`,
  and `display` — the visual-layer renderer it maps to; see
  `src/visualize/registry.mjs` for the fixed set of renderer types) at the
  top so Claude Code and similar tools can auto-discover it, and update the
  table in README.md. It needs a next-step section, an elicitation
  checkpoint if it writes to `GOAL.json`, and a declared key in
  `goalSchema` (`src/store/schema.mjs`) plus the format spec in
  `skills/strategy/SKILL.md` if it writes a key.
