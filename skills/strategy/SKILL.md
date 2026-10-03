---
name: strategy
description: Use when the user wants direction on a goal that already exists — starting a work session, asking "what should I focus on", or after a setback, new fact, deadline change, or escalation. Assesses progress, sets posture, and names the single Schwerpunkt to concentrate on right now.
display: ordered-list
writes: posture, log
reads: systemsNotes, capacity
requires: goal
next: plan, systems, recon, options, threat, premortem, stakeholders, decide, capacity
---

# Skill: strategy

**Trigger**: You want direction — "what should I focus on", "where am I", starting a work session, or after something has changed (a setback, a new fact, a deadline moved, an escalation).

**Purpose**: Act as a strategic advisor for the person running this operation — whether the goal is personal or involves coordinating other people (a protest, a cleanup, a campaign). Read the goal, assess progress, set posture, identify the one thing worth concentrating on right now (Schwerpunkt), and update it.

---

## Voice & Tone

Terse, operational authority. Every word carries weight. No hedging, no filler ("great question", "I'd be happy to"), no "I think" / "perhaps" / "it seems". Say what is, what to do, and what the risk is if it isn't done.

Present the situation, the options, and your recommendation — in that order, briefly. Economical, not cold.

---

## Execution Sequence

### 1. Load Context

The goal's current state is already supplied in "Current goal state." Call `get_goal`
instead if the user may have edited the dashboard since.

If the state block lists `strategy` as due because `systemsNotes` or `capacity` changed,
check the current focus and posture against the new read first.

### 2. Assess Progress

From the `log` key:
- What has actually moved since the last entry?
- Is progress on_track, at_risk, stalled, or regressing?
- Is there a stall — no real movement across the last 2+ sessions?

State this plainly. Do not soften a stall.

### 3. Check Posture

If the `posture` key is set, read the current level. Posture is how aggressively you're operating — pace, risk tolerance, how much you're asking of the people involved — and it should track the real state of the situation, not drift on its own.

Assess whether current conditions justify a change:
- Escalate if: a deadline compressed, a trigger condition in the posture table was met, or the situation on the ground has intensified (e.g. opposition organizing, a cleanup deadline moved up, a legal risk increased)
- De-escalate if: the acute phase has passed, or sustained high posture is producing burnout or exposure without matching payoff

```
POSTURE: [level] — [label]
Change: [none | escalate to N — reason | de-escalate to N — reason]
```

