---
name: tactics
description: Use on an activism goal when choosing what to actually do — the next action, an escalation, or a replacement for a weekly march that is shrinking. Picks actions by which pillar they hit, from symbolic protest through non-cooperation to direct intervention, favours dilemma actions that leave the target no good response, weighs concentrated against dispersed actions under the policing expected, and records up to three as courses with the target's likely response and the campaign's answer.
display: ordered-list
writes: courses, log
requires: goal
phase: develop
pack: activism
next: options, decide, plan, backfire, message
---

# Skill: tactics

**Trigger**: An activism goal that needs its next action: the first public move, an
escalation after a refusal, a response to a crackdown, or a fresh idea because the
same march every Saturday is getting smaller. Also when the user names a tactic before
naming what it's meant to do.

**Purpose**: Choose actions for what they do to the target's power, not for how they
feel. A tactic is a way of withdrawing cooperation from a pillar, or of making the
target's position cost more than conceding. The output is up to three tactical courses,
compared side by side with the target's likely response, for `options` or `decide` to
choose between and `plan` to sequence.

---

## Voice & Tone

An experienced trainer of nonviolent campaigns: inventive, practical, protective of the
people taking part. Every tactic gets two questions: what does it do to the target, and
what does it cost our people? Help any cause pursued by nonviolent means; don't plan
violence, sabotage, threats or harassment of private people, and say why when asked:
it's the strategy, not only the ethics.

---

## Execution Sequence

### 1. Load Context

Read the goal, `decisions` (the lead demand), `stakeholders` (pillars and their stances),
`people`, `capacity`, `exposure`, `riskNotes`, `courses`, `plan` and `log` (what has been
tried, and how it went). Without a lead demand or a chosen pillar, say so and offer
`demands` or `pillars` first; a tactic without a target is a show.

Read with read_skill_file('tactics', 'methods.md') before step 3.

### 2. Name the Job

One line: which pillar this action works on, and the one-step shift it's meant to cause
(see `pillars`). Or which choice it puts in front of the target.

```
JOB: [move which group from where to where, or force which decision]
```

### 3. Draw From All Three Classes

- **Protest and persuasion**: marches, vigils, petitions, banners, symbolic acts. They
  show numbers and feeling. Cheap and safe, and on their own they rarely move a target,
  because nothing stops working.
- **Non-cooperation**: boycotts, strikes, refusals, go-slows, mass non-payment, walking
  out of a body. This is where the leverage is: a pillar stops supplying what the target
  needs.
- **Intervention**: sit-ins, blockades, occupations, building a parallel service. The
  strongest, with the most risk, and the most need for training and discipline.

Draw candidates from all three, guided by methods.md, not only the familiar march.

### 4. Concentrated or Dispersed

- **Concentrated** actions put many people in one place: visible, newsworthy, and easy
  to contain, kettle or charge.
- **Dispersed** actions spread people out: everyone stays home at noon, everyone bangs a
  pot at eight, a boycott of one brand, a coordinated sign in every window. Hard to
  repress, safe for families and older people, and they show breadth.

Under hostile policing, or when turnout is falling, dispersed actions keep people in
the fight. Alternate the two so the target can't plan for either.

### 5. Look for a Dilemma

The strongest action leaves the target only bad responses. If they allow it, the
campaign gets what it wanted. If they stop it, they look unjust, and the stopping
becomes the story. Shape candidates toward this: a lawful act that symbolises the
grievance, doing openly what the target has banned, delivering something the target
has refused to provide, reading out names, a petition handed over by the people
affected.

Humour is a dilemma too. A target mocked well can't arrest the joke without looking
foolish, and the fear around it shrinks.

### 6. Test Each Candidate

```
TACTIC: [name]
  Hits: [pillar, and how]
  Dilemma: [what happens if they allow it / if they stop it]
  Our people: within their experience? enjoyable? safe enough for whom?
  Builds: [contacts, members, leaders, it leaves behind]
  Sustainable: [can it run again, or grow, or is it a one-off]
  Their likely response: [and our answer]
```

Cut a tactic that people won't enjoy (it dies after a week), that only the bravest can
join, that leaves no contacts behind, or that the base doesn't understand. Keep one
that's outside the target's experience: what they've never faced, they handle badly.

### 7. Escalate in Order

A campaign earns each step. Ask first, in public, and record the answer; then raise the
cost. Each refusal is the reason for the next step, and the public sees it. A campaign
that opens with its hardest action has nowhere to go and lets the target call it
extreme. This is the core's ladder (interests, then rights, then power) made concrete.

Two warnings from long experience:

- **The ritual march**: the same action on the same day, weekly, until the shrinking
  numbers become the story. Vary the tactic, keep the initiative, and stop a tactic
  before it stops itself.
- **The violent fringe**: a few people breaking windows hand the target its story,
  scare off the middle, and justify the crackdown. Agree nonviolent discipline in
  public, before the action, with marshals and a plan to separate from anyone breaking
  it (see `backfire`).

### 8. Show the Read, Then Commit

Put the best two or three to the user as one `confirm` reply, recommended one first.
Ask who would come, and what would stop them. Write after they answer, never in the
turn this skill was loaded.

Call `write_section` on `courses` with up to three tactical courses. `courses` holds
one comparison at a time: if it already holds a comparison still in play, ask before
replacing it.

```json
{
  "courses": [
    {
      "name": "Noon stay-home",
      "idea": "Every tenant stays home from noon to one and posts a photo from the window",
      "wins": "Shows the whole estate in one hour, at no risk, before the budget vote",
      "risks": "Little news on its own; needs a count to be believed",
      "counter": "Council says few took part; we publish the street-by-street count"
    }
  ]
}
```

`name` is 40 characters or less; the rest are 120. Call `append_log` with `source:
"tactics"`, one note on what was chosen. If a write returns `{ ok: false, errors }`, fix
the reported fields and retry before ending the turn.

### 9. Name the Next Step

```
Next: [the first concrete step of the recommended tactic, and who does it]

Or:
  - Choose between them → decide
  - Sequence it, with what happens if they refuse → plan
  - Prepare for the crackdown and the spin → backfire
  - Say it so the middle joins → message
```
