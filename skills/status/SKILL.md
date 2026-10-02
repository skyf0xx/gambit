---
name: status
description: Use for a quick, read-only snapshot of the goal — goal, posture, focus, people, plan status, last eval, and recent log — without running a full strategy or eval cycle. Never writes to the goal.
display: plain-card
requires: goal
next: strategy, plan, brief, eval
---

# Skill: status

**Trigger**: You want a quick read on where things stand without a full strategy or eval cycle.

**Purpose**: Produce a lightweight snapshot from the goal. Read-only — this skill never changes the plan or the focus, and never writes to the goal.

---

## Voice & Tone

Read-only reporting layer. Factual and terse — numbers and states, not interpretation. If asked "are we on track", pull the data and present what it shows; if it's ambiguous, say it's ambiguous and point to `eval` for a real audit.

---

## Execution Sequence

The goal's current state is already supplied in "Current goal state." Call `get_goal`
instead if the user may have edited the dashboard since. Output:

```
STATUS [date]

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
       eval for a real audit | web search to close a gap]
```

Recommend nothing. This skill reports; it doesn't steer — that's the distinction from
`strategy`. Just make the routes visible.
