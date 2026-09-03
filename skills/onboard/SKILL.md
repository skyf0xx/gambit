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
probed, not just stated, before anything gets written down and built on. It does that
probing itself for the raw intake, then leans on `elicit` for deeper pressure once
there's something concrete to pressure-test. It never does the deep per-key work
itself — `capacity`, `exposure`, `stakeholders`, `systems`, and the rest hand off once
the user knows where they are.

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

New-goal intake runs in three passes: get the raw material down without interrupting it
(2a-2b), put real pressure on the shape that emerges (2c), then mine the result into
`GOAL.json` (2d-2f). The scratch file created in 2b is what makes this order possible —
the user talks first, structure gets extracted after, instead of being forced to answer
one structured question at a time before they've said what's actually on their mind.

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
If the user's opening message already contains real substance, skip straight to 2b —
don't make them re-answer a prompt they've already answered by writing it.

#### 2b. Take the brain dump, write it to a scratch file

Let the user talk before imposing any structure. Don't ask for goal, criteria,
deadline, and people one at a time up front — that's an interrogation, and most people
can't answer all four cold before they've had a chance to just describe the situation.
Ask open follow-ups only where the picture is genuinely unclear, not to fill in a form
in order.

As the conversation develops, write what's said into a scratch file rather than
holding it only in the conversation — this is what later steps mine, and what lets the
session resume cleanly if it's interrupted. There's no slug yet at this point (that
comes from the confirmed goal title in 2f), so use a fixed pending path:
`<store root>/pending-intake.md` (store root is `$GAMBIT_HOME`, else
`$XDG_DATA_HOME/gambit`, else `~/.gambit` — same resolution `gambit path` uses). Plain
markdown, not JSON — this file is never validated against `goalSchema` and never read
by the visualizer; it's working notes, freeform:

```markdown
# Intake — [date]

## Raw
[what the user said, close to verbatim, as it comes in]

## Signals
- capacity: [anything volunteered about time/money/energy — or omit if none]
- exposure: [anything volunteered about legal/professional/safety risk — or omit]
- stakeholders: [anyone named whose decision the goal depends on — or omit]
- posture: [any sign the goal has real phases of intensity — or omit]
```

Append to `## Raw` as the conversation continues; file the `## Signals` bullets the
moment something matching them comes up, don't wait until the end to reconstruct them
from memory. If a fresh scratch file already exists from an interrupted earlier
session (check before writing a new one), read it and resume from where it left off
rather than starting over.

While listening, run the same altitude and control checks the old interview asked
explicitly — just as read-throughs of what's said, not as questions fired in sequence:

**Altitude.** People often open with a task or activity — "I want to arrange a
protest", "help me find a job", "I need to write a grant application" — rather than the
outcome that task is in service of. Taken at face value, the task becomes the goal, and
everything downstream (success criteria, plan, focus) gets built around the wrong
thing: the protest happens, well-organised, and nothing the person actually wanted has
moved.

Test it: is what they said an *outcome* (a state of the world that would be different)
or an *activity* (a thing they'd do)? A useful tell — could this plausibly be one line
in a plan under a bigger goal? If yes, it's probably the activity, not the goal.

If it reads as an activity, zoom out before writing anything down:

> What would [the activity] actually get you? If it went perfectly, what's different
> afterward?

Keep asking "and then what does that get you" only as long as the answer keeps changing
— stop at the first answer that's a real end-state, not another step. Don't push past
that; over-abstracting ("I want to be happy") is as useless as under-abstracting.

Then say the reframe out loud rather than silently substituting it — the user may
genuinely want just the activity, and that's a legitimate answer:

> So the real goal is [outcome] — and [the original activity] is one way to get there,
> maybe one piece of it rather than the whole thing. Does that sound right, or is the
> activity itself what you're after?

If they confirm the outcome, that becomes the goal, and the original activity is noted
in the scratch file as a likely plan step, not re-litigated now — `plan` will place it
properly later. If they push back and say no, the activity really is the point, take
that at face value and move on.

If what they opened with is already an outcome, skip this test — don't manufacture a
zoom-out step a well-formed goal doesn't need.

**Control.** Once a candidate success condition is on the table, run the single most
valuable question in this intake:

> Is this something you can cause directly, or something you're trying to influence?

Plenty of worthwhile goals depend on a decision somebody else makes — a council vote, a
government policy, an employer's offer. That's legitimate, but it changes what progress
means, and it must be visible from the start. Where a criterion isn't directly
controllable, ask what the user *can* control that makes it more likely, and note both.

Ask about deadline and people directly if the conversation hasn't already surfaced
them — "none" and "nobody else yet" are both valid, complete answers. Don't ask about
posture; it's introduced later by `strategy`, only if the goal has real phases of
intensity.

Stop the raw-material pass once there's enough for a real goal statement and at least
one concrete, testable success condition. That's the signal to move to 2c, not a fixed
number of exchanges.

#### 2c. Offer real pressure before anything is locked in

This is the step that makes onboard more than a form-filler. Before mining the scratch
file into `GOAL.json`, hand the goal framing and its success criteria to `elicit`:

> Before I lock this in, want to put it under some pressure — check the assumptions,
> see if it holds up?

Invoke `elicit` with the goal statement and draft success criteria as the target. Let
`elicit` run its own menu and loop (see `skills/elicit/SKILL.md`) — don't reimplement
its method table or menu logic here. When it returns control, fold whatever changed
back into the scratch file's `## Raw` section as the current framing (per
`skills/_shared/NO_HISTORY.md` — the revised version, not a diff against the original).

