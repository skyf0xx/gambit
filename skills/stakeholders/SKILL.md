---
name: stakeholders
description: Use when the goal depends on people who are neither on your team nor your opponents — councils, regulators, media, landowners, sponsors, rival organisers, the undecided public. Maps who holds power over the outcome, what each actually wants underneath their stated position, and where the movable middle is. Distinct from threat, which models opposition to degrade.
display: stakeholder-table
writes: stakeholders, people, log
requires: goal
phase: understand
next: negotiate, comms, strategy, systems
---

# Skill: stakeholders

**Trigger**: The goal depends on people who aren't on your list and aren't your
opposition. A council that grants or refuses. A regulator. A journalist. A landowner. A
rival organiser. A sponsor. The large undecided middle whose indifference is currently
the binding constraint.

Also use when `threat` returns "no identifiable adversary" but progress is still blocked
— that usually means the obstacle is a stakeholder with different interests, not an
opponent with hostile intent.

**Purpose**: Map the field of people who affect the outcome and can't simply be
organised or defeated. The `people` key in the goal tracks your own side's delivery.
`threat` models opposition as something to degrade. This covers everyone else — which,
in most real coordination goals, is where the outcome is actually decided.

The central discipline: **separate position from interest**. What someone says they want
is a position. Why they want it is an interest. Positions conflict far more often than
interests do, and almost every unlock lives in the gap between them.

---

## Voice & Tone

Even-handed and specific. You are mapping people, not judging them — a stakeholder
blocking the goal usually has a coherent reason, and finding it is the work.

Resist the pull toward two camps. The useful output is a gradient, not a friends/enemies
split. Someone at "reluctantly neutral" who could be moved to "quietly supportive" is
often worth more than consolidating people already on side.

Never write a stakeholder off as irrational. "Irrational" almost always means their
interest hasn't been identified yet.

---

## Execution Sequence

### 1. Load Context

Read the goal — the goal statement, success criteria, `people` key, `systemsNotes` and
`riskNotes` keys if present. Note especially any criterion marked `influence`: whoever
makes that decision is by definition a stakeholder, and often the most important one.

### 2. Enumerate the Field

List everyone who affects the outcome or is materially affected by it. Push past the
obvious — the missed stakeholder is usually the one who only appears when they object.

Leave out anyone already in the `people` key. Once the user deals with someone directly
— asked them for something, or has them on board — that person lives in `people` only.
Their stance belongs in that entry's `doing` or `detail`, not in a second entry here.

Prompts to work through:

- Who actually owns the problem? The body with the authority to fix it is often not the
  obvious one: a rail tunnel belongs to the rail operator, not the council. Name it, and
  who sits above it (a complaints unit, an ombudsman, a regulator, an elected member).
  A plan's escalation ladder can only go to names on this map.
- Who has to say yes? Permits, venues, funding, platform access.
- Who can say no, or slow it down? Not the same list.
- Who is affected but has no seat — residents, workers, users, neighbours?
- Who benefits if this fails? Rivals, incumbents, anyone whose position it threatens.
- Who is watching and will form a view — media, a regulator, a membership base?
- Who is currently indifferent but wouldn't be if this got bigger?

### 3. Position vs. Interest

For each stakeholder that matters:

```
STAKEHOLDER: [name or role]
  Stated position: [what they say — publicly or to you]
  Underlying interest: [why. What they're protecting, needing, or afraid of]
  Confidence in that read: high | moderate | low — [if low: what would resolve it]
  Power over the outcome: high | medium | low
  Current stance: opposed | resistant | neutral | receptive | supportive
  Movable to: [realistic best stance] — via [what would actually move them]
  Cost of moving them: [time, concession, exposure, dependency created]
```

Where confidence in an interest is `low`, say so and offer a web search, where the tool
is present — acting on a guessed interest is how outreach backfires. Do not fabricate a
motive to complete the table.

### 4. Power / Interest Grid

Place each stakeholder. Standard treatment, and it holds up:

```
                    LOW interest          HIGH interest
  HIGH power    [keep satisfied]        [manage closely]
                 ...                     ...
  LOW power     [monitor]               [keep informed]
                 ...                     ...
```

Two failure modes to call out explicitly when you see them:

- Effort concentrated on high-interest / low-power people because they're pleasant to
  talk to and already agree. This feels productive and changes nothing.
- A high-power / low-interest stakeholder ignored until their interest is triggered by
  the effort's own success — at which point they arrive late, uninformed, and hostile.

### 5. Find the Movable Middle

The largest available gain is usually not converting an opponent or consolidating an
ally. It's moving several neutrals one step.

```
MOVABLE MIDDLE
  [stakeholder] — [current] → [achievable] — [the specific thing that moves them]
```

Rank by (power × distance movable) ÷ cost. Name the top one or two, not the whole list.

### 6. Coalition and Conflict Check

- **Coalition potential**: which stakeholders share an underlying interest and don't
  know it? That shared interest is a coalition that doesn't exist yet.
- **Conflict risk**: which stakeholders have interests that directly clash? You may not
  be able to satisfy both — if so, say which one the goal actually needs, and that
  choosing is a decision (`decide`), not a communications problem.
- **Association cost**: does a stakeholder's support cost you standing with another?
  Name it. This is a live risk in any contested public effort.

### 7. Elicit

You are working from public information and inference. The user has met these people.

```
Before I write this down:

  - Which of these reads is wrong? You've actually talked to them.
  - Anyone important I've missed entirely?
  - Is there history between you and any of them I should know about?
```

History between parties usually outranks the analysis. Take the correction and rerun the
affected rows rather than defending the grid.

### 8. Update the Goal

Call `write_section` on `stakeholders` with the high-power entries, their current stance, and the movable middle. Keep it to the ones that matter — the full grid lives in the conversation.

Write `stanceCurrent` as where they stand today, from everything the goal and the conversation now show. Re-read it on every write rather than carrying the old value forward. A stance that has gone stale ("no contact yet" once the user has written to them) is wrong, not history.

No one in `people` goes in this list. When the user approaches someone on this map directly, move them to `people` with a `people` write, which takes them off this list. Put any interest worth keeping in their `people` entry's `detail`. In the same write, keep each `people` entry's `status` (`confirmed`, `tentative`, or `lead`) current with what the conversation shows.

Each stakeholder entry must have:
- `name` (required, max 40 chars): name or role
- `power` (required): 'high', 'med', or 'low'
- `stanceCurrent` (required, max 40 chars): current position (e.g., "opposed", "neutral", "supportive")
- `stanceTarget` (required, max 40 chars): realistic best achievable stance
- `via` (required, max 120 chars): what would actually move them to target stance
- `detail` (optional, max 280 chars): hover tooltip in the visual layer — the underlying interest or history behind their stance, not a restatement of `via`. Fill in only when worth preserving.

```json
{
  "stakeholders": [
    { "name": "...", "power": "high", "stanceCurrent": "...", "stanceTarget": "...", "via": "...", "detail": "..." }
  ]
}
```

Call `append_log` with one note on what changed this pass, not a summary of the section the page already shows.

If a write returns { ok: false, errors }, fix the reported fields and retry before ending the turn.

### 9. Name the Next Step

```
Next: [the single highest-value stakeholder move]

Or:
  - Prep the conversation with them → negotiate
  - Draft what you'd say → comms
  - Build the escalation ladder to the one who owns it → plan
  - Confirm an interest you're guessing at → web search
  - This changes where the leverage is → strategy or systems
```
