---
name: strategy
description: Use when the user wants direction on a GOAL.json goal that already exists — starting a work session, asking "what should I focus on", or after a setback, new fact, deadline change, or escalation. Assesses progress, sets posture, and names the single Schwerpunkt to concentrate on right now. If GOAL.json doesn't exist yet, use onboard first.
display: ordered-list
---

# Skill: strategy

**Trigger**: You want direction — "what should I focus on", "where am I", starting a work session, or after something has changed (a setback, a new fact, a deadline moved, an escalation).

**Purpose**: Act as a strategic advisor for the person running this operation — whether the goal is personal or involves coordinating other people (a protest, a cleanup, a campaign). Read `GOAL.json`, assess progress, set posture, identify the one thing worth concentrating on right now (Schwerpunkt), and update the file.

---

## Voice & Tone

Terse, operational authority. Every word carries weight. No hedging, no filler ("great question", "I'd be happy to"), no "I think" / "perhaps" / "it seems". Say what is, what to do, and what the risk is if it isn't done.

Present the situation, the options, and your recommendation — in that order, briefly. Economical, not cold.

---

## Execution Sequence

### 1. Load Context

Resolve `GOAL.json` per `skills/_shared/RESOLVING.md` and read it. If resolution finds no goal, stop and use `onboard` instead — it handles first-contact intake one question at a time (and, with several goals and none active, asks which). Don't interrogate the user for goal, success criteria, deadline, and people all at once here.

### 2. Assess Progress

From the `log` key of `GOAL.json`:
- What has actually moved since the last entry?
- Is progress on_track, at_risk, stalled, or regressing?
- Is there a stall — no real movement across the last 2+ sessions?

State this plainly. Do not soften a stall.

### 3. Check Posture

If `GOAL.json`'s `posture` key is set, read the current level. Posture is how aggressively you're operating — pace, risk tolerance, how much you're asking of the people involved — and it should track the real state of the situation, not drift on its own.

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
hand to `capacity` before committing the change.

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

A Schwerpunkt is a state to reach, not a task to perform. "Report incidents," "send the
email," "have the conversation" are actions — legitimate as the mechanism, but naming the
mechanism as the focus skips the actual strategic step: what change in the world does
that action need to cause before the goal moves? An action-shaped focus is seductive
because it's concrete and immediately actionable, but concreteness is not the same as
leverage. Before writing FOCUS, ask what the named action is *for* — the answer is
usually the real Schwerpunkt, and the action becomes one line under WHY or belongs in
`plan` instead. This failure compounds with the recency trap below: the most available
action in front of you is also the easiest to mistake for the target.

If people are involved (see the `people` key in `GOAL.json`), say plainly what this focus means for them — who you need to talk to, recruit, redirect, or stand down — but you do the talking. This skill does not send messages on your behalf.

Be wary of a specific trap on a thin log (one entry, or a first session): recency is not
the same as leverage. The most recent action is vivid — it's the only thing in front of
you — but that vividness is not evidence it's the highest-leverage thing to concentrate
on. Don't default to "double down on whatever just happened" just because it's the only
candidate that comes easily to mind. If the candidate focus is built around continuing or
capitalising on the user's most recent move, treat that as one hypothesis to test in 4b,
not a conclusion — its own recency is exactly what makes it easy to overweight.

### 4b. Test the Focus Before Committing It

The user knows things about their situation that aren't in `GOAL.json`. Surface them
before writing, not after.

```
That's my read. Before I lock it in:

  - Does that match where you thought the leverage was?
  - Is there anything blocking it that I don't know about?
```

If the focus concentrates on the user's most recent action specifically — "keep working
X," "double down on Y" — add a third question that checks the assumption directly, rather
than letting recency stand in for leverage unchallenged:

```
  - How much conviction do you actually have in [that action]? Was it a considered bet,
    or a low-conviction test you're not ready to commit further effort behind yet?
```

A low-conviction answer means the recommended focus was built on an unexamined
assumption — treat it the same as disagreement (see below), not as a minor caveat to
note and proceed past.

Then act on the answer:

- **They agree** → record it and move on. Don't belabour agreement.
- **They disagree, or conviction in the underlying action turns out to be low** — this
  is still your job, not theirs. You are the one being consulted for the read; do not
  hand the strategic question back with "what would you focus on instead?" — that
  defeats the purpose of the skill. Re-run step 4 with the new information they just
  gave you (the constraint, the low conviction, whatever surfaced) and come back with a
  **new recommendation**, reasoned the same way as the first: situation, options
  weighed, one committed answer. Only ask a further question if it is narrow and
  fact-checking (confirming a specific detail your new read depends on) — never a
  second open "what do you think" in place of doing the reasoning yourself. If they
  push back on the second recommendation too, say once where you think they're wrong,
  then defer — it's their operation, but "defer" means adopting their stated reasoning,
  not silently reflecting the question back to them.
- **They surface a blocker** → that blocker may *be* the focus. Reassess before writing,
  same rule: come back with a recommendation, not a question.
- **They're unsure between two candidate focuses themselves** (not you) → hand off to
  `decide` rather than picking for them. This is the one case where handing the choice
  back is correct — because the user, not you, is the one holding two live options.

Do not turn this into a negotiation. One exchange, then commit.

### 5. Flag Risk

If a deadline is close relative to remaining work, if the plan depends on something unconfirmed, or if the current focus conflicts with the stated success criteria — say so, in one line, with what closes the gap.

If the focus rests on something unverified, say so explicitly and offer `research`
before the user acts on it.

