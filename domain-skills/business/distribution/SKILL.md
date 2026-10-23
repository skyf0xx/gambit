---
name: distribution
description: Use on a business goal when the question is how customers will find and buy it — no sales yet, sales that come only through friends, a launch with no plan for reach, or effort spread across many channels with nothing working. Checks for product-market fit with Sean Ellis's survey, then runs Weinberg & Mares's Bullseye to test a few channels cheaply and concentrate on the one that works.
display: checklist
writes: experiments, decisions, log
requires: goal
phase: develop
pack: business
next: experiment, plan, comms, strategy, positioning
---

# Skill: distribution

**Trigger**: A business goal where reaching buyers is the bind: no customers yet, or
customers only from the user's own network, a launch date with no plan for who will
hear of it, or a little effort on every channel and no channel that works. Also when the
user says "if we build it, they'll come".

**Purpose**: Find the one channel that brings customers at a cost the business can
carry, by testing a few cheaply and side by side rather than betting on the first idea.
Weinberg and Mares found most start-ups that fail didn't lack a product; they lacked a
way to reach buyers. The output is a set of channel tests, then one channel to
concentrate on, recorded as a decision.

---

## Voice & Tone

Empirical and unsentimental. The user's favourite channel is a hypothesis like any
other. Every channel test has a number it must hit, set before it runs. Spreading effort
across six channels is the default failure; concentrating on one is the point.

---

## Execution Sequence

### 1. Load Context

Read the goal, success criteria, `capacity` (hours and money cap how many tests can run
at once), `decisions` (positioning names the best-fit buyer to reach), `experiments`
(earlier channel tests and their results), `people` and `stakeholders`. With no
positioning, offer it first: a channel is a way to reach someone, and without a best-fit
buyer there's no one to aim at.

### 2. Check the Product Is Wanted

When the product has users, put Sean Ellis's question to the ones who've used it
recently: "How would you feel if you could no longer use it?", with very disappointed,
somewhat disappointed and not disappointed as the answers. If 40% or more say very
disappointed, it has a pull worth pushing. Below that, more reach mostly brings more
people who leave.

Below 40%, or with too few users to ask, say so plainly. Channel tests still teach,
but keep them small, and offer `positioning` or `experiment` on the product itself. If
the survey hasn't run, it can be the first test in step 6.

### 3. Outer Ring: Every Channel

Go through all nineteen channels in *Traction* and give each one line: how it could
work for this buyer, with a rough cost and reach. Don't skip the ones that sound wrong
for this business; the overlooked channel is where competitors aren't.

Viral, PR, unconventional PR, search ads, social and display ads, offline ads, SEO,
content marketing, email marketing, engineering as marketing (free tools, calculators),
targeting blogs, business development (partnerships), sales, affiliate programmes,
existing platforms (app stores, marketplaces), trade shows, offline events, speaking
engagements, community building.

### 4. Middle Ring: The Promising Few

Pick the three or so that look strongest for this buyer, at this stage, with the user's
real hours and money. Say why each beat the rest.

### 5. Inner Ring: A Cheap Test Each

For each, the smallest test that answers three questions: how much does a customer cost
through it, how many customers can it bring, and are they the right ones? Days or a few
weeks, a small budget, a number to hit set now.

```
CHANNEL: [name]
  Test: [what to do, at what cost]
  Pass if: [customers or sign-ups, at or under what cost each, by when]
```

### 6. Show the Read, Then Commit

Put the middle ring and its tests to the user as one `confirm` reply: is the budget
real, is anything missing they already know works or doesn't? Write after they answer,
never in the turn this skill was loaded.

Call `write_section` on `experiments`, keeping every existing entry, with one entry per
channel test:

```json
{
  "experiments": [
    {
      "assumption": "[channel] can bring [buyer] at under [cost] each",
      "test": "[what to do, at what cost]",
      "passIf": "[N] sign-ups at or under [cost] each",
      "by": "YYYY-MM-DD",
      "done": false
    }
  ]
}
```

Every text field is 120 characters or less. Call `append_log` with `source:
"distribution"`, one note naming the channels under test.

### 7. Concentrate

When the tests come back, compare them on cost per customer and room to grow, not on
which felt best. Record each result on its experiment. If one channel clearly wins, put
it to the user, and once they agree, call `write_section` on `decisions`, keeping every
existing entry, replacing an earlier channel decision in place:

```json
{
  "decisions": [
    {
      "date": "YYYY-MM-DD",
      "choice": "Concentrate on [channel]; others paused",
      "because": "[its result against the others, in one line]",
      "reverseIf": "[cost per customer rises above X, or growth through it stalls for N weeks]",
      "reviewBy": "YYYY-MM-DD"
    }
  ]
}
```

If none passed, say so, and go back to the outer ring with what the tests taught. A
channel that worked once tends to wear out as it fills up, so the reverse-if matters.

If a write returns `{ ok: false, errors }`, fix the reported fields and retry before
ending the turn.

### 8. Name the Next Step

```
Next: [the first channel test to start, and its first step]

Or:
  - Sequence the tests on the plan → plan
  - Write the ad, post or pitch a test needs → comms
  - The channel changes where to push → strategy
  - Nobody's pulling for it yet → positioning, or experiment
```

---

## Source

Gabriel Weinberg & Justin Mares, *Traction* (2015): the nineteen channels and the
Bullseye's outer, middle and inner rings. Sean Ellis's product-market fit survey and its
40% "very disappointed" line, set out in Ellis & Brown, *Hacking Growth* (2017). *Traction*
also advises spending half the effort on reaching buyers from the start; this skill
leaves that split to `capacity` and `strategy`, which already weigh the user's real
hours.
