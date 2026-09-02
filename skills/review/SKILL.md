---
name: review
description: Use after a discrete event, milestone, or push has completed — successful or not. Runs a structured after-action review — what was expected, what happened, why they differed, what transfers to next time — and converts the findings into concrete changes. Distinct from eval, which audits progress against GOAL.json's success criteria rather than learning from a completed action. Appends to GOAL.json's log and folds findings into the plan.nextActions array.
display: timeline
---

# Skill: review

**Trigger**: Something finished. A rally, a launch, a meeting, a submission, a negotiation,
a phase of work. It went well, badly, or ambiguously — all three are worth reviewing, and
the successful ones are the most commonly skipped.

Run it while memory is fresh. A review a week later loses most of the detail that makes
it useful.

**Purpose**: Convert a completed action into transferable knowledge. `eval` asks "are we
making progress toward the goal?" This asks "what did that specific thing teach us, and
what do we do differently next time?"

The discipline that makes an after-action review work is comparing **expected against
actual**, and taking the gap seriously in both directions. An outcome better than
expected is as informative as a worse one, and is almost never examined.

---

## Voice & Tone

Factual and blameless. The purpose is learning, not accounting. Blame ends disclosure,
and a review nobody is honest in is worse than no review — it manufactures false
confidence.

Blameless does not mean vague. "Comms went out late" is a finding; "there were some
timing challenges" is not. Name what happened precisely, and attribute it to a cause
rather than a person.

Where a person genuinely didn't deliver, that belongs in `eval`'s people check, not here.
This skill examines the system that let it matter.

---

## Execution Sequence

### 1. Load Context

Read `GOAL.json` — the goal, the `plan` key as it stood, the `people` key, the `riskNotes` array, and
the log entries covering the period being reviewed. If a `premortem` was run, pull its
predicted causes: checking them against what actually happened is one of the most
valuable comparisons available.

### 2. Establish What Was Expected

Before discussing what happened, pin down what was supposed to happen. Reconstruct from
the plan and log, not from memory — memory reshapes itself around outcomes.

```
WHAT WE EXPECTED
  Intended outcome: [from the plan]
  Success looked like: [the concrete measure, if one was set]
  Key assumptions: [what the plan rested on]
  Predicted risks: [from threat or premortem, if run]
```

If no expectation was recorded, say so plainly and note it as a finding in its own right
— an action taken with no stated expected outcome can't be learned from properly, and
that's worth fixing before the next one.

### 3. Establish What Actually Happened

Facts and sequence. Resist interpretation at this stage; it contaminates the next step.

```
WHAT HAPPENED
  Outcome: [what actually resulted]
  Against the measure: [exceeded | met | fell short | not measurable]
  Timeline: [what happened when — only where the sequence matters]
  Surprises: [what nobody predicted, in either direction]
```

### 4. Examine the Gap

For each meaningful difference between expected and actual — including favourable ones:

```
GAP: [expected X, got Y]
  Why: [the actual cause, as far as it can be established]
  Was it knowable in advance? yes | no
    If yes: what would have revealed it — and why didn't it?
  Systemic or one-off? [would it recur under the same conditions?]
```

"Was it knowable in advance" is the question that upgrades a review from a recap into
something that changes future behaviour. A knowable-but-missed cause points at a gap in
the process, not just bad luck.

Check the predicted risks explicitly:

```
PREDICTED RISKS — what actually happened
  [risk] — materialised | didn't | materialised differently: [how]
```

Risks predicted that didn't materialise matter too. Either the mitigation worked (keep
it) or the risk was overrated (recalibrate — and note it, because systematic
over-prediction wastes effort and credibility).

### 5. Sustain / Improve

The core output. Both halves are required.

```
SUSTAIN — worked, do it again deliberately
  [what] — [why it worked, so it can be repeated rather than re-lucked into]

IMPROVE — change before next time
  [what] — [the specific change] — [who owns it]
```

"Sustain" is the half people skip. Something that worked by accident and isn't identified
will not reliably happen again. Name the mechanism, not just the outcome.

Cap "improve" at three to five items. A review that produces fifteen changes produces
none.

### 6. Elicit

The user was there. You are working from the file.

```
Three questions:

  - What's your read on why it went the way it did?
  - What surprised you most?
  - Anything that went wrong that isn't in the plan or the log at all?
```

That last question matters most. The failures that never reach the written record are
usually interpersonal or about the user's own capacity, and they're the ones that repeat.

### 7. Check the Goal Still Holds

A completed action is a natural moment to ask whether the goal itself still makes sense
in light of what was learned. Ask once, without pushing:

```
Does this change anything about what you're actually going for?
```

If yes, hand to `strategy` — don't renegotiate the goal from inside a review.

### 8. Update GOAL.json

Append a compact `log` entry: what was reviewed, the outcome against expectation, and the top one
or two lessons. Fold "improve" items into the `nextActions` array of whichever line of operation the reviewed event belongs to, under `plan.linesOfOperation` — each as `{ action: "Review: <finding>", who, when, status: "pending" }`. If the event doesn't map cleanly to one line (or `plan` has only one), add it there rather than guessing a split. Preserve the `status` already on any existing action in that array — appending new findings is not a reason to touch ones already marked `done` or `dropped`. Where a predicted risk proved wrong, update the corresponding `riskNotes` array entry's `accepted` field if needed.

Example log entry with source="review":
```json
{
  "log": [
    {
      "date": "2026-09-02",
      "assessment": "on_track",
      "focus": null,
      "notes": ["Timing lag cost two days; process needs tightening", "Message landed better than expected — repeat that framing"],
      "source": "review"
    }
  ]
}
```

Example adding findings to a line's nextActions (preserve existing plan structure — other lines, that line's criticalPath — just append to the one array):
```json
{
  "plan": {
    "linesOfOperation": [
      {
        "label": "Main",
        "criticalPath": [...],
        "nextActions": [
          { "action": "Review: tighten comms timeline — coordinate internally before external announcement", "who": "you", "when": "before next phase" },
          { "action": "Review: document the messaging that resonated for reuse", "who": "you", "when": "this week" }
        ],
        "status": "on_schedule"
      }
    ]
  }
}
```

Do not paste the full review into `GOAL.json` — the file holds current state, and the
detailed review belongs in the conversation or the user's own notes.

### 9. Name the Next Step

```
Next: [the single most important change to carry forward]

Or:
  - Fold the lessons into the sequence → plan
  - This changed the picture → strategy
  - Audit overall progress while you're here → eval
  - A lesson raises a question worth answering properly → research
```