If the user declines pressure-testing (a low-stakes goal, or they're clearly already
sure), respect that immediately and move on — this is an offer, not a gate.

#### 2d. Reflect back before writing

Do not write the file and announce it. Show them what the scratch file now says:

```
Here's what I've got:

  GOAL: [one sentence]
  DONE LOOKS LIKE: [criteria, plainly]
  BY: [deadline, or "no fixed date"]
  WITH: [people, if any]

Does that land right? Anything wrong or missing before I write it down?
```

If step 2b reframed an opening activity into an outcome, name that once here too — e.g.
"...and [the activity] sounds like it'll be one piece of the plan, not the goal itself"
— so the substitution is visible at the one point it's cheap to reject.

Wait. Corrections at this point are cheap; corrections after three skills have built on
a misread goal are not.

#### 2e. Write GOAL.json

Use the shape in `strategy`'s **GOAL.json format** section. Onboard writes exactly the
same four keys it always has — `goal`, `successCriteria`, `deadline`, `people` — nothing
more. `capacity`, `exposure`, `stakeholders`, `posture`, and every other optional key
stay at their schema-default `null`/`[]` regardless of what the scratch file's
`## Signals` section captured (see AGENTS.md's "don't fabricate" and `exposure`'s and
`stakeholders`' own explicit warnings against filling required fields — `status`,
`power`, `stanceCurrent`, `stanceTarget`, `via` — without the analysis those skills
actually do). A volunteered fact is real signal for those skills to start from, not a
license to write a thin version of their key now.

Where to write it follows the same resolution rule (`skills/_shared/RESOLVING.md`): if a
cwd `GOAL.json` is the intended target (case 1 — an existing per-project setup, or the
user explicitly wants a project-local goal), write there directly. Otherwise this is a
new goal in the global store — run `gambit new "<goal title>"`, which derives a slug
from the title, creates `~/.gambit/goals/<slug>/GOAL.json` as a schema-default stub, and
sets it active, and prints that file's path; then edit that file's `goal`,
`successCriteria`, `deadline`, and `people` keys in place with the mined intake content,
leaving every other key at its stub default. Don't hand-derive the slug yourself — the
CLI's derivation is the one `gambit list`/`switch` expect.

Confirm in two or three sentences of plain language — not a dump of the file.

#### 2f. Carry the scratch file forward

Move the pending scratch file into the new goal's own directory (same directory as the
`GOAL.json` path `gambit new` just printed) and rename it `intake.md`, so it isn't lost
and isn't validated as part of `GOAL.json`. It's a plain file move — the store treats it
as an untracked sibling of `GOAL.json`, nothing reads it automatically.

If `## Signals` captured anything, name it once in the handoff so it isn't silently
dropped:

> Worth flagging for later: [capacity/exposure/stakeholders note, one line each]. I'll
> leave those for the skills that actually work through them.

Append one line to the freshly-written `GOAL.json`'s `log` noting which signals were
flagged, so a later `capacity`/`exposure`/`stakeholders`/`systems` run has a pointer to
`intake.md` instead of starting cold:

```json
{
  "log": [
    { "date": "YYYY-MM-DD", "focus": null, "notes": ["intake flagged: <capacity|exposure|stakeholders|posture signal, one line>"], "source": "onboard" }
  ]
}
```

Omit this log entry entirely if `## Signals` was empty — don't manufacture a note.

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
2e: open it once, detached and silent, before or alongside the snapshot below.

```bash
nohup gambit visualize >/dev/null 2>&1 &
```

#### 4a. Route direct asks straight through

If the return message is a specific ask that maps to one skill ("what's my status",
"research X", "draft a message to Y", "help me decide whether to..."), skip the snapshot
and go there. Onboarding orients someone who doesn't know what they need; it shouldn't
interpose itself on someone who does.

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
