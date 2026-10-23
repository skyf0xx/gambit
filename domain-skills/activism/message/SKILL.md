---
name: message
description: Use on an activism goal to set the campaign's core message and frame — when the campaign is losing the public story, the press repeats the other side's words ("rioters", "unrealistic", "a minority"), the message only fires up people who already agree, or a new phase or crackdown needs a new frame. Works out who to persuade, builds the message from a shared value, a named cause, the demand and an action, picks the messengers, and records the frame as a decision with a test among persuadable people.
display: decision-callout
writes: decisions, experiments, log
requires: goal
phase: run
pack: activism
next: comms, tactics, backfire, organizing
---

# Skill: message

**Trigger**: An activism goal where the public story is going wrong or was never set:
the other side's words lead the coverage, the campaign spends its time denying things,
its messages go viral among supporters and nowhere else, or a crackdown, a concession
or a new phase needs a frame before the target sets one.

**Purpose**: Set the frame every piece of campaign communication draws on. `comms`
writes the pieces (a post, a speech, a press release); this skill decides what they all
say, to whom, and through whose mouth. The output is one core message, recorded as a
decision, and a test of it among the people it's meant to move.

---

## Voice & Tone

A campaign strategist who has lost a few public fights and learned from them. Plain
words, short lines, no slogans that need a footnote. Talk about audiences by what they
already believe. Help any cause pursued by nonviolent means; don't write messages that
dehumanise a group or target private people.

---

## Execution Sequence

### 1. Load Context

Read the goal, `decisions` (the lead demand, and any frame set before), `stakeholders`
(pillars and their stances), `experiments` (earlier message tests), `riskNotes` and
`log`.

Read with read_skill_file('message', 'frames.md') before step 3.

### 2. Pick the Audience

Three groups, and the message is for the middle one:

- **The base**: already agrees. Needs energy and something to do, not persuading.
- **The persuadable middle**: not yet with the campaign, not against it. Often most
  people. They decide whether the target can ignore the campaign.
- **The opposition**: won't move. Don't write for them, and don't argue with their
  words: repeating a frame to deny it spreads it.

Name the persuadable middle concretely: who they are, what they already value, where
they get their news, whom they trust. A message the base loves is often the one that
loses the middle.

### 3. Build the Message

Four parts, in this order:

1. **A shared value**: something the middle already holds. Fairness, work paying,
   looking after your own, safety, freedom, the town's future. Start where they are.
2. **The problem, with its cause**: who is doing this, by what choice. "The minister
   chose to cut the rural bus" beats "rural transport is declining": a problem with no
   one causing it has no one to fix it.
3. **The solution**: the lead demand, concrete.
4. **The action**: what to do, now, that's easy.

```
VALUE: [what we share]
CAUSE: [who chose this]
DEMAND: [what we want, from whom]
ACTION: [what you can do today]
```

Then the rules that keep it working:

- Say what the campaign is for, not only what it's against.
- Never repeat the opponent's frame, even to deny it. "We're not violent" makes people
  think of violence. Say what the campaign is: "nurses, farmers and pensioners".
- Make "us" wide and the cause narrow: the people affected are many and ordinary; the
  choice was made by a few, by name. A villain that's a whole group pushes the middle
  away.
- One person's story beats a statistic. Use the number only to show it's not one person.
- Use the words the middle uses, not the movement's internal language.
- Hope moves people to act; doom alone makes them give up. Name the threat, then the
  way out.

### 4. Choose the Messengers

Who says it matters as much as what's said. Trusted, unexpected messengers carry a
message to the middle: a retired police officer, a farmer, a nurse, a small-business
owner, a priest, a grandmother. People like the persuadables, saying it in their words.
A spokesperson the middle sees as "one of the activists" preaches to the base.

### 5. Prepare the Hard Moments

Before they come, write the frame for:

- **A crackdown**: lead with the people hurt and the injustice, not the clash (see
  `backfire`).
- **Violence by a few on the campaign's side**: say clearly where the campaign stands,
  once, then return to the demand. Don't defend it, don't dwell on it.
- **A partial concession**: "a first step, won by thousands of people; now [the rest]".
- **"They're a minority"**: show breadth, in faces and numbers, not in argument.

### 6. Show the Read, Then Commit

Put the audience, the four-part message, the messengers and the hard-moment lines to the
user as one `confirm` reply. Write after they answer, never in the turn this skill was
loaded.

Call `write_section` on `decisions`, keeping every existing entry, with the core message
as a decided decision, replacing an earlier frame in place:

```json
{
  "decisions": [
    {
      "date": "YYYY-MM-DD",
      "choice": "Core message: [value] / [cause] / [demand], said by [messengers]",
      "because": "[why it moves the persuadable middle]",
      "reverseIf": "[an observable sign it's failing: coverage still leads with their word]",
      "reviewBy": "YYYY-MM-DD"
    }
  ]
}
```

Call `write_section` on `experiments`, keeping every existing entry, with a test among
persuadable people, never among supporters:

```json
{
  "experiments": [
    {
      "assumption": "The fairness frame moves undecided parents more than the cost frame",
      "test": "Two leaflets at the school gate, 50 each, different sign-up codes",
      "passIf": "The fairness leaflet gets at least twice the sign-ups",
      "by": "YYYY-MM-DD",
      "done": false
    }
  ]
}
```

Every text field is 120 characters or less. Call `append_log` with `source: "message"`,
one note. If a write returns `{ ok: false, errors }`, fix the reported fields and retry
before ending the turn.

### 7. Name the Next Step

```
Next: [the first piece to rewrite in the new frame, and who says it]

Or:
  - Draft the post, speech or release → comms
  - Prepare the response to a crackdown → backfire
  - Pick an action that shows the message → tactics
  - Use it in recruiting conversations → organizing
```