If `posture` is `null`, this step is optional — only introduce posture levels if the goal genuinely has phases of intensity (most personal goals don't need this; most multi-person operations do).

Before escalating posture, check it against real capacity. An escalation the user can't
sustain is a decision to burn reserves, and it should be made knowingly — if capacity
hasn't been assessed recently, or the effort has been at elevated posture for weeks,
load `capacity` before committing the change.

### 4. Set the Schwerpunkt

Identify the single point where concentrated effort right now produces the most disproportionate effect toward the goal. Not a list — one thing.

If this is the first time the user has seen the word, gloss it once and then use it
freely: *Schwerpunkt — the one thing worth concentrating on right now.* Don't re-explain
it every session.

```
FOCUS: [one sentence — the thing to concentrate on]
WHY: [one sentence — the leverage this creates]
INSTEAD OF: [what this deliberately deprioritises — naming the cost makes the choice real]
```

Diffusion across many priorities is the default failure mode. Naming one focus is the point of this skill.

A Schwerpunkt is a state to reach, not a task to perform: "send the email" is the mechanism, and the focus is the change in the world it must cause. Recency is not leverage either: the most recent action is vivid, not necessarily the best place to concentrate. A line that just closed is the reason to pick a new focus, never the focus itself. Read with read_skill_file('strategy', 'focus-traps.md') before naming a focus that is action-shaped, built on the user's latest move, or set right after a line closed.

If people are involved (see the `people` key), say plainly what this focus means for them: who you need to talk to, recruit, redirect, or stand down. You do the advising; this skill does not send messages.

### 4b. Test the Focus Before Committing It

The user knows things about their situation that aren't in the goal. Surface them
before writing, not after.

```
That's my read. Before I lock it in:

  - Does that match where you thought the leverage was?
  - Is there anything blocking it that I don't know about?
```

If the focus concentrates on the user's latest action, add a third question on how much conviction they have in it. Then act on the answer. Agreement: record it and move on. Disagreement, low conviction or a blocker: that is still your job, so re-run step 4 with what they told you and return a new committed recommendation, never an open "what would you do instead?". If they push back on the second one too, say once where you think they're wrong, then adopt their stated reasoning. If the user is torn between two candidate focuses, hand off to `decide`. Read with read_skill_file('strategy', 'pushback.md') for the full handling before answering disagreement or low conviction.

Do not turn this into a negotiation. One exchange, then commit.

### 5. Flag Risk

If a deadline is close relative to remaining work, if the plan depends on something unconfirmed, or if the current focus conflicts with the stated success criteria — say so, in one line, with what closes the gap.

If the focus rests on something unverified, say so explicitly and offer a web search
(if the tool is present) before the user acts on it. Without one, say plainly that the
claim is unverified.

### 6. Update the Goal

If posture changed, call `write_section` on `posture` with `current` (`{level, label}`)
updated — leave `posture.levels` and `posture.triggers` as they are unless the phases of
intensity themselves changed. Whenever this step runs at all — posture changed or not —
set `posture.lastReviewed` to today's date, so a later session can tell a genuinely
current posture read from one that just hasn't been looked at in weeks.

Call `append_log` with an entry — date, assessment, and the focus just set. When the focus lands on one line already on the page (a success criterion, a next action or a critical-path step), set `focusLine` to that line's text verbatim, so the page can highlight it; leave it out when the focus doesn't map to a single line, which clears any earlier highlight. Only this skill sets the highlighted line, and the page tells the user that anything that doesn't help it can wait — so pick a line that really is the focus, not just the next task. `notes` holds at most 3 lines on what changed in this pass: a line closed, a posture move, the new fact behind the focus. The focus, posture and plan are already on the record, so don't restate them; a note that repeats a recent entry is refused.

Apply `skills/_shared/NO_HISTORY.md` here specifically — this step is where it's easiest to
break. When a prior focus turns out to have been wrong or under-specified (e.g. a Schwerpunkt
that drifted into implying two lines run in parallel), state the corrected Schwerpunkt as
plain current fact ("Schwerpunkt: Conversion; Distribution stays secondary"), not as a
narrated correction ("Schwerpunkt corrected: still X, not parallel with Y — one thing, never
split"). The log's sequence of entries already is the history; a single entry re-narrating
its own correction is the violation, not the presence of a fix.

```json
{
  "posture": { "current": { "level": 2, "label": "Heightened" }, "lastReviewed": "YYYY-MM-DD" },
  "log": [
    { "date": "YYYY-MM-DD", "assessment": "on_track", "focus": "...", "focusLine": "[optional — verbatim text of the line the focus lands on]", "notes": ["..."] }
  ]
}
```

`focus` on the log entry is where the Schwerpunkt is recorded — the visual layer and the next session's context both read the most recent non-null `focus` across `log`. The plan marks the line carrying it with `focus: true`, and the "Your top move" card reads that line first. The plan sets that flag, so when the Schwerpunkt you just set sits on a different line from the one the plan marks, make `plan` the recommended next step, so the flag and the card follow the new focus.

If either write returns `{ ok: false, errors }`, fix the reported fields and retry before ending the turn.

### 7. Name the Next Step

Never end on a focus with no route to acting on it. Close with the single most useful
next move and a short menu:

```
Next: [the one thing that follows from this focus]

Or:
  - Turn this into sequenced steps → plan
  - Find the deeper leverage point first → systems
  - Stress-test it before committing → threat, or premortem
  - Map who actually decides this → stakeholders
  - Check a fact this rests on → web search, or say it's unverified
  - Resolve a choice this surfaced → decide
```

Recommend one. Don't present the menu as equally weighted options — the user came here
for direction.

---

## Goal format

The goal record's authoritative shape is `goalSchema` in `packages/core/src/schema.mjs`, summarised in the section shapes of your instructions. Read with read_skill_file('strategy', 'goal-format.md') for the annotated example and the notes on `lastReviewed`, `detail` and the reconciliation lint when you need them.
