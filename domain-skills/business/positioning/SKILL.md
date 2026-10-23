---
name: positioning
description: Use on a business goal when it's unclear who the product is for, what it should be compared with, or why anyone picks it — before pricing, a launch, a pitch or a website rewrite, or when people who see it don't get it. Works April Dunford's positioning sequence from the customers who already love it to a committed positioning, recorded as a decision with a reverse-if.
display: decision-callout
writes: decisions, intel, log
requires: goal
phase: understand
pack: business
next: pricing, distribution, comms, strategy, recon
---

# Skill: positioning

**Trigger**: A business goal where the user can't say in one breath who it's for and
what it beats. Also before pricing, a launch, a pitch or a site rewrite, when people who
see the product "don't get it", when sales calls stall at "how is this different from
X?", or when the user describes the product by listing features.

**Purpose**: Decide what the product is, for whom, compared with what. Positioning is
the context a buyer judges the product in: put it in the wrong frame and its strengths
look like noise. The output is one committed positioning, recorded as a decision, that
`pricing`, `distribution` and `comms` build on.

---

## Voice & Tone

Concrete and a little impatient with abstractions. "Innovative platform for modern
teams" is not a position; "the spreadsheet replacement for wedding planners who outgrew
Excel" is. Push every answer down to a named customer, a named alternative, a named
feature.

---

## Execution Sequence

### 1. Load Context

Read the goal, success criteria, `people`, `stakeholders`, `decisions` (an earlier
positioning lives there), `intel` and `courses`. If a positioning decision already
exists, this run tests it rather than starting over: say what it was and what has
changed.

### 2. Start From the Customers Who Love It

Dunford starts from the best customers, not the product. Ask for the two or three
customers who got the most out of it, fastest, and would be most upset to lose it. If
there are no customers yet, use the people who came closest: pilots, the warmest
prospects, the people who asked for it.

No customers and no warm prospects means positioning is a guess. Say so, and add the
questions that would settle it to `intel` (step 8) before committing to anything.

### 3. List the Real Alternatives

What would those customers do if this product didn't exist? Usually not a rival
product: a spreadsheet, hiring someone, a generalist tool, doing nothing. List what
they actually used before, in their words.

```
ALTERNATIVES: [what the best customers would use instead]
```

### 4. Find What Only This Has

The features or traits the alternatives lack: delivery, expertise, a business model, a
way of working, not only product features. Cut anything the alternatives also have.

### 5. Turn Each Into Value

For each unique trait, ask "so what?" until the answer is something a customer gains:
time, money, risk avoided, status. Group what comes out into one to three themes.

```
UNIQUE: [trait] → VALUE: [what the customer gets]
```

A trait with no value nobody can name gets dropped, however proud the user is of it.

### 6. Name Who Cares Most

What do the best customers have in common that makes them care about that value? A
situation, a size, a trigger event, not a demographic. That's the segment to sell to
first.

```
BEST FIT: [the trait that makes someone care a lot]
```

### 7. Choose the Frame

The market category that makes the value obvious at a glance. Three options, in
Dunford's terms: win an existing market (the category is known, and the product is
better in a way buyers already judge on), carve a sub-segment of one ("X for Y"), or
create a new one (rarely right: it costs years of teaching buyers). Pick the one where
the unique value reads as the obvious reason to buy.

A trend (AI, remote work) goes on top only if it makes the value clearer, never as the
reason itself.

### 8. Show the Read, Then Commit

Put the whole positioning to the user as one `confirm` reply, led by the one line:

```
POSITIONING: [product] is the [frame] for [best fit] who [situation], unlike
             [alternative], because [value].
```

Ask whether it sounds like how their best customer would describe it. Fold in what
they correct, then commit. Write after they answer, never in the turn this skill was
loaded.

Call `write_section` on `decisions`, keeping every existing entry, with the positioning
as a decided decision. If an earlier positioning is there, replace it in place:

```json
{
  "decisions": [
    {
      "date": "YYYY-MM-DD",
      "choice": "Sell as the [frame] for [best fit], against [alternative]",
      "because": "[the value theme, in one line]",
      "reverseIf": "[an observable sign it's wrong: best-fit prospects still ask how it differs from X]",
      "reviewBy": "YYYY-MM-DD"
    }
  ]
}
```

Each field is 120 characters or less. Where the positioning rests on something not yet
checked (why the best customers chose it, what they used before), call `write_section`
on `intel`, keeping every existing entry, with each as an open question whose `via` names
the customer to ask. Ask them the Mom Test way: what they did, not what they think.

Call `append_log` with `source: "positioning"`, one note on what was decided.

If a write returns `{ ok: false, errors }`, fix the reported fields and retry before
ending the turn.

### 9. Name the Next Step

```
Next: [the one place the new positioning should show up first]

Or:
  - Price it against the alternative, not against cost → pricing
  - Find the channel the best-fit segment is reachable through → distribution
  - Rewrite the pitch or the page → comms
  - Check the guesses with real customers → recon
  - It changes where to push → strategy
```

---

## Source

April Dunford, *Obviously Awesome* (2019), and *Sales Pitch* (2023). Dunford's ten steps
start with forming a positioning team and aligning its vocabulary; for one user working
alone those collapse into this conversation, so this skill starts at her step on the
best customers. Her final step, capturing the positioning to share, becomes the
`decisions` entry, so the positioning carries a reverse-if like any other committed
call.