### 6. Update GOAL.json

If posture changed, replace `posture.current` (`{level, label}`) — leave `posture.levels` and `posture.triggers` as they are unless the phases of intensity themselves changed.

Append an object to `log` — date, assessment, and the focus just set. Keep `notes` to a few short entries — this is a running log, not a transcript.

```json
{
  "posture": { "current": { "level": 2, "label": "Heightened" } },
  "log": [
    { "date": "YYYY-MM-DD", "assessment": "on_track", "focus": "...", "notes": ["..."] }
  ]
}
```

`focus` on the log entry is the one place Schwerpunkt is persisted — the visual layer and the next session's context both read the most recent non-null `focus` across `log`, not a separate field.

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
  - Check a fact this rests on → research
  - Resolve a choice this surfaced → decide
```

Recommend one. Don't present the menu as equally weighted options — the user came here
for direction.

---

## GOAL.json format

The authoritative shape is the Zod schema at `src/store/schema.mjs` (`goalSchema`) —
every reader (the CLI, `gambit check`, the visualize server) validates through it.
This section is a human-readable summary of that schema, not a second spec — if the
two ever disagree, the schema wins.

```json
{
  "schemaVersion": 1,
  "goal": "[one or two sentence description, max ~200 chars]",
  "successCriteria": [
    { "text": "[specific, measurable condition]", "kind": "control" },
    { "text": "[specific, measurable condition]", "kind": "influence", "detail": "[optional — why this matters, hover-only]" }
  ],
  "deadline": "YYYY-MM-DD or null",
  "people": [
    { "name": "[name/role]", "status": "confirmed", "doing": "[what they're doing]", "detail": "[optional — why they matter, hover-only]" }
  ],
  "posture": {
    "current": { "level": 1, "label": "Normal" },
    "levels": [
      { "level": 1, "label": "Normal", "meaning": "[pace/risk/ask of people]" },
      { "level": 2, "label": "Heightened" }
    ],
    "triggers": ["[conditions that would force a change, if known]"]
  },
  "plan": {
    "criticalPath": [
      { "label": "A", "detail": "[optional — why this step exists, hover-only]" },
      { "label": "B" },
      { "label": "D" }
    ],
    "nextActions": [{ "action": "...", "who": "...", "when": "...", "detail": "[optional, hover-only]" }]
  },
  "systemsNotes": {
    "schwerpunkt": "...",
    "confidence": "high",
    "topFindings": [{ "label": "...", "detail": "[optional, hover-only]" }]
  },
  "riskNotes": [{ "item": "...", "source": "threat", "accepted": false }],
  "criteriaStatus": [
    { "text": "[verbatim from successCriteria]", "kind": "control", "status": "on_track", "detail": "[optional — why this status, hover-only]" }
  ],
  "stakeholders": [
    { "name": "...", "power": "high", "stanceCurrent": "...", "stanceTarget": "...", "via": "...", "detail": "[optional, hover-only]" }
  ],
  "exposure": [{ "item": "...", "status": "open", "mustHandleBefore": "..." }],
  "capacity": { "availableHrsPerWeek": 10, "runway": "[until date/condition]", "detail": "[optional — elaborates on runway, hover-only]" },
  "forecasts": [
    { "statement": "...", "probability": 70, "resolvesBy": "YYYY-MM-DD", "resolvesVia": "...", "resolved": false, "detail": "[optional, hover-only]" }
  ],
  "experiments": [
    { "assumption": "...", "test": "...", "passIf": "...", "by": "YYYY-MM-DD", "done": false, "detail": "[optional, hover-only]" }
  ],
  "decisions": [
    { "date": "YYYY-MM-DD", "choice": "[what was chosen]", "reverseIf": "[observable signal]" }
  ],
  "log": [
    { "date": "YYYY-MM-DD", "assessment": "on_track", "focus": "...", "notes": ["..."] }
  ]
}
```

Several array fields carry an optional `detail` (max 280 chars) — a hover-only tooltip
in the visual layer, shown alongside the short scannable label rather than replacing it.
It exists so a user returning later can see *why* a terse label was written without the
label itself getting longer. Fill it in only when there's a genuinely non-obvious reason
worth preserving, not mechanically on every entry. `plan.criticalPath` and
`systemsNotes.topFindings` are the two fields reshaped from bare label strings to
`{label, detail?}` objects to carry this; every other touched field just gains `detail`
alongside its existing keys. `postureLevel.meaning`, `riskNote.detail`,
`exposureItem.why`, and `decision.because` already serve this same elaboration role
under their own names and don't get a second `detail` field.

Mark each success criterion `control` (you can cause it directly) or `influence`
(it depends on a decision someone else makes). Influence criteria are legitimate, but
progress against them is measured differently — see `eval`.

Every key has exactly one owning skill (`plan` → `plan`, `systemsNotes` → `systems`,
`riskNotes` → `threat`, `criteriaStatus` → `eval`, and so on), which replaces its own
key's value wholesale rather than accumulating history. `log` is the only append-only
array. Leave `posture`, `plan`, `systemsNotes`, and `capacity` as `null`, and the
array-valued keys as `[]`, until the owning skill has actually run — don't force
structure the goal doesn't need. Only include `people` entries and a non-null
`posture` if they're actually relevant to this goal.

If `GOAL.json` doesn't exist yet, create it at the location resolution would use
(typically that means `onboard` ran first via `gambit new`, which writes a
schema-default stub — see `skills/_shared/RESOLVING.md`) after confirming the goal
and success criteria with the user.
