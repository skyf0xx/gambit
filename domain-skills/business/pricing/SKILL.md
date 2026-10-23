---
name: pricing
description: Use on a business goal when the user must set, raise or rethink a price, choose how to charge (per seat, per use, flat, subscription), or split an offer into tiers — ideally before building, while the answer can still shape what gets built. Runs Madhavan Ramanujam's willingness-to-pay method, then records the price and model as a decision, with a live test where the evidence is thin.
display: decision-callout
writes: decisions, intel, experiments, log
requires: goal
phase: develop
pack: business
next: experiment, negotiate, comms, plan, decide
---

# Skill: pricing

**Trigger**: A business goal that needs a price: a first price, a price rise, a
discount question, how to charge, or what goes in which tier. Also when the user says
"I'll figure out pricing later" about something not built yet. That is the moment this
skill matters most.

**Purpose**: Find out what buyers will pay before committing to a price, and design the
offer around it. Ramanujam's finding is that most new products fail on money, not on
features: built first and priced last, they end up with features nobody pays for. The
output is a price, a way of charging and a tier split, recorded as a decision.

---

## Voice & Tone

Numerate and plain. Price against the value to the buyer and against their alternative,
never against cost plus a margin. Cost sets the floor, not the price. Say when a price
is a guess.

---

## Execution Sequence

### 1. Load Context

Read the goal, success criteria, `capacity` (runway sets how long a price can be wrong),
`decisions` (a positioning there names the alternative to price against), `intel`,
`experiments`, `people` and `stakeholders`. With no positioning, say so: a price without
an alternative to compare with is a number with nothing to judge it by. Offer
`positioning` first, and go ahead if the user wants the price now.

### 2. Get Willingness to Pay

The evidence, best first:

1. **What buyers already paid**: for this, or for the alternative they use now.
2. **Commitments**: a pre-order, a deposit, a signed letter of intent at a price.
3. **The willingness-to-pay talk**: Ramanujam's questions, asked once the buyer has
   described the problem in their own words and seen a concrete offer:
   - "What would be an acceptable price for this?"
   - "What price would feel expensive, though you'd still consider it?"
   - "At what price would you not even consider it?"

Stated prices run high. Fitzpatrick's rule from `recon` still holds: what someone said
they'd pay is weaker than what they did. Treat the talk as a range to test, and say
which evidence the price rests on.

When there's none yet, call `write_section` on `intel`, keeping every existing entry,
with an open question per buyer to ask, `via` naming them.

### 3. Group Buyers by What They Value

Ramanujam's segments are by need and willingness to pay, not by size or age. Two or
three groups at most: who values what, and how much more. If every buyer wants the same
thing at the same price, one offer is fine; say so and skip to step 5.

### 4. Build the Offer

For each feature or part of the offer, sort it:

- **Leader**: the reason a group buys. It defines that offer.
- **Filler**: nice to have. Rounds out the offer; nobody pays much for it alone.
- **Killer**: something a group doesn't want and that makes them less willing to pay.
  Take it out of their offer, even if it costs nothing to include.

One tier per group, built around its leaders. A killer bundled in "for free" lowers the
price people will pay.

### 5. Choose How to Charge

How money changes hands often matters more than how much. Pick the model that grows with
the value the buyer gets: per use when value is per use, subscription when it's ongoing,
a flat fee when it's one job. Then the strategy: charge what the value supports, go
lower to win the market fast (only if winning it big is the point and the runway allows
it), or start high and come down.

```
PRICE: [amount] per [unit], [model]
TIERS: [group] → [offer] at [price]
RESTS ON: [the evidence from step 2, or "a guess"]
```

### 6. Show the Read, Then Commit

Put the price, model and tiers to the user as one `confirm` reply, with the evidence
named. Write after they answer, never in the turn this skill was loaded.

Call `write_section` on `decisions`, keeping every existing entry, replacing an earlier
pricing decision in place:

```json
{
  "decisions": [
    {
      "date": "YYYY-MM-DD",
      "choice": "[amount] per [unit], [model]; [tiers in a few words]",
      "because": "[the willingness-to-pay evidence, in one line]",
      "reverseIf": "[an observable signal: fewer than 2 in 10 prospects buy at this price]",
      "reviewBy": "YYYY-MM-DD"
    }
  ]
}
```

When the price rests on stated willingness or a guess, also call `write_section` on
`experiments`, keeping every existing entry, with a test that asks real buyers to pay,
the threshold set now:

```json
{
  "experiments": [
    {
      "assumption": "[group] will pay [price] for [offer]",
      "test": "Offer it at [price] to [N] prospects from [group]",
      "passIf": "[k] or more pay or put down a deposit",
      "by": "YYYY-MM-DD",
      "done": false
    }
  ]
}
```

Every text field is 120 characters or less. Call `append_log` with `source: "pricing"`,
one note on what was set.

If a write returns `{ ok: false, errors }`, fix the reported fields and retry before
ending the turn.

### 7. Name the Next Step

```
Next: [the first buyer to put the price in front of, and when]

Or:
  - Put the price to a real test → experiment
  - A buyer will push back on it → negotiate
  - Say the price and its value on the page or the pitch → comms
  - Sequence the launch at this price → plan
```

---

## Source

Madhavan Ramanujam & Georg Tacke, *Monetizing Innovation* (2016): willingness to pay
talked about before building, segments by need and willingness to pay, leaders, fillers
and killers, and the choice of model and strategy. Their book sets nine rules for
companies with a product team; this skill keeps the method and drops the internal
steps (business cases, price governance) a single founder or small team doesn't run. The
check of stated against shown willingness comes from Rob Fitzpatrick's *The Mom Test*
(2013), used the same way in `recon`.
