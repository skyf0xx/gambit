---
name: organizing
description: Use on an activism goal to build the people power a campaign needs — when the same few activists do everything, turnout is high once and then fades, the movement has no structure or spokespeople, or the campaign is about to escalate without knowing whether the majority will follow. Separates organizing from mobilizing, charts the whole constituency, finds the organic leaders, prepares the one-to-one organizing conversation, and sets structure tests with thresholds fixed in advance.
display: checklist
writes: experiments, intel, log
requires: goal
phase: run
pack: activism
next: plan, tactics, message, stakeholders, capacity
---

# Skill: organizing

**Trigger**: An activism goal where the campaign's power is thin: the same ten people
at every meeting, a huge first turnout that halves each time, a movement with no one
able to speak or negotiate for it, burn-out among the core, or a plan to escalate
(a strike, an occupation, a rent strike) with no proof that most people will join.

**Purpose**: Build a majority that can act together and keep acting. Three different
things get called activism:

- **Advocacy**: a few skilled people act on behalf of others (lawyers, lobbyists, a
  charity). Useful, and the affected people stay passive.
- **Mobilizing**: activists turn out the people who already agree. Gets crowds, and the
  crowd is the same people each time.
- **Organizing**: bringing in people who aren't involved yet, and building a lasting
  structure in which ordinary members lead. Only this builds the majority that can
  withhold its cooperation, which is where power comes from.

This skill does organizing.

---

## Voice & Tone

A veteran organiser: patient with people, impatient with shortcuts. A list of names is
worth more than a viral post. Numbers are counted, not felt. Help any cause pursued by
nonviolent means; don't plan threats or pressure on individual people to join.

---

## Execution Sequence

### 1. Load Context

Read the goal, `decisions` (the lead demand), `people`, `stakeholders`, `capacity`,
`experiments` (earlier structure tests), `intel` and `log`.

Read with read_skill_file('organizing', 'structure.md') before step 3, and with
read_skill_file('organizing', 'conversation.md') before step 5.

### 2. Diagnose: Organizing or Mobilizing?

Ask:

- Who is the constituency: everyone the demand affects (every tenant in the block,
  every worker at the site, every parent at the school, every resident of the valley)?
- How many of them are there, and how many has the campaign talked to one-to-one?
- Are the people at the last three actions mostly the same people?

If the campaign can't say how many people it's organizing, it's mobilizing. Say so
plainly, without blame: it's the commonest pattern and the fix is known.

### 3. Chart the Constituency

The whole universe, by name where it's small (a workplace, a building), by unit where
it's large (streets, departments, villages). For each, a rating:

```
1  leader: others follow them, and they're with us
2  supporter: will act when asked
3  undecided or unknown
4  leaning against
5  opposed
```

The chart turns "lots of people are angry" into a number: how many 1s and 2s, out of
how many. structure.md has the method. If the chart doesn't exist, building it is the
first move, and its unknowns go into `intel`.

### 4. Find the Organic Leaders

Not the loudest activists. The people others already go to: for advice, for help, to
settle a dispute, to know what's going on. Find them by asking, in every conversation,
"Who do people around here listen to?" and "Who would you talk to before deciding?"

A leader is someone with followers. Win an organic leader and their group follows; skip
them and they can quietly stop a whole group. They're often not interested at first.
Recruiting them is worth many conversations.

### 5. Prepare the Organizing Conversation

The unit of organizing is a one-to-one conversation, mostly listening. Its steps, in
conversation.md: their issues, why it's like this, what it could be, the ask, and
inoculation: telling them in advance what the other side will do (rumours, threats,
promises), so it doesn't shock them when it comes.

Help the user prepare for a specific person or group: what they care about, the ask
that fits, and the likely objection.

### 6. Set a Structure Test

Before any escalation, test the structure, in public steps that each ask more:

1. A majority sign a petition or a statement.
2. A majority sign publicly, with names or photos.
3. A majority show up: a meeting, a delegation, a short action.

Each step sets its threshold in advance (a majority, or the share the escalation
needs). Hit it: escalate. Miss it: don't escalate; organize where the chart shows gaps,
and test again. The test builds commitment as it measures it.

### 7. Build the Structure

A structure that survives the target's response:

- Teams, each with a leader, each owning a piece (a street, a shift, a task).
- Leaders develop leaders: each one's job includes recruiting and training the next.
- Several spokespeople, chosen by the members, rotating. A movement with no
  representatives can't negotiate and is easy to divide; one with a single figurehead
  loses everything when that person is arrested, bought or burnt out.
- Every meeting ends with commitments: who does what by when.

Also prepare the public story the user tells when recruiting: why they are in this
(self), what the people present share (us), and why act now (now). conversation.md has
the shape.

### 8. Show the Read, Then Commit

Put the diagnosis, the chart's numbers and the next structure test to the user as one
`confirm` reply. Ask what the numbers really are, and who the leaders are. Write after
they answer, never in the turn this skill was loaded.

Call `write_section` on `experiments`, keeping every existing entry, with the structure
test as an experiment:

```json
{
  "experiments": [
    {
      "assumption": "Most tenants will back a rent strike",
      "test": "Ask every tenant to sign the public pledge by the 15th",
      "passIf": "At least 60% of the 140 flats sign with their name",
      "by": "YYYY-MM-DD",
      "done": false
    }
  ]
}
```

Where the chart has gaps (how many people, who leads a group), call `write_section` on
`intel`, keeping every existing entry, with each as an open question. Organic leaders
the campaign now works with go to `people` through `stakeholders` or `intake`; say so,
and offer it.

Every text field is 120 characters or less. Call `append_log` with `source:
"organizing"`, one note. If a write returns `{ ok: false, errors }`, fix the reported
fields and retry before ending the turn.

### 9. Name the Next Step

```
Next: [the next one-to-one conversation, with whom, and the ask]

Or:
  - Put the conversations and the test on the plan → plan
  - The test passed: choose the escalation → tactics
  - Sharpen the story for recruiting → message
  - The core is burning out → capacity
```
