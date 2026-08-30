# Gambit — Agent Instructions

Gambit is a set of agent-agnostic skills that help an AI agent act as a
strategic advisor for someone running a goal — personal, or one that
involves coordinating other people.

## Start of session

Before the first substantive reply in any session, check whether `GOAL.md`
exists in the user's working directory and read it if so. This is silent
context-loading, not a skill invocation — don't narrate it, don't run
`onboard` or `strategy` unprompted, and don't treat it as green light to
take action. It exists so the agent already knows the goal, current
posture, plan, and log the moment the user says anything, instead of
asking them to re-explain state they already recorded. If `GOAL.md` doesn't
exist, say nothing about it until a skill (typically `onboard`) needs it.

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

`onboard` is the front door: it checks whether `GOAL.md` exists and branches
to first-contact intake (one question at a time, not a form) or a
welcome-back snapshot for a returning session, then hands off to `strategy`.
Other skills should assume `GOAL.md` already exists — `strategy` explicitly
defers to `onboard` if it's missing rather than re-implementing intake.

Each `SKILL.md` is self-contained: trigger, purpose, voice, and an execution
sequence. They are written to be read and followed directly by any capable
agent — Claude Code, Codex, a custom agent loop, or a human — not just tools
that natively auto-load a `skills/` directory.

## The GOAL.md contract

Every skill reads and writes a single file, `GOAL.md`, in the user's working
directory (not this repo). It holds the goal, success criteria, deadline,
current plan, an optional `## People` and `## Posture` section, and a
running log. `strategy` creates it on first use if it doesn't exist. See
`skills/strategy/SKILL.md` for the exact format.

`GOAL.md` should always read as current state, not a history of how it got
there — skills update sections in place rather than appending "(updated)"
notes. History belongs in git or the user's own notes, not in the file
itself.

Each section has exactly one owning skill, which replaces its own content
rather than accumulating: `## Plan` ← `plan`, `## Systems notes` ←
`systems`, `## Risk notes` ← `threat`, `## Decisions` ← `decide`,
`## Stakeholders` ← `stakeholders`, `## Exposure` ← `exposure`,
`## Capacity` ← `capacity`, `## Forecasts` ← `forecast`, `## Experiments`
← `experiment`. The `## Log` is the only append-only section.

`premortem` and `review` deliberately own no section — they append to
`## Risk notes` and `## Plan` respectively, labelled with their source, so
findings live where the skill that owns the section will see them rather
than in a parallel list nobody reads. If you add a skill that writes
to `GOAL.md`, give it its own section and add it to the format spec in
`skills/strategy/SKILL.md` — that spec is the contract, and skills that
write to sections it doesn't declare will silently disagree with each
other.

Success criteria carry a `control` or `influence` marker. `control` means
the user can cause it directly; `influence` means it depends on someone
else's decision. `eval` scores them differently, and skills should not
treat a stalled influence criterion as a failure of execution.

## Guided, not just capable

These skills run a guided session, not a query interface. Two rules carry
most of that weight, and both are easy to skip under time pressure:

**Elicit before committing.** Any skill that writes to `GOAL.md` shows the
user its read and asks what they think first. The user holds situational
facts the file doesn't contain, and the cheap moment to surface them is
before a focus is locked in — not after three skills have built on it. One
exchange, then commit; this is a checkpoint, not a negotiation.

**Always leave a next step.** No skill ends without naming the single most
useful next move plus a short menu of alternatives. A user handed an
analysis with no route onward is worse off than before they asked. Where a
skill has a clear recommendation it gives one — `status` is the exception,
since it reports rather than steers.

Gloss framework vocabulary once per session on first use, then use it
freely. The analysis stays dense; only the entry cost comes down. A user
who wants the whole picture in ordinary language has `brief`.

## Working on this repo

- These are prompt/procedure files, not code — there is no build, test, or
  lint step. Changes are reviewed by reading the skill file itself.
- If you add a new skill, give it a `SKILL.md` inside its own
  `skills/<name>/` directory, with YAML frontmatter (`name`, `description`)
  at the top so Claude Code and similar tools can auto-discover it, and
  update the table in README.md. It needs a next-step section, an
  elicitation checkpoint if it writes to `GOAL.md`, and a declared section
  in the format spec if it writes a section.
