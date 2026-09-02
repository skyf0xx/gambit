---
name: forecast
description: Use when the plan rests on a belief about what will happen — turnout, a vote, a decision, a response, a timeline. Converts vague expectations into dated, falsifiable predictions with explicit probabilities, then scores them once the outcome is known so the user finds out whether their judgment is actually calibrated. Writes to GOAL.json's forecasts key.
display: checklist
---

# Skill: forecast

**Trigger**: The plan depends on something happening. "We'll get a few hundred people."
"They'll respond within a fortnight." "The council will approve it." Also use to score
predictions previously recorded, once an outcome is known.

**Purpose**: Make beliefs about the future explicit, dated, and checkable — then check
them.

Every plan contains forecasts. Left implicit, they're never wrong, because they were never
specific enough to be wrong. Writing them down changes two things: it exposes
overconfidence at the moment it's cheap to correct, and over time it tells the user which
of their own judgments to trust.

The second is the real payoff, and it only arrives if predictions are actually scored
later. A forecast never resolved is a forecast never made.

---

## Voice & Tone

Precise about uncertainty. A probability is a claim, not a hedge — "70%" means something
specific and should be defensible.

Never let a forecast escape without a resolution date and resolution criteria. "Will the
rally be successful" is not a forecast. "Will 2,000 or more people attend, per police
estimate or two independent media reports, on 30 August" is.

When scoring, be straight. The point of keeping score is finding out where the user's
judgment is systematically off, and that only works if past misses are stated plainly
rather than explained away.

---

## Execution Sequence

### 1. Load Context

Read `GOAL.json` — goal, the `plan` key, and the `forecasts` array. Check first
whether any recorded forecast has now resolved; if so, go to **6. Score** before making
new ones.

### 2. Surface the Implicit Forecasts

Read the current plan and name the beliefs it rests on. Most are unstated:

```
The plan assumes:
  - [belief] — [which plan step depends on it]
  - [belief] — [which plan step depends on it]
```

Ask which of these, if wrong, would hurt most. Forecast those. Don't forecast everything —
the exercise has a cost and its value concentrates in the load-bearing few.

### 3. Make Each One Falsifiable

```
FORECAST: [statement that will be clearly true or false]
  Resolution date: [when this will be known]
  Resolves by: [the specific source or measure that settles it]
  Probability: [N]%
  Basis: [what this rests on — a base rate, a precedent, a person's word, a gut read]
```

Rules:

- **A resolution source, not a judgment call.** "Whether it went well" resolves to an
  argument. "Police crowd estimate as reported by [outlet]" resolves to a fact.
- **Avoid 0% and 100%.** If it's certain it isn't a forecast; if you're tempted, the
  question is probably mis-specified.
- **State the base rate where one exists.** How often do things like this happen
  generally? Anchoring on the specific case while ignoring the base rate is the most
  common forecasting error and the easiest to correct.
- **Name what the estimate rests on.** A number derived from a precedent and a number
  derived from a feeling are both allowed; conflating them is not.

### 4. Pressure-Test the Number

For each forecast above 80% or below 20%, ask:

```
What would have to happen for this to go the other way?
```

If the answer comes easily and isn't far-fetched, the probability is too extreme. Confident
predictions that fail are almost always ones where the alternative was never seriously
imagined.

For anything between 40% and 60%, ask whether the plan is treating a coin-flip as settled.
That's a more common and more damaging error than a badly calibrated extreme.

### 5. Elicit

```
Before I record these:

  - What's your own number on each? Say it before you look at mine.
  - Where do we disagree most, and why?
```

Ask for the user's number *first*, without anchoring them on yours. A gap between the two
is informative regardless of which is right — it usually means one side is holding a fact
the other isn't, and finding it is worth more than splitting the difference.

Do not average the estimates. Find the disagreement and resolve it, or record both.

### 6. Score Resolved Forecasts

When a resolution date passes:

```
RESOLVED [date]: [forecast]
  Predicted: [N]% — Actual: [happened | didn't]
  Verdict: [well-called | overconfident | underconfident | right for the wrong reason]
  What the basis got wrong (if anything): [...]
```

"Right for the wrong reason" is a real category and worth recording. A correct call from
faulty reasoning will fail next time.

After several resolutions, look for a pattern and state it plainly:

```
CALIBRATION SO FAR
  [N] forecasts resolved
  Pattern: [e.g. "consistently overestimates other people's response speed";
            "turnout estimates good, institutional timelines consistently optimistic"]
  Adjust by: [the specific correction to apply to future estimates]
```

This is the output the whole skill exists for. A named systematic bias is worth more than
any individual forecast.

### 7. Update GOAL.json

Append new forecasts to the `forecasts` array, or update existing entries once they resolve. Each entry must have `statement`, `probability` (0-100 integer), `resolvesBy` (YYYY-MM-DD), `resolvesVia` (one short label, the specific source that settles it), and `resolved` (boolean). Once a forecast resolves, set `outcome` ('yes' or 'no'), `verdict` (e.g., "well-called", "overconfident"), and `resolved: true`.

New unresolved forecast:
```json
{
  "forecasts": [
    {
      "statement": "Will 2,000+ people attend per police estimate or two media reports",
      "probability": 65,
      "resolvesBy": "2026-10-30",
      "resolvesVia": "police estimate or media report",
      "resolved": false
    }
  ]
}
```

Resolved forecast (update the same entry):
```json
{
  "forecasts": [
    {
      "statement": "Will 2,000+ people attend per police estimate or two media reports",
      "probability": 65,
      "resolvesBy": "2026-10-30",
      "resolvesVia": "police estimate or media report",
      "resolved": true,
      "outcome": "yes",
      "verdict": "well-called"
    }
  ]
}
```

Keep resolved entries; they're the calibration record and the only reason the array has
long-term value.

### 8. Name the Next Step

```
Next: [the forecast most worth improving, or the plan step resting on the shakiest one]

Or:
  - Improve a shaky estimate with real data → research
  - A low-probability assumption is load-bearing → plan, or premortem
  - The forecast changes the call → decide
```
