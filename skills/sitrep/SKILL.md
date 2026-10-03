---
name: sitrep
description: Use when the user brings several updates at once — "quick catch-up", a list of things that happened, news touching the plan, people, time and money together. Sorts each update to the skill that writes it, shows the routing for a yes, then works through each one in the next turn. Writes only the log itself.
display: plain-card
writes: log
requires: goal
next: plan, stakeholders, capacity, decide, strategy, recon
---

# Skill: sitrep

**Trigger**: The user brings several updates at once. "Council said no, Sam dropped
out, I'm down to £2k." A catch-up after a few days away. Any message where two or
more separate things changed.

**Purpose**: Take the batch in one pass. Split it into facts, send each to the skill
that owns it with `route_updates`, show the routing for a yes, then work through each
one the next turn with a light update, not a rerun.

This skill writes only the log. It owns no section of the goal.

---

## Voice & Tone

Quick and tidy, like a good chief of staff taking notes. No lecture on what each
update means; the owning skill does that if it needs to. Short lines, plain words.
If one fact is bigger than the rest, say so.

---

## Execution Sequence

### 1. Split the Message

Read the goal and the user's message. Break the message into discrete facts, one
change each. "Sam dropped out and I'm short on cash" is two facts.

Drop anything that changes nothing: venting, a repeat of what the goal already says.

### 2. Pick the Owner for Each Fact

| The fact is... | Owner |
|---|---|
| A move done, blocked or dropped; a new date on a move | `plan` (Mode 0, status flip) |
| Someone joining, leaving or changing role in what the user is doing | `intake` writes `people`; `stakeholders` moves a person across and keeps `people[].status` current |
| Someone with a say changed their stance | `stakeholders` |
| Hours, money, energy or runway changed | `capacity` |
| A new fork the user has to choose at | `decide` |
| A question the user had is answered | `recon` (answer mode) |
| A conversation happened and has an outcome | `negotiate` (debrief mode) |
| A test or a bet has a result | `experiment` or `forecast` |
| The facts together move what matters most | `strategy` |

Route only to skills in the table. `route_updates` takes six items at most and works
only while `sitrep` is active.

**Things no key holds.** A preference, a limit, a fact about the user's life that an
update carries with it: call `remember` right now, in this turn, before routing. A
move they refuse goes in as `rejected`.

**Too big to route.** If a fact breaks something the goal stands on (the focus no
longer holds, the deadline moved by a month, the goal itself changed), do not route
it. A light update would paper over it. Name the full skill as the next step instead.

### 3. Show the Routing as One Confirm

Call `route_updates({items: [{skill, update}]})`, each `update` one short plain
sentence. Then reply once with `kind: confirm`:

- `say`: what you'll update, short. "I'll drop the permit move, move Sam off the
  team and log £2k as your runway."
- `bottomLine`: the yes you need. If a fact was held back as too big, say so here.
- `options`: `Yes` / `Not quite`.

Write nothing to the goal this turn apart from `remember`.

### 4. Work Through the Routed Updates (next turn)

On a yes, each routed skill is cleared to write in the same turn it loads. Load them
one at a time. For each, make the light update that skill's own quick mode would
make, and no more:

- `plan`: Mode 0 status flip or date change on the matched move. No replan.
- `capacity`: change the numbers the user gave. No fresh interview.
- `stakeholders`, `intake`: move or edit the one person.
- `decide`: record the new fork as an open decision.
- `recon`: set the question answered, with the answer.
- `negotiate`: debrief mode on the matching prep entry.
- `experiment`, `forecast`: record the result on the matching entry.

On "Not quite", ask what is wrong in one line, fix the routing and confirm again.
Skip any item the user turned down; `remember` it as `rejected` if it was a move.

When one update changes what another skill's section rests on, say so in the reply.
Do not chase it this turn.

### 5. Log Only What Was Decided

By now a routed skill is active, not `sitrep`, so any log entry comes from the
routed skill that made the change, as its own quick mode would. Facts the owning
keys hold are not repeated. If nothing was decided, write no entry.

### 6. Close with the Single Next Move

Call `finish_skill` after the last routed skill. Then one `reply`: `bottomLine` is
the one next move, usually the item the updates exposed or the full skill a held-back
fact needs. `options` carry the alternatives.

```
Next: [one move, usually the item the updates exposed]

Or:
  - A fact was too big to route -> the skill that owns it (often strategy)
  - A plan rests on something that moved -> plan
  - Get the whole picture back in plain words -> brief
```
