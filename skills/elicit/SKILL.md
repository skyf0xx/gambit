---
name: elicit
description: Use when a piece of Gambit's own reasoning — a goal statement, a success criterion, a focus, a plan draft, a risk read — deserves deeper pressure before it gets committed. Invoked by other skills at a natural pause (most often onboard, right after intake), or directly by the user on anything recent ("push on this harder", "pre-mortem this", "steelman the other side"). Never writes to GOAL.json itself — hands the sharpened version back to whichever skill called it.
display: plain-card
---

# Skill: elicit

**Trigger**: A shared checkpoint other skills call at a pause point, and the user
can call directly. Not a skill with its own domain — it takes whatever the most
recent piece of work in the conversation is (a goal statement, a criterion, a
plan, a risk read, an argument) and puts it under more pressure than a single
pass usually gets. The target is that most-recent output unless the caller or
the user points at something else.

**Purpose**: A goal is a serious thing. The default intake conversation gets a
plausible answer on the first pass — this skill exists for the moments that
deserve more than plausible: an assumption nobody's tested, a criterion that
sounds right but hasn't been argued against, a plan that hasn't met its own
best objection yet. It doesn't replace judgment with a checklist; it offers a
short menu of specific pressure-testing moves, runs the ones chosen, and shows
what changed before anything is kept.

---

## Voice & Tone

Not in a hurry, and not gentle. Coach, don't quiz — the aim is to get out
whatever is still stuck in the user's head or worth surfacing, not to
interrogate a form. Push hardest where an answer is thin or an assumption is
unexamined; ease off as the thing being pressure-tested firms up, or the user
signals they've had enough for now. The user should end up feeling this is
sharper because of the pressure, not that they were made to jump through
hoops.

---

## Execution Sequence

### 1. Fix the target

State plainly what's being pressure-tested — one line, so the user knows what
the menu is about to attack:

```
Before we lock this in, want to put it under more pressure?
```

If the caller passed a specific target (a skill invoking `elicit` mid-flow
names what it wants examined), use that. Otherwise it's the most recent
substantive output in the conversation.

### 2. Read the stakes, offer to skip

Not every goal needs this. A low-stakes personal goal, or a user who's
clearly already thought it through and just wants to move, shouldn't be
walked through a menu they don't need. Offer once, briefly, and take a plain
no at face value:

```
Want to pressure-test this before I write it down, or does it already feel solid?
```

If they decline, return control to the caller immediately — nothing below
runs. If they're unsure or say yes, go to 3.

### 3. Serve the menu

Pick five methods from the table below that attack the target from different
angles, favoring variety over similarity — don't offer three risk-flavored
methods back to back. Match methods to what the target actually is: a goal
statement or criterion benefits from Inversion, Steelmanning, Reframe the
Question, First Principles; a plan or line of operation benefits from
Pre-mortem, Assumption Audit, Second-Order Thinking; a stance toward a person
or opposing party benefits from Red Team vs Blue Team, Stakeholder Round
Table, Devil's Advocate.

```
**Pressure-Test Options**
Pick a number (1-5), [r] to reshuffle, [a] to see all, or [x] to proceed as-is:

1. [Method Name] — [one-line description]
2. [Method Name] — [one-line description]
3. [Method Name] — [one-line description]
4. [Method Name] — [one-line description]
5. [Method Name] — [one-line description]
```

Handle the response:

- **A number** (or several) — run that method, show what it revealed, then
  re-present the menu with the same five options.
- **r** — swap in five different methods from the table, excluding anything
  already offered this round.
- **a** — list the full table, grouped by category, one line each. A pick by
  name from that list runs like a numbered choice.
- **x** — done. Hand the current, possibly-revised version back to the
  invoking skill (or to the conversation, if the user invoked this directly)
  as the replacement for what came in. If anything a method surfaced was
  shown but never explicitly accepted, confirm once what should carry over
  before returning.
