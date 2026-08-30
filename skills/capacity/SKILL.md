---
name: capacity
description: Use when the plan assumes more time, money, or personal energy than actually exists — or periodically on any sustained effort. Assesses the operator's real capacity and runway, checks whether posture is sustainable, and finds the culminating point in concrete personal terms rather than abstract ones. The failure mode it catches is the operator running out before the goal does.
---

# Skill: capacity

**Trigger**: The plan is getting bigger, the timeline is getting longer, or the user is
tired. Also run periodically on any effort lasting more than a few weeks, and whenever
`strategy` escalates posture — an escalation nobody has checked against real capacity is
how sustained efforts end.

**Purpose**: Check whether the person running this can actually run it, for as long as
it needs running.

`systems` analyses the culminating point abstractly — the moment past which effort yields
less. This one asks the concrete version: **when do *you* run out?** Of hours, of money,
of goodwill at home or at work, of the energy to keep asking people for things.

Most sustained coordination efforts don't fail because the strategy was wrong. They fail
because the person driving it stopped, and everything downstream of them stopped too.

---

## Voice & Tone

Direct and practical, not therapeutic. This is a resource assessment. The user is an
adult making their own choices about what to spend themselves on, and the job is accurate
information, not persuasion toward balance.

Do not moralise about rest, and do not catastrophise about burnout. Equally, do not
collude with a plan that obviously doesn't fit the hours available — that's the specific
failure this skill exists to catch, and softening it is the way to be useless.

Where the numbers don't work, say so plainly and give options. The user decides.

---

## Execution Sequence

### 1. Load Context

Read `GOAL.md` — goal, deadline, `## Plan`, `## Posture`, `## People`, and the log. Look
at the log's rhythm as much as its content: gaps, and stretches of high activity, both
carry information.

### 2. Establish the Real Numbers

Ask directly. Estimates are fine; precision isn't the point, and orders of magnitude are.

```
TIME
  Hours per week actually available for this: [N]
  Competing commitments: [work, family, study, other obligations]
  Is that sustainable, or is it borrowed from something? [what's being displaced]

MONEY (if the goal costs anything)
  Spent so far: [N]
  Committed but unspent: [N]
  Available before it hurts: [N]
  Is any of it other people's? [obligations that creates]

ENERGY
  Current level: [running well | tired but fine | running on reserves | depleted]
  How long at this rate: [honest estimate]
  Last real break: [when]
```

Ask once, plainly, and accept whatever's given. If the user won't put numbers on it, work
with ranges and note the assessment is rough.

### 3. Compare Against the Plan

The core arithmetic:

```
PLAN REQUIRES: [estimated hours/week to execute the current plan]
ACTUALLY AVAILABLE: [N hours/week]
GAP: [surplus | matched | short by N]

RUNWAY: [how long the current rate can hold — weeks, months]
DEADLINE: [time remaining]
VERDICT: [runway exceeds deadline | runway falls short by N | no deadline, but rate is
          unsustainable from [date]]
```

If the plan requires more than is available, say it plainly and immediately. Do not soften
it and do not present it as a motivation problem. A plan that needs twenty hours a week
from someone who has six is not a discipline failure; it's an arithmetic error, and it
resolves by changing the plan.

### 4. Check Posture Against Capacity

If `## Posture` is in use:

```
POSTURE vs CAPACITY
  Current posture: [level] — implies [pace, concurrent asks, margin]
  Capacity supports: [level]
  Mismatch: [none | posture exceeds capacity — sustainable for ~N weeks]
```

Elevated posture is meant to be temporary. A posture that's been elevated for months isn't
a posture — it's the new baseline, and it's consuming reserves that were meant for the
moment they're actually needed. Say so where it's happening, and say when it started.

### 5. Single-Point-of-Failure: The Operator

```
IF YOU STOPPED FOR TWO WEEKS
  What continues: [...]
  What stops: [...]
  What breaks permanently: [...]
```

Almost always, too much stops. That's diagnostic rather than damning, but it's worth
seeing concretely. If the answer is "everything stops", the effort has no resilience —
and building some is a strategic question, not a personal one.

Where `## People` exists, ask what could be handed over. The usual blocker isn't
willingness; it's that nothing has been written down in a form anyone else could pick up.

### 6. The Honest Culminating Point

```
CULMINATING POINT — personal
  At current rate, you run short of [time | money | energy] around [date/condition]
  Warning signs to watch: [specific and observable — the log going quiet, missed
                           commitments, dreading the work, avoiding the file]
  What extends it: [reduce scope | hand off | slow the pace | add money | recruit]
```

Frame warning signs as observable events, not feelings. "Two weeks with no log entry" is
checkable; "feeling overwhelmed" gets rationalised away in the moment.

### 7. Give Real Options

Where capacity falls short, don't leave it as a problem. Lay out the actual choices —
they're limited, and seeing all four together makes the decision cleaner:

```
OPTIONS
  1. Cut scope — [what specifically comes out] — [what that costs against the criteria]
  2. Extend time — [is the deadline actually fixed?] — [what that costs]
  3. Add capacity — [who, doing what, and what recruiting them costs]
  4. Sustain and accept — [what breaks, and when]
```

Option 4 is legitimate. Sometimes an effort is worth spending yourself on for a fixed
period, and a fixed sprint at a known cost with an end date is very different from an
open-ended one nobody has measured. Make it a choice rather than a drift.

### 8. Elicit

```
  - Does that match how it actually feels, or am I over- or under-reading it?
  - What would you drop first if you had to drop something?
```

The second question surfaces the real priority ordering, which is often different from the
plan's stated one — and that difference is worth carrying back to `strategy`.

### 9. Update GOAL.md

Add or replace a `## Capacity` section — the honest hours, the runway, and the culminating
condition. Keep it short and current.

```
## Capacity
Available: [N hrs/week] — Runway: [until date/condition]
Watch: [the specific warning sign]
```

Log a one-line summary. If capacity forces a scope change, hand to `plan` or `strategy`
rather than quietly trimming the plan here.

### 10. Name the Next Step

```
Next: [the single change that closes the gap, or "nothing — capacity fits the plan"]

Or:
  - Cut or resequence the plan → plan
  - The goal itself needs resizing → strategy
  - Choosing between the options above → decide
  - Hand something over → comms, then plan
```

If capacity genuinely fits the plan, say so and stop. This skill should return "you're
fine" when that's true — a check that always finds a problem stops being believed.
