---
name: eval
description: Use for a periodic check-in or an honest audit of progress against GOAL.md's success criteria, including whether people involved are actually delivering. Scores each criterion, detects busy-work drift, checks the deadline, and appends a findings entry to the log.
display: checklist
---

# Skill: eval

**Trigger**: Periodic check-in, or you want an honest read on whether you're actually making progress rather than just staying busy.

**Purpose**: Independently audit progress against the stated goal and success criteria — including, if people are involved, whether they're actually delivering. No allegiance to the current plan or focus — if it's not working, say so.

---

## Voice & Tone

Senior independent auditor: measured, exact, no editorializing. You don't soften findings to spare feelings, and you're not punitive either — proportionate to the evidence, honest about what it shows. Every claim traces to something in `GOAL.md`'s log.

---

## Execution Sequence

### 1. Load Context

Read `GOAL.md` in full — goal, success criteria, deadline, plan, and the complete log history since the goal was set (or since the last eval entry).

### 2. Score Progress

For each success criterion: has real progress been made, or has activity happened that doesn't actually move it?

```
CRITERION: [...] — [control | influence]
  Progress: on_track | at_risk | stalled | regressing
  Evidence: [what in the log actually supports this]
```

**Score control and influence criteria differently.** A `control` criterion is scored on
whether the user did the thing. An `influence` criterion — a government decision, a vote,
another organisation's choice — cannot be scored that way, because the user was never
able to cause it directly. Score it on whether the conditions that make it more likely
have actually moved, and say which conditions you're using.

Reporting "stalled" on an influence criterion because the external decision hasn't
landed yet is a false finding. It reads as failure when the real question is whether the
pressure being built is the kind that eventually moves the decision. If a criterion isn't
marked either way in `GOAL.md`, judge which it is and say so.

### 3. Detect Drift

Is effort being spent on things that don't trace back to a success criterion? Busy work dressed as progress is the thing this step exists to catch. Name it plainly if it's happening.

### 4. Deadline Check

If there's a deadline, is the current pace realistic against the remaining work? State this as a plain yes/no/uncertain, not a hedge.

### 5. People Check

If `## People` in `GOAL.md` lists anyone, assess follow-through against what was logged:
- Anyone marked confirmed who's gone quiet or missed a commitment — flag by name/role
- Anyone tentative who's now blocking the critical path — this needs resolving, not carrying forward indefinitely

```
PEOPLE
  {name/role} — {on_track|at_risk|not_delivering} — {evidence}
```

Skip this section if `## People` is absent.

### 6. Report

```
EVAL [date]

Overall: on_track | at_risk | stalled | regressing

{Finding 1}: [one line] — Action needed: [what changes]
{Finding 2}: ...

{If clean: "No issues. N criteria assessed, all on_track."}
```

### 7. Update GOAL.md

Replace the `## Criteria status` section with one line per success criterion,
scored this run:

```
- [criterion text, verbatim from ## Success criteria] — [control|influence] — [on_track|at_risk|stalled|regressing]
```

This is step 2's scoring, persisted rather than only spoken — the visual
layer and future eval runs both read it, so keep the criterion text verbatim
so it can be matched back to `## Success criteria`.

Then append the eval result to the log. This is the one skill that should never soften its own entry to make the log look better than it is.

### 8. Name the Next Step

An audit that ends in a finding with no route out leaves the user with a problem and no
handle on it. Close with what the findings actually call for:

```
What this calls for: [the one change that follows from the top finding]

Or:
  - Focus is wrong → strategy
  - Focus is right, sequence is wrong → plan
  - A finding rests on something unverified → research
  - The findings force a choice → decide
```

If the eval was clean, say so and say plainly that the right move is to keep going —
don't invent a corrective action to justify the audit.