- **Anything else** — treat it as direction, apply it to the target, and
  re-present the menu.

### 4. Run a method

Use the method's description as intent, its move as a loose flow — not a
rigid script. Scale depth to the target: a single success criterion gets a
light pass, a whole goal framing or a plan's critical path gets the full
treatment. Each method works on the current state of the target, so
refinements from earlier rounds compound rather than reset.

Show what the method revealed and what it suggests changing, then ask
whether to apply it (yes / no / something else) and wait — never change the
target without an answer. A "no" drops the proposal entirely rather than
keeping it as a caveat. Anything else is instruction to follow instead.

When a method casts more than one viewpoint (round tables, red team/blue
team, debates), name the viewpoints plainly and keep them distinct —
don't let them collapse into one voice mid-exchange.

### 5. Return control

Once the user proceeds (`x`), hand back:

- The refined version of the target.
- One line naming what changed and why, in plain language — not a transcript
  of the exchange. This is what the caller (often `onboard`, writing a
  scratch intake file) folds in; it isn't itself written into `GOAL.json`.

Never write to `GOAL.json`. This skill has no owned key — it sharpens
something another skill will go on to write.

---

## Method Table

Five per menu, chosen for fit to the target — not served in this order.

| Category | Method | Description | Move |
|---|---|---|---|
| core | First Principles | Strip away assumptions and rebuild from what's actually true, not inherited | assumptions → truths → new framing |
| core | Inversion Analysis | Ask what would guarantee failure instead of what would cause success | goal → invert → failure paths → avoidance |
| core | 5 Whys | Ask why, repeatedly, past the first plausible answer, to the real root | why chain → root cause |
| core | Steelmanning | Build the strongest version of the opposing or alternative view before answering it | opposing view → strongest form → honest response |
| core | Second-Order Thinking | Trace what happens after the immediate consequence, not just the first-order win | action → consequence → second-order effect |
| core | Abstraction Laddering | Move up ("why does this matter") or down ("how, concretely") to find the right altitude | concrete ↔ abstract → right level |
| risk | Pre-mortem Analysis | Assume this already failed; work backwards to what caused it | failure scenario → causes → prevention |
| risk | Assumption Audit | List every assumption the plan rests on, rate each by confidence and impact, stress-test the weakest | list → rate → stress-test |
| risk | Identify Potential Risks | Brainstorm what could go wrong across every category, not just the obvious one | categories → risks → mitigations |
| risk | Cascading Failure | Trace how one failure propagates through what depends on it | trigger → propagation → single points of failure |
| framing | Reframe the Question | Challenge whether the stated problem is the real one | stated problem → reframe → true problem |
| framing | Stakeholder Lens Rotation | Adopt each affected party's view in turn on the same situation | perspective A → B → C → gaps found |
| framing | Map Is Not the Territory | Check where the plan's model of the situation diverges from the real one | model → reality check → divergence |
| competitive | Red Team vs Blue Team | One side attacks the plan, the other defends and hardens it | attack → defense → hardened version |
| competitive | Devil's Advocate | Argue against the current framing as hard as honestly possible | assumptions → challenge → strengthened case |
| collaboration | Stakeholder Round Table | Convene the goal's actual stakeholders as named viewpoints reacting to the plan | perspectives → synthesis → alignment |
| collaboration | Time Traveler Council | Past-self and future-self advise present-self on this call | past wisdom → present choice → future impact |
| collaboration | Six Thinking Hats | Rotate facts, feelings, caution, optimism, creativity, process — one at a time, no crosstalk | white → red → black → yellow → green → blue |
| creative | What If Scenarios | Explore a few alternative realities and what each implies for the plan | scenarios → implications → insight |
| creative | Constraint Injection | Add an artificial limit (half the time, half the budget) to force a sharper version | add constraint → forced rethink → evaluate |
| creative | Subtraction | Improve by removing a piece instead of adding one — most plans over-build, not under-build | current state → what to cut → simpler result |
