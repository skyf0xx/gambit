---
name: experiment
description: Use when the plan rests on an unproven assumption that could be tested cheaply before committing serious effort — will people turn up, will anyone donate, does this message land, will the partner actually deliver. Designs the smallest test that could falsify the assumption, with a pass/fail line set in advance.
---

# Skill: experiment

**Trigger**: The plan depends on something unproven that a small test could settle. Before
a big commitment of time, money, or credibility. Also use when `forecast` produces a
load-bearing estimate with low confidence, or when two people disagree about what will
happen and the disagreement is cheap to resolve empirically.

**Purpose**: Buy information before buying commitment.

The instinct on an unproven assumption is to argue about it or to proceed and find out.
There's usually a third option: a small, fast test that settles it for a fraction of the
cost. The discipline is designing the test so it can actually come back negative —
otherwise it's a demonstration, not an experiment, and it will confirm whatever was
already believed.

---

## Voice & Tone

Empirical and economical. You are buying information, and information has a price — the
question is always whether this test is worth what it costs.

Ruthless about falsifiability. A test that cannot fail is worthless and worse than
worthless, because it manufactures confidence. If the proposed test would look like
success under every outcome, say so and redesign it.

Never let a test become the work. A test that takes three weeks to run on a plan with a
six-week horizon isn't a test.

---

## Execution Sequence

### 1. Load Context

Read `GOAL.md` — goal, `## Plan`, `## Forecasts` if present, and any assumption flagged
as unverified by `systems`, `threat`, `premortem`, or `plan`.

### 2. Name the Assumption

One sentence, stated so it could be false:

```
ASSUMPTION: [the belief the plan rests on]
  Plan depends on it via: [which step or steps fail if this is wrong]
  Cost if we find out late: [what's already spent by then]
  Current confidence: high | moderate | low — [basis]
```

If the cost of being wrong is low, say so and skip the test. Not every assumption is worth
buying information about, and testing a cheap-to-be-wrong assumption is itself waste.

### 3. Design the Smallest Test

```
TEST: [what you actually do]
  Measures: [the specific observable]
  Cost: [time, money, effort, credibility]
  Duration: [how long until you have an answer]
  Who's involved: [and what they're asked to do]
```

Push for the smallest version. Common compressions worth suggesting:

- **Ask before building.** A conversation with five people in the target group often
  settles what a full campaign would.
- **A commitment, not an opinion.** "Would you come?" is nearly worthless; "will you put
  your name down for the 30th?" is a real signal. Costless agreement predicts nothing.
- **Test one segment**, one suburb, one channel, one list — before all of them.
- **A manual version first.** Do by hand what the plan proposes to do at scale, once, for
  a few people.
- **A precedent search** instead of an experiment — if someone has already run this test,
  `research` is faster and free.

### 4. Set the Pass/Fail Line — Before Running

**This is the step that makes it an experiment.** Set it in advance, in writing:

```
PASS IF: [specific threshold]
FAIL IF: [specific threshold]
AMBIGUOUS IF: [the range that settles nothing]

If it passes, we will: [the specific next action]
If it fails, we will: [the specific alternative — and it must be a real one]
```

Two tests to apply before running anything:

- **If the answer wouldn't change what you do, don't run it.** Both branches must lead
  somewhere different, or the test is theatre.
- **If you can't state a failing result, the test is unfalsifiable.** Redesign it.

Set the threshold before seeing data. A threshold set afterwards will be set wherever the
result landed — reliably, and without anyone noticing they've done it.

### 5. Check for Contamination

```
Would this test's result be misleading because:
  - the sample is people who already agree?
  - the user's own effort is doing what the plan assumes will happen naturally?
  - the timing is unrepresentative — a news cycle, a holiday, a one-off?
  - running the test changes the thing being tested?
```

The first is by far the most common. Testing a message on people who already support the
cause tells you nothing about people who don't, and it feels like validation.

### 6. Elicit

```
Two questions:

  - What result are you hoping for? Say it out loud — it's the bias to watch.
  - If it comes back negative, will you actually change course, or look for a reason it
    doesn't count?
```

The second question is uncomfortable and worth asking. If the honest answer is no, the
test is a waste of time and the decision has already been made — better to name that and
proceed deliberately (`decide`) than to dress a commitment up as an enquiry.

### 7. Record and Run

```
## Experiments
- [ ] [assumption] — test: [what] — pass if [threshold] — by [date]
- [x] [assumption] — [result] — [pass|fail|ambiguous] — [what changed as a result]
```

Ambiguous is a legitimate outcome and must be recorded as such. The temptation is to read
an ambiguous result as a pass. Record it as ambiguous and either design a sharper test or
proceed knowing the assumption is still open.

### 8. Update GOAL.md and Name the Next Step

Maintain `## Experiments`. When one resolves, update the assumption's status wherever it
appears — a falsified assumption sitting unchallenged in `## Systems notes` or `## Plan`
is worse than one never tested.

```
Next: [run the test, or the first step of it]

Or:
  - It passed — commit and sequence → plan
  - It failed — the focus may be wrong → strategy
  - Ambiguous — sharpen the test, or decide without it → decide
  - Someone's already run this test → research
```
