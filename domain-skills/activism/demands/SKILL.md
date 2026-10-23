---
name: demands
description: Use on an activism goal when the campaign has grievances but no winnable demand, a long list of demands, or a target that is an institution or "the government" rather than a person — and again when the other side offers talks, a consultation or a partial concession. Turns a problem into an issue one named decision-maker can grant, tests it as a campaign issue, sets what counts as a win, and records the lead demand as a decision.
display: decision-callout
writes: decisions, intel, log
requires: goal
phase: understand
pack: activism
next: pillars, stakeholders, organizing, strategy, negotiate
---

# Skill: demands

**Trigger**: An activism goal where the user can say what is wrong but not what exactly
they want, from whom, by when. Also: a movement with a list of twenty demands, a demand
aimed at "the state", "the system" or "big business", a campaign that has been running
for months with no win to point at, or the moment the other side offers a meeting, a
commission, a consultation or half of what was asked.

**Purpose**: Choose the one demand that wins something real and leaves the campaign
stronger for the next fight. A problem is a broad wrong (housing costs too much). An
issue is a specific solution to part of it that a specific person can grant (the mayor
signs a rent freeze on city-owned flats before the budget vote). Campaigns are won on
issues, never on problems.

---

## Voice & Tone

A seasoned campaign director: warm about the cause, unsentimental about the plan. Ask
"who can say yes to that?" until there is a name. Respect the anger; don't let it stand
in for a demand. Never pick a side's politics for the user. Help any cause pursued by
nonviolent means; don't plan violence, threats or harassment of private people.

---

## Execution Sequence

### 1. Load Context

Read the goal, sub-goals, success criteria, `people`, `stakeholders`, `decisions` (a lead
demand recorded earlier lives there), `intel` and `log`. If a lead demand already exists,
this run tests it against what has changed (an offer, a defeat, a new decision-maker),
not starting over.

Read with read_skill_file('demands', 'issue-test.md') before step 4.

### 2. From Problem to Issue

Ask what is wrong in the user's own words, then cut it down. Three levels, each serving
the one above:

```
LONG-TERM GOAL: [the world the campaign wants: may take years]
INTERMEDIATE DEMAND: [a real, lasting change one decision-maker can grant this year]
SHORT-TERM WIN: [something winnable in weeks that builds toward it and proves the group can win]
```

A campaign with only a long-term goal has nothing to win this month and burns its
people out. A campaign with only short-term wins collects favours and changes nothing.
It needs all three, and the next one or two moves come from the bottom rung.

### 3. Name the Target

The target is a person, never an institution. "The council" can't say yes; the council
leader, the housing portfolio holder or the five swing councillors can. Work it out:

- **Primary target**: the person with the authority to grant the demand. Often unclear:
  which level of government, which office, which signature actually decides. If nobody
  knows, that's the first `intel` question.
- **Secondary targets**: people the campaign has more power over than it has over the
  primary, and who have power over the primary: a deputy, a party branch, a major donor,
  a board member, a regulator, a coalition partner.
- **Their self-interest**: what the target wants that the campaign can affect: a
  re-election, a budget, a reputation, a promotion, a quiet life, a legacy. Pressure works
  through self-interest, not through being right.

### 4. Test the Issue

Run the candidate demand through the issue test in issue-test.md. The ones that kill a
campaign when missed:

- **Winnable**: the people involved can see how it could be won. An unwinnable demand
  is a recruiting poster, not a campaign.
- **Widely and deeply felt**: enough people care, and care enough to act.
- **A clear target and a clear time frame**: a person and a date, with the timing
  working for the campaign (a budget vote, an election, a contract renewal), not against.
- **Builds the organization**: winning it leaves more members, more leaders and more
  confidence than before.
- **Doesn't divide the base**: the campaign's own people agree on it.

### 5. One Lead Demand

When there are many demands, pick one lead demand and hold the rest as a platform. A
long list lets the target pick the cheapest item, grant it, and declare the matter
closed while the movement argues about whether it won. One clear demand makes every
response a yes or a no the public can see.

The lead demand passes the Monday test: could the target say yes to it on Monday morning,
with a pen? If granting it needs a study, a law nobody has drafted, or a dozen bodies to
agree, it's a problem, not yet an issue.

### 6. Decide What Winning Looks Like, Now

Before the fight, while heads are cool:

- **The win**: what exactly counts as granted (signed, voted, published, funded).
- **Acceptable partial wins**: which half-offers to take, and which to refuse.
- **Process offers**: a consultation, a commission, a national debate, a working group.
  These are the commonest way to end a campaign without granting anything: they take the
  energy off the streets and give the target time. Accept talks only with a date for a
  decision and a public commitment from the target, and keep the pressure on until then.
- **What happens on winning**: claim it publicly, celebrate with everyone who took part,
  and name the next demand. A win that isn't claimed becomes "they were always going to
  do that".

If an offer has already arrived, work it here, then hand to `negotiate` for the talk
itself.

### 7. Show the Read, Then Commit

Put the ladder, the target and the lead demand to the user as one `confirm` reply. Ask
whether the people most affected would recognise it as theirs. Fold in what they
correct, then commit. Write after they answer, never in the turn this skill was loaded.

Call `write_section` on `decisions`, keeping every existing entry, with the lead demand
as a decided decision, replacing an earlier lead demand in place:

```json
{
  "decisions": [
    {
      "date": "YYYY-MM-DD",
      "choice": "Lead demand: [what] from [person] by [date]",
      "because": "[why this one: winnable, felt, and builds the group]",
      "reverseIf": "[an observable sign it's wrong: turnout falls after two actions on it]",
      "reviewBy": "YYYY-MM-DD"
    }
  ]
}
```

Where the target or the timing is unknown (who signs, when the vote is, what the budget
cycle is), call `write_section` on `intel`, keeping every existing entry, with each as an
open question.

If the goal sentence itself is the problem rather than the issue, say so, and offer
`intake` to restate it around the lead demand.

Call `append_log` with `source: "demands"`, one note on what was decided. If a write
returns `{ ok: false, errors }`, fix the reported fields and retry before ending the turn.

### 8. Name the Next Step

```
Next: [the first person to put the demand to, or the first fact to find out]

Or:
  - Map who the target depends on → pillars
  - Map the people with a say in it → stakeholders
  - Build the numbers to win it → organizing
  - An offer is on the table → negotiate
  - Reset where to push → strategy
```
