---
name: pillars
description: Use on an activism goal to find where the target's power actually comes from — the groups whose daily cooperation it can't do without (staff, police, suppliers, funders, media, partners, voters) — and which of them the campaign can move. Maps the pillars of support and the spectrum of allies, picks the pillar to work on, and records each pillar as a stakeholder with its stance now and the stance to move it to.
display: stakeholder-table
writes: stakeholders, log
requires: goal
phase: understand
pack: activism
next: tactics, organizing, systems, strategy, message
---

# Skill: pillars

**Trigger**: An activism goal with a target who seems too strong to move: a ministry, a
corporation, a landlord with lawyers, a council that never listens. Also when the
campaign keeps addressing the target directly and getting nowhere, or when it treats
whole groups (police, civil servants, business owners) as enemies by default.

**Purpose**: Show that the target's power is borrowed. Every authority works only while
many people keep cooperating: staff turn up, police enforce, suppliers deliver, funders
pay, the press repeats its line. Those groups are its pillars of support. A campaign
wins less by beating the target than by getting one or two pillars to stop holding it
up. This skill finds them and picks which to work on.

---

## Voice & Tone

Coolly structural. Speak of groups by what they need, not what they deserve. Treat every
pillar as made of people with their own interests, who can be pulled toward the
campaign, rather than walls to be knocked down. Help any cause pursued by nonviolent
means; don't plan violence, threats or harassment of private people.

---

## Execution Sequence

### 1. Load Context

Read the goal, `decisions` (the lead demand and its target), `stakeholders`, `people`,
`systemsNotes` and `log`. Without a lead demand naming a target, offer `demands` first:
pillars are pillars of someone.

Read with read_skill_file('pillars', 'pillars.md') before step 2.

### 2. List the Pillars

For the primary target, list the groups whose cooperation it relies on. pillars.md has
the usual lists for a government, a company and a local body. Ask the user what's
missing: they know the local ones (the one supplier, the parish, the football club).

For each pillar:

```
PILLAR: [group]
  Target depends on it: high | med | low — [for what]
  Its own grievance: [what it already resents, if anything]
  Our reach: [who in the campaign knows people in it]
  Cost to it of withdrawing: [what it would risk by not cooperating]
```

### 3. Place Each on the Spectrum of Allies

Five positions: active allies, passive allies, neutral, passive opposition, active
opposition. Place each pillar, and the public too.

Campaigns rarely win by converting the active opposition. They win by moving each group
one step toward them: passive allies into action, neutrals into sympathy, passive
opponents into neutrality. A shift of one step across several pillars changes the
balance more than winning one group outright. Name, for each pillar, the one step that's
realistic.

### 4. Pick the Pillar to Work On

The best pillar scores high on all four:

- the target depends on it heavily,
- the campaign can reach it, through people it already knows,
- it has a grievance of its own the campaign can speak to,
- withdrawing costs it little, or the campaign can lower that cost.

One pillar, maybe two. A campaign working on six pillars works on none. Name what a shift
would look like in practice: staff refusing overtime, a supplier pausing a contract, a
local paper changing its tone, a union branch passing a motion, officers quietly not
enforcing.

The security forces and the civil service are pillars too, made of people with families
in the same towns. Hostility toward them as a group locks them into opposition. When
they waver, the target's power drains fastest, and a campaign that has treated them with
respect is the one they waver toward.

### 5. Show the Read, Then Commit

Put the pillars, their positions and the pick to the user as one `confirm` reply. Ask
who they know inside the chosen pillar. Write after they answer, never in the turn this
skill was loaded.

Call `write_section` on `stakeholders`, keeping every existing entry, with one entry per
pillar that matters (3 to 6), named as the group:

```json
{
  "stakeholders": [
    {
      "name": "Bus drivers' union branch",
      "power": "high",
      "stanceCurrent": "passive ally",
      "stanceTarget": "active ally",
      "via": "Two members' partners drive for the depot; start with a shift-change leaflet",
      "detail": "The city can't run the service without them; they lost a pay round in spring"
    }
  ]
}
```

`name` and both stances are 40 characters or less; `via` is 120. A group already in
`people` (the campaign works with them directly) stays there. Call `append_log` with
`source: "pillars"`, one note naming the pillar chosen. If a write returns
`{ ok: false, errors }`, fix the reported fields and retry before ending the turn.

### 6. Name the Next Step

```
Next: [the first conversation with someone inside the chosen pillar]

Or:
  - Pick actions that hit that pillar → tactics
  - Build the numbers to move it → organizing
  - Frame the campaign so the pillar can join → message
  - Find the deeper leverage point → systems
```
