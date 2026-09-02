---
name: premortem
description: Use before committing to a significant plan or an irreversible action. Assumes the effort has already failed, then works backwards to explain why — a prospective hindsight technique that surfaces failure modes outside-in red-teaming reliably misses, especially ones the user privately suspects but hasn't said aloud.
display: plain-card
---

# Skill: premortem

**Trigger**: A plan is about to be committed to, or an action is about to be taken that
can't be walked back. Also use when a plan feels solid and nobody can articulate why it
might not be — that comfort is itself the signal.

**Purpose**: Surface failure modes that red-teaming misses.

`threat` asks "how could this be attacked or go wrong?" — an outside-in question, and
people answer it analytically. This asks something different: **it is [date]. This
failed. Explain why.** The failure is stipulated, not hypothesised, and that single
change reliably produces different answers. People who can't generate criticism of a
plan they're invested in can readily generate an explanation for an outcome they've been
told already happened.

Both moves are needed. This one is worth running even when `threat` returned little.

---

## Voice & Tone

Committed to the premise. Do not hedge back toward "this might not happen" — the
technique works because the failure is treated as fact for the duration. Write in past
tense throughout.

Concrete and unsparing. "Momentum was lost" is not a failure explanation; "the follow-on
date was never announced, so the WhatsApp group went quiet within nine days and the
organisers who'd taken time off work didn't come back" is.

Not doom-mongering. The output is a list of things to fix while fixing is still cheap.
Say that at the end, and mean it.

---

## Execution Sequence

### 1. Load Context

Read `GOAL.json` — goal, success criteria, deadline, `plan` key, `people` key,
`riskNotes` and `systemsNotes` keys if present.

### 2. Set the Scene

Pick a date far enough out that the outcome would be known — just past the deadline, or
past the point where the current plan would have resolved. State it plainly:

```
It is [date]. [The goal] did not happen.

[One sentence on what the failed end-state looks like concretely — not "we fell short",
but what someone would actually observe.]
```

### 3. Generate Causes — Widely, Before Filtering

Write the failure explanations. Aim for eight to twelve before assessing any of them;
the valuable ones tend to arrive late, after the obvious ones are exhausted.

Work deliberately across categories, because unaided generation clusters in one or two:

- **Execution** — something didn't get done, or got done late or badly
- **People** — someone left, didn't deliver, fell out, burned out, or was never really committed
- **External** — a decision went the other way, the environment shifted, timing collided with something bigger
- **Assumption** — something believed to be true simply wasn't
- **Second-order** — an action worked, and its consequence undid the goal
- **Sustained attention** — nothing dramatic failed; it just quietly stopped
- **The operator** — the user ran out of money, time, energy, or will

That last category is the one most often omitted and most often correct. Include it.

Then the sharpest question in the technique:

```
Which of these did you already suspect before I listed them?
```

A failure the user privately anticipated but hadn't said aloud is the highest-value
finding this skill produces. It is almost never the most dramatic item on the list.

### 4. Rank

```
CAUSE: [past tense, specific]
  Plausibility: high | medium | low
  Would it have been visible early? yes | no — [the signal that would have shown it]
  Preventable now? yes | partly | no
  Cost to prevent: [what it takes today]
```

Prioritise on plausibility × preventability. A high-plausibility cause that was invisible
until too late deserves an early-warning indicator even if it can't be prevented.

### 5. Separate the Fatal from the Survivable

```
FATAL — would have ended the goal on its own:
  [cause] → prevent by [action]

DEGRADING — would have hurt, recoverable:
  [cause] → mitigate by [action]

ACCEPTED — inherent to attempting this at all:
  [cause] → the cost of playing
```

Be honest about the third category. Some risk is the price of the goal, and pretending
otherwise produces a plan that only works in a world where nothing is at stake.

### 6. Convert to Changes

Every fatal cause needs one of: a change to the plan, an early-warning indicator, or an
explicit acceptance. No fatal cause leaves this skill unhandled.

```
CHANGE: [what to alter in the plan now]
WATCH: [indicator] — [what it would look like] — [check when]
ACCEPT: [risk] — [why it's worth carrying]
```

### 7. Elicit

```
Two questions:

  - Which of those felt most real to you — not most likely, most real?
  - Is there a version of failure I haven't described that you'd recognise?
```

The user's gut on which failure "feels real" is signal. It's often a pattern they've seen
before in their own history, and it deserves weight the analysis can't supply.

### 8. Update GOAL.json

Append the fatal causes and their mitigations to the `riskNotes` array (the array `threat` owns — append rather than replace, and label each with `source: "premortem"` so the source is clear). Add any early-warning indicators as watch items. Log a one-line summary.

Each appended entry must have:
- `item` (required, max 120 chars): the fatal cause or mitigation
- `detail` (optional, max 120 chars): additional context
- `source` (required): must be "premortem" for items this skill appends
- `accepted` (required): boolean; true if user explicitly chose to accept this risk

```json
{
  "riskNotes": [
    { "item": "...", "detail": "...", "source": "premortem", "accepted": false }
  ]
}
```

Immediately after writing, run `gambit check`. If it fails, fix the reported fields and
re-run before ending the turn — see AGENTS.md's "Validate every write."

### 9. Name the Next Step

```
Next: [the single most important plan change this produced]

Or:
  - Rework the sequence around these → plan
  - The fatal cause is unverified → research
  - Preventing it means a real tradeoff → decide
  - This changes what matters most → strategy
```

Close by saying plainly that the failure was hypothetical and the fixes are not. The
point of the exercise is that all of this is still cheap to change.
