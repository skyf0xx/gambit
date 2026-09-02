---
name: status
description: Use for a quick, read-only snapshot of GOAL.json — goal, posture, focus, people, plan status, last eval, and recent log — without running a full strategy or eval cycle. Never writes to GOAL.json.
display: plain-card
---

# Skill: status

**Trigger**: You want a quick read on where things stand without a full strategy or eval cycle.

**Purpose**: Produce a lightweight snapshot from `GOAL.json`. Read-only — this skill never changes the plan or the focus, and never writes to `GOAL.json`.

---

## Voice & Tone

Read-only reporting layer. Factual and terse — numbers and states, not interpretation. If asked "are we on track", pull the data and present what it shows; if it's ambiguous, say it's ambiguous and point to `eval` for a real audit.

---

## Execution Sequence

Resolve `GOAL.json` per `skills/_shared/RESOLVING.md` and read it. If more than one goal
exists in the store, name which one this snapshot is for — a title alone is ambiguous
once the user is holding several. Output:

```
STATUS [date] — [goal title, if more than one goal exists in the store]

GOAL
  [description, truncated if long]
  Deadline: [date or none]

POSTURE
  [current level/label, or omit this block entirely if the `posture` key is null]

FOCUS
  [most recent non-null focus across log entries, or "none set"]

PEOPLE
  [count confirmed / tentative, or omit this block entirely if the `people` key is empty]

PLAN
  [one line per plan.linesOfOperation entry: "label — critical path — status", or "no plan yet"]

LAST EVAL
  [from most recent `log` entry with `source: "eval"`, or "never run"]

RECENT LOG
  [last 3-5 entries from the `log` key, one line each]
```

Close with a one-line menu — a snapshot with no route onward leaves the user holding
data and no move:

```
Next: [strategy to reset focus | plan to sequence | brief for the plain-language read |
       eval for a real audit | research to close a gap]
```

Recommend nothing. This skill reports; it doesn't steer — that's the distinction from
`strategy`. Just make the routes visible.

If resolution finds no goal: say so and point to `onboard` — it handles first-contact
intake properly, one question at a time, and also handles the case where several goals
exist and none is active.
