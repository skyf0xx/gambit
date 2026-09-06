---
name: onboard
description: Use at the start of any session touching a goal — a vague first message ("I want to...", "help me with...", "help me plan...", "what's going on with this"), or any time it's unclear whether GOAL.json exists yet. Not a coding task even if the phrasing sounds like one ("help me plan" here means a life/business/campaign goal, not a software plan). Checks for GOAL.json and branches to a guided intake for a new goal, or a welcome-back snapshot for a returning one, then hands off to strategy.
display: plain-card
---

# Skill: onboard

**Trigger**: The front door. Use whenever a session starts on a goal and it isn't
already clear whether `GOAL.json` exists — a vague opening ("I want to do something about
X", "help me organise Y", "help me plan Z"), or simply returning to work without naming
a skill. "Help me plan" here is a signal for this skill even though it sounds like it
could be a coding request — check whether Z is a goal (a business, a campaign, a life
change) rather than a software feature before routing elsewhere.

**Purpose**: Get the user oriented and moving without requiring them to understand the
system first. A user arrives with a desire, not a formed goal. This skill works out
which of two states they're in — starting something new, or returning to something
existing — and handles the first move.

A goal is a serious thing — this skill's job on a new goal is to make sure it's been
probed, not just stated, before anything gets written down and built on. For a new goal
it runs the vendored BMAD elicitation shelf (see AGENTS.md's "Vendored BMAD skills") live,
in conversation, rather than reimplementing that probing itself. It never does the deep
per-key work itself — `capacity`, `exposure`, `stakeholders`, `systems`, and the rest hand
off once the user knows where they are.

---

## Voice & Tone

Welcoming, and unhurried on the first question — then brisk. This is a conversation, not
a form.

Never expose skill names or internal mechanics unless the user asks. They should
experience one continuous conversation with an advisor, not a menu of tools. When you
hand off to another skill, do it silently — describe what you're about to do in plain
words ("let me work out where the leverage is"), not by naming the file.

---

## Execution Sequence

### 1. Resolve the goal

Run `gambit path` (see `skills/_shared/RESOLVING.md` — don't hand-check
files or guess a slug):

- **Prints a file path** (cases 1-3 of the resolution rule) → **4. Returning
  User**
- **Exits nonzero, message says to create a goal** (case 4, no goals exist
  anywhere) → **2. New Goal Intake**
- **Exits nonzero, message lists several goals** (case 5, none active) →
  **1a. Which Goal**

---

### 1a. Which Goal

Several goals exist in the store and none is active — the only case in the resolution
rule that asks the user anything. `gambit path`'s error already listed them (slug +
title); use `gambit list` if you need last-touched dates too. Ask plainly:

```
You've got a few goals going:

  1. [title] — last touched [date]
  2. [title] — last touched [date]
  ...

Which one, or a new one?
```

On an answer, set it active (`gambit switch <slug>`) and go to **4. Returning User**. If
they want a new goal instead, go to **2. New Goal Intake** — skip the introduction (2a):
the user is clearly already oriented, mid-multi-goal, not a first-time visitor.

---

### 2. New Goal Intake

New-goal intake runs the vendored BMAD elicitation shelf live, in conversation (see
AGENTS.md's "Vendored BMAD skills"), then mines its archive into `GOAL.json` (2e-2g).
Reimplementing a hand-rolled brain dump here would duplicate work the shelf — especially
`bmad-product-brief`'s own Discovery phase — already does with more sophistication
(a Fast/Coaching fork, `[ASSUMPTION]` tagging) than a bespoke version could.

#### 2a. Introduce, then open space

This is the very first contact — the store has no goals at all yet for this user
(resolution case 4, per `skills/_shared/RESOLVING.md`). Open with a short
self-introduction before the first question. This runs once ever, not once per goal —
a second or later goal also reaches this step (no goal resolves yet) but skips the
introduction and starts straight at the opening prompt, since the user already knows
who Gambit is. A returning user (section 4) gets the welcome-back snapshot instead,
never a repeat of the introduction.

```
## 👋 I am Gambit

Expert on getting things done. Give me a goal, I'll help you get there.

What's going on — tell me as much or as little as you've got.
```

Three lines, verbatim (swap only the question line for a second-or-later goal, since
there's no introduction to pair it with). Don't expand it — no bullet list of what
happens next, no disclaimers. The invitation to say "as much or as little" is
deliberate: unlike a form, this doesn't need the goal stated cleanly on the first try.
If the user's opening message already contains real substance, carry it forward as the
opening context for the shelf below rather than making them re-answer a prompt they've
already answered by writing it.

#### 2a′. Quick path or full path

Ask once, in plain language — don't name BMAD or any vendored skill here:

```
Want to walk through this properly — a real back-and-forth that pressure-tests
the idea from a few angles — or move fast and fill gaps as assumptions?
```

- **Quick path** → run only `bmad-product-brief`, in its own native Fast mode
  (batched questions, `[ASSUMPTION]` tags). Skip `bmad-forge-idea`, `bmad-brainstorming`,
  and `bmad-prfaq` entirely.
- **Full path** → all four shelf skills in sequence, each in its own native mode:
  `bmad-forge-idea`'s interrogation, `bmad-brainstorming`'s facilitator mode,
  `bmad-product-brief`'s own Coaching path, `bmad-prfaq`'s full five-stage flow.

`bmad-prd` and `bmad-ux` are never part of this shelf — a personal or campaign goal has
no "features" or "screens" for either's structure to attach to.

#### 2b. The `uv` gate

Before invoking any shelf skill, run `uv --version`.

- **Succeeds** → proceed to 2c.
- **Fails** (not found, or exits non-zero) → stop here, before running any BMAD skill.
  Tell the user plainly:

  > The elicitation shelf I use for a new goal needs `uv` (a Python tool runner) and it
  > isn't on PATH. Install it —
  > https://docs.astral.sh/uv/getting-started/installation/ — then let's pick this back
  > up.

  No fallback to a reduced or Python-free path — a user without `uv` cannot create a new
  goal through this flow. Run this gate once per onboarding session, not once per shelf
  skill.

#### 2c. Bind `{project-root}` and run the shelf

Before the first shelf-skill invocation:

1. Run `gambit path` to resolve `<goal-dir>` — cwd in the repo-local case, or
   `~/.gambit/goals/<slug>/` once the goal exists in the global store (a new goal
   doesn't have a slug yet at this point; hold the shelf's run-folder artifacts under
   `<store root>/pending-intake-BMAD/` — same store root as `pending-intake.md` used —
   until 2f moves them, mirroring how the old scratch file worked).
2. Ensure `<goal-dir>/_bmad/` exists (empty, or holding `custom/` if the user ever adds
   overrides).
3. Wrap every `uv run`/BMAD-skill invocation in a `(cd "<goal-dir>" &&
   BMAD_PROJECT_ROOT="<goal-dir>" ...)` subshell — never a bare `cd`. Both parts are
   load-bearing — see AGENTS.md's "Vendored BMAD skills" for why `BMAD_PROJECT_ROOT` (a
   Gambit-local patch to the vendored `resolve_customization.py`) is what actually
   determines `{project-root}`, not the unmodified script's own directory walk.
4. Supply `{project_name}` (the working goal title, or a placeholder if none is settled
   yet) and `{planning_artifacts}`/`{output_folder}` (`<goal-dir>/BMAD/`) proactively
   wherever a shelf skill's own activation step would otherwise ask or infer — several
   vendored files literally default to inferring `{project_name}` from "the Hedgehog
   project"; don't let that inference run first.

Run the shelf (or its quick-path subset) live, in this same session — never as a
detached subagent, since these are multi-turn conversational modes. State the BMAD
attribution once, briefly, in plain language before the first skill starts (e.g. "this
next part runs on a vendored open-source elicitation toolkit"), then let each skill run
its own native activation, mode, and pacing — don't reimplement its method tables,
menus, or discovery logic here.

#### 2d. Archive the run

Archive each skill's output to `<goal-dir>/BMAD/`, sibling to `GOAL.json`:

```
<goal-dir>/BMAD/
  00-manifest.md        # attribution + pinned version + date + which path ran + which skills ran/skipped
  01-forged-idea.md     # bmad-forge-idea output (full path only)
  02-brainstorming.md   # bmad-brainstorming output (full path only)
  03-brief.md           # bmad-product-brief's brief.md
  04-prfaq.md           # bmad-prfaq output (full path only)
  _bmad/
    custom/             # optional team/user overrides, if ever added
```

On the quick path only `03-brief.md` exists; `00-manifest.md` names the other three
"not-run, quick path." Treat this archive as write-once — mined once below, never read
live again after intake.

#### 2e. Mine the archive into GOAL.json's fields

Read `03-brief.md` and `04-prfaq.md` — the richest two files. On a quick-path run, only
`03-brief.md` exists; mine from that alone, falling back to direct questions for
`deadline`/`people` if the brief doesn't state them.

| Archive element | GOAL.json field |
|---|---|
| Brief's core problem/opportunity statement | `goal` (≤200 chars) |
| Brief's/PRFAQ's stated success condition(s) | `successCriteria[].text` (≤120 chars each), `kind` set via the same control-vs-influence read `strategy`'s format section describes, applied to the mined material rather than asked live, falling back to asking only where genuinely silent |
| Brief's/PRFAQ's stated timeline commitment | `deadline` (ask directly if absent/vague) |
| PRFAQ's Customer/Internal FAQ named people the user confirms are actually on the goal | `people[]` |

Apply the same altitude test (outcome vs. activity) and control test (cause vs.
influence) to what the archive surfaced that onboard's old hand-rolled listening pass
used to run explicitly — the shelf's own persona-driven and Working-Backwards framing
generally surfaces this naturally, but confirm it rather than assuming the archive
already got it right.

**Research during mining.** If the archive surfaced an assumption about an unfamiliar
domain, organization, precedent, or market the user couldn't answer from their own
knowledge, invoke `bmad-deep-recon` directly (its Run intent, or Draft if the user would
rather run it in their own tool) — capped to 1-3 sharp sub-questions, not a full
type-pack sweep. Bind `{project-root}` the same way as 2c. Fold whatever it finds back
into `<goal-dir>/BMAD/research/` per its own run-folder convention, and reference the
finding in the reflect-back step below.

Then reflect back, before writing anything:

```
Here's what I've got:

  GOAL: [one sentence]
  DONE LOOKS LIKE: [criteria, plainly]
  BY: [deadline, or "no fixed date"]
  WITH: [people, if any]

Does that land right? Anything wrong or missing before I write it down?
```

This step stays even though the shelf had its own confirmation points mid-run
(product-brief's draft review, PRFAQ's Verdict stage) — those confirm the BMAD
artifacts; this confirms the mined `GOAL.json` translation, a distinct, smaller thing in
`GOAL.json`'s own vocabulary the user hasn't seen yet.

Wait. Corrections at this point are cheap; corrections after three skills have built on
a misread goal are not.

#### 2f. Write GOAL.json

Use the shape in `strategy`'s **GOAL.json format** section. Onboard writes exactly the
same four keys it always has — `goal`, `successCriteria`, `deadline`, `people` —
nothing more. `capacity`, `exposure`, `stakeholders`, `posture`, and every other
optional key stay at their schema-default `null`/`[]` regardless of how much richer,
adjacent material the archive holds (PRFAQ's Customer FAQ reads stakeholder-shaped,
forge-idea's crack/kill entries read risk-shaped — see AGENTS.md's "don't fabricate" and
`exposure`'s and `stakeholders`' own explicit warnings against filling required fields —
`status`, `power`, `stanceCurrent`, `stanceTarget`, `via` — without the analysis those
skills actually do). A richer archive is real signal for those skills to start from, not
a license to write a thin version of their key now.

Where to write it follows the same resolution rule (`skills/_shared/RESOLVING.md`): if a
cwd `GOAL.json` is the intended target (case 1 — an existing per-project setup, or the
user explicitly wants a project-local goal), write there directly. Otherwise this is a
new goal in the global store — run `gambit new "<goal title>"`, which derives a slug
from the title, creates `~/.gambit/goals/<slug>/GOAL.json` as a schema-default stub, and
sets it active, and prints that file's path; then edit that file's `goal`,
`successCriteria`, `deadline`, and `people` keys in place with the mined content, leaving
every other key at its stub default. Don't hand-derive the slug yourself — the CLI's
derivation is the one `gambit list`/`switch` expect. If the shelf's archive was held
under a pending path (2c, step 1) because no slug existed yet, move `BMAD/` into the
now-created goal directory as part of this step.

Confirm in two or three sentences of plain language — not a dump of the file.

The moment `successCriteria` is first written is also the moment to open the diagram
view, unprompted — the user should never have to type `gambit visualize` themselves.
Launch it detached and silent so it doesn't block the handoff below:

```bash
nohup gambit visualize >/dev/null 2>&1 &
```

Don't narrate this beyond mentioning once that a live view just opened — it's a
side effect, not the deliverable.

Immediately after writing, run `gambit check`. If it fails, fix the reported fields and
re-run before ending the turn — see AGENTS.md's "Validate every write."

#### 2g. Offer the richer material, log what was flagged

Where the archive holds material with real per-skill rigor, offer (never force) the
chained invocation, naming what was found:

> Worth flagging for later: the PRFAQ's Customer FAQ surfaced two people whose buy-in
> this depends on — want me to map them properly with `stakeholders`? Forge-idea flagged
> a real risk about timeline — want `threat` or `premortem` on that before we go
> further?

Append one line to the freshly-written `GOAL.json`'s `log` noting which signals were
flagged, so a later `capacity`/`exposure`/`stakeholders`/`systems` run has a pointer to
`<goal-dir>/BMAD/` instead of starting cold:

```json
{
  "log": [
    { "date": "YYYY-MM-DD", "focus": null, "notes": ["intake flagged: <capacity|exposure|stakeholders|posture signal, one line>"], "source": "onboard" }
  ]
}
```

Omit this log entry entirely if nothing was flagged — don't manufacture a note.

---

### 3. Handoff (new goal)

Tell them what happens next before it happens:

> Next I'll work out where to concentrate first — the one thing that moves this most.

Then invoke `strategy`. Don't run `strategy`'s logic from inside this skill — hand off
cleanly so it reads the fresh `GOAL.json` and does its own assessment.

---

### 4. Returning User

`GOAL.json` exists. Do not re-interview — that discards their standing context.

This branch is itself a Gambit discussion of an existing goal, so AGENTS.md's
"Opening the visualizer" rule applies here too, not just to the new-goal write in
2f: open it once, detached and silent, before or alongside the snapshot below.

```bash
nohup gambit visualize >/dev/null 2>&1 &
```

#### 4a. Route direct asks straight through

If the return message is a specific ask that maps to one skill ("what's my status",
"check a fact for me", "draft a message to Y", "help me decide whether to..."), skip the
snapshot and go there. Onboarding orients someone who doesn't know what they need; it
shouldn't interpose itself on someone who does.

#### 4b. Otherwise, snapshot

```
Welcome back. Here's where things stood:

  GOAL: [one line]
  FOCUS: [current Schwerpunkt, or "nothing set"]
  LAST MOVE: [date] — [one line from the log]
  [If a deadline exists] TIME LEFT: [interval]
```

If it's been a while, or the log is dense with framework vocabulary, offer the plain
version rather than assuming: *"Want the plain-language version of where this is at?"*
→ `brief`.

#### 4c. Then ask, don't assume

The gap since last session matters more than anything in the file.

```
What's happened since?
```

Then route on the answer:

- **Nothing much** → offer to continue on the current focus, or reassess → `strategy`
- **Something changed** — a setback, new information, a date moved, someone dropped out
  → go straight to `strategy` to reassess. Don't ask permission; a changed situation
  invalidates a standing focus.
- **A decision is pending** → `decide`
- **They don't know where they're at** → `brief`

If the last log entry is recent and nothing external has obviously shifted, ask in one
line whether to keep going on the current focus or reassess.

---

### 5. Always Leave a Next Step

Never end an onboarding turn without a clear next action. A user who has just been
interviewed and handed a file, with no indication of what happens now, is worse off than
before they started.
