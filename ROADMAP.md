# Roadmap: Domain Skill Packs

Gambit's core skills are domain-agnostic: `strategy`, `plan`, `threat`, and
`negotiate` treat a Series A raise and a park-cleanup identically. Both are
served adequately, neither expertly. Domain packs add depth — curated,
attributed bodies of expert knowledge, loaded only when the active goal's
shape calls for them — without diluting the core.

## Inclusion bar

Three tests, in order. Failing any one is disqualifying. The bar exists to
block the obvious failure mode: laundering blog-post consensus into an
authoritative-looking `SKILL.md`, which is worse than no skill, since the
user can't tell the difference and the agent states it with Clausewitz's
confidence.

**Named source.** Name the person and the work — "April Dunford, *Obviously
Awesome*, 2019," not "the consensus among growth marketers." This is
already the bar the core meets: `premortem` is Gary Klein's prospective
hindsight; `negotiate` is Fisher & Ury's BATNA/ZOPA; `forecast` is Tetlock's
calibration work; `systems`/`strategy`/`plan`/`threat` are Clausewitz, JP
5-0, and Boyd; `experiment` is Ries via Blank.

**Executable, beyond vocabulary.** Fame isn't sufficient — many celebrated
frameworks are taxonomies that label a situation without saying what to do
next. Porter's Five Forces, the BCG matrix, and most of Blue Ocean fail
this: no question sequence, no ordering, no stopping condition. Christensen's
Jobs to Be Done passes — a real interview protocol with rules for which
questions invalidate a response.

**Produces a decision or a state change.** Every Gambit skill writes a
goal key or leaves a committed next step. If a framework's output is
"the user understands their situation better," that's `brief`, not a new
skill.

## Sourcing

One rule, conditioned on license status:

- **Licensed to redistribute** (public domain, Creative Commons, MIT/Apache
  as with BMAD, or explicit rightsholder permission): vendor verbatim —
  full text, pinned version, attribution file, exactly the BMAD pattern.
- **Not licensed** (true of nearly every book on the candidate list below):
  implement the method natively, in Gambit's own voice, citing the source.
  Methods aren't copyrightable, text is — Gambit implements Dunford's
  ten-step positioning sequence as a native `SKILL.md` the same way
  `negotiate` implements BATNA without reproducing *Getting to Yes*.

A domain skill that adapts one named method closely (the business pack)
carries a `## Source` section naming the work and what changed. A pack
drawn from a whole field of practice (activism) carries the practice
itself in reference files instead: the bar is that an expert would
recognise every step, not that each one is footnoted.

## Storage and loading

Domain skills are not peers of `skills/strategy` or `skills/plan`. They
live outside `skills/` entirely, bundled with the app the same way the core
catalogue is, so the app never treats the packs as part of the always-on
core surface:

- **`domain-skills/<pack>/<skill>/SKILL.md`**, top-level, sibling to
  `skills/`. A vendored-verbatim pack also holds an `ATTRIBUTION.md` in the
  BMAD shape.
- **`pack: <pack>`** in each skill's frontmatter, beside its other flow
  fields, so the gate is checked in code rather than inferred.
- **`domains`** on the goal: the packs it draws on, a list, so a mixed goal
  ("build a business that funds my activism") carries more than one.
  `intake` sets it from what the goal is, and only asks when it's unclear.
  `load_skill` refuses a pack skill whose pack the goal doesn't carry, and
  the refusal tells the model to ask the user and tag the goal, so a pack
  that should fire on an untagged goal is caught the first time the model
  reaches for it.

The two failures this designs against are the fundraising skill firing on
a park-cleanup goal, which the gate stops, and a pack that never fires,
which the skill index (it lists every pack skill with its pack) and the
state block (it names the packs on the goal and their skills) work against.

## Key ownership

No new goal schema key per pack — fifteen packs would mean fifteen
keys, most null on any given goal. Domain skills follow the `premortem`/
`review` pattern instead: own no key, append findings to an existing one
(`systemsNotes`, `riskNotes`, `plan.nextActions`, or `log`), tagged with the
originating skill. A skill that genuinely needs durable structured state of
its own (a pricing skill persisting a willingness-to-pay curve) is the one
case this pattern doesn't cover cleanly, and gets resolved when a skill
like that is actually specified, not before.

## Composition vs. new skills

Most named domain problems decompose into existing core skills plus one or
two genuinely new pieces, rather than becoming a monolithic new skill.
"Get to Series A" is `stakeholders` (cap table, who the partners answer to)
plus `negotiate` (the terms conversation) plus `forecast` (runway and
milestone predictions) plus a Venture Deals reference for clause-level
reading — a documented sequence through the core, not a fifth new skill.
Every candidate below gets checked against this before being built as a
standalone skill: build new only where the core has nothing.

A related sorting pass applies to candidates that read as domain-specific
but aren't. Rumelt's strategy kernel is a check on `strategy` itself.
Meadows' intervention points overlap `systems` directly. Duke's
resulting-vs-process distinction belongs in `review`. *The Mom Test*
applies to any goal requiring finding out what people actually want,
including a job search's informational interviews. These belong in the
core, or as domain-agnostic additions to it — not packaged as business
skills just because the source happens to write for a business audience.

## Candidate domains

Grouped by field. Business first by demand, but the pattern holds well past
business, and several of the strongest candidates aren't business at all.

### Business: build and sell

| Skill | Source | Mechanism | Output |
|---|---|---|---|
| Customer discovery | Rob Fitzpatrick, *The Mom Test* | Rules for which questions produce valid data; compliments are worthless, specifics about past behavior are gold | Validated or falsified demand assumption |
| Jobs to be done | Clayton Christensen, *Competing Against Luck* | Interview protocol reconstructing the moment of switching | The job the product is hired for |
| Positioning | April Dunford, *Obviously Awesome* | Ten-step sequence: competitive alternatives, unique attributes, value, segment | A committed positioning statement |
| Pricing | Madhavan Ramanujam, *Monetizing Innovation* | Willingness-to-pay question sequence run before building | Price point and feature/tier split |
| Distribution | Weinberg & Mares, *Traction*; Sean Ellis PMF survey | Bullseye ranked-channel elimination; the 40% "very disappointed" threshold | One channel to concentrate on |
| Fundraising terms | Feld & Mendelson, *Venture Deals* | Clause-by-clause; economics-vs-control as the analytical frame | Term sheet read, clauses that matter flagged |
| Operating cadence | Andy Grove, *High Output Management* | Managerial output-per-hour math, forecasting cadence, task-relevant maturity | An operating rhythm sized to the team |

### Organizations and people

| Skill | Source | Mechanism | Output |
|---|---|---|---|
| Hiring | Geoff Smart & Randy Street, *Who* | Scorecard first, then a fixed four-interview sequence | A hire/no-hire call, scorecard as evidence |
| Difficult conversations | Stone, Patton & Heen (Harvard Negotiation Project) | Three-conversation decomposition: what happened, feelings, identity | A prepared conversation, not a script |
| Important conversations | Patterson et al. | Safety diagnosis; when to step out of content and rebuild safety | A conversation plan with re-entry conditions |
| Team dysfunction | Patrick Lencioni | Five-layer model, each layer prerequisite to the next | Diagnosis of which layer is actually broken |

### Systems, decisions, and thinking

Rumelt and Meadows below are flagged core candidates, not pack material —
see Composition above.

| Skill | Source | Mechanism | Output |
|---|---|---|---|
| Intervention points | Donella Meadows, *Thinking in Systems* | Twelve ranked points where a system can be changed, weakest to strongest | Where to intervene, ranked |
| Strategy kernel | Richard Rumelt, *Good Strategy/Bad Strategy* | Diagnosis, guiding policy, coherent action; a bad-strategy detector (fluff, dodging the challenge, goals-as-strategy) | A kernel, or a verdict that current strategy is fluff |
| Decision hygiene | Kahneman, Sibony & Sunstein, *Noise*; Annie Duke, *Thinking in Bets* | Decision hygiene protocol; resulting vs. process quality | A decision separated from its outcome |
| Constraint theory | Goldratt, *The Goal* | Five focusing steps: identify, exploit, subordinate, elevate, repeat | The binding constraint, and what to do about it |

### Health, performance, and the personal

Currently served only by generic skills, despite the README naming fitness
and life goals as core use cases.

| Skill | Source | Mechanism | Output |
|---|---|---|---|
| Training design | Rippetoe & Kilgore, *Practical Programming*; Israetel's volume-landmark work | Progression models keyed to training age; MEV/MAV/MRV landmarks | A program built on a progression rule, not a fixed workout list |
| Sleep and recovery | Matthew Walker, *Why We Sleep*; Czeisler's circadian work | Circadian and sleep-pressure model | A schedule change with a stated mechanism |
| Habit formation | BJ Fogg, *Tiny Habits*; Wendy Wood, *Good Habits Bad Habits* | Behavior = Motivation × Ability × Prompt; context-stability research | A habit design with an anchor and a scaled-down behavior |
| Deliberate practice | Anders Ericsson, *Peak* | Practice at the edge of ability with immediate feedback | A practice loop with a feedback source |
| Learning | Brown, Roediger & McDaniel, *Make It Stick* | Retrieval practice, spacing, interleaving over rereading | A study schedule with retrieval built in |

### Writing, argument, and public work

Depth under `comms`, which already frames outward messages — not a
duplicate of it.

| Skill | Source | Mechanism | Output |
|---|---|---|---|
| Argument structure | Toulmin model; Minto's Pyramid Principle | Claim, grounds, warrant; answer first, then support | A restructured argument |
| Prose quality | Williams, *Style: Toward Clarity and Grace* | Characters as subjects, actions as verbs; specific diagnosis of unclear sentences | Revised prose with the diagnosis stated |
| Explanation | Feynman technique; Chip & Dan Heath, *Made to Stick* | Teach-it-back; the six SUCCESs properties as a checklist | An explanation tested against a naive reader |

### Civic, legal, and organizing

Depth under `exposure`, `stakeholders`, and `threat`, which already
anticipate this territory.

| Skill | Source | Mechanism | Output |
|---|---|---|---|
| Nonviolent action | Gene Sharp, *The Politics of Nonviolent Action*; Chenoweth & Stephan's 3.5% research | 198 catalogued methods; pillars-of-support analysis | A tactic selected against a pillar |
| Community organizing | Saul Alinsky, *Rules for Radicals*; Marshall Ganz's public narrative | Self/us/now narrative structure; relational meeting practice | A recruitment approach, or a narrative |
| Commons governance | Elinor Ostrom's eight design principles | Diagnostic against the eight principles | Which principle the arrangement violates |

### Money

Feeds `capacity`, which already asks about money in operator terms, rather
than replacing it.

| Skill | Source | Mechanism | Output |
|---|---|---|---|
| Personal financial runway | Bogleheads/Bernstein on allocation; the safe-withdrawal literature | Runway math and allocation by time horizon | A runway figure `capacity` consumes |
| Expected value under ruin | Taleb on ergodicity and ruin; Kelly criterion | Distinguishes EV-positive bets from survivable ones | A sizing decision, or a refusal |

## Sizing a pack

A pack of three strong skills beats fifteen adequate ones — the inclusion
bar exists to keep the count down. Below some threshold, the gating
machinery isn't worth it: a domain that only yields two skills passing all
three tests ships as loose skills, not a pack.

## Status

Done:

- The flagged core candidates are in the core: Rumelt's kernel in
  `strategy`, Meadows' leverage points in `systems`, decision hygiene from
  *Noise* in `decide`, Duke's resulting check in `review`, *The Mom Test* in
  `recon`, and Goldratt's five focusing steps in `capacity`.
- The business pack: `positioning` (Dunford), `pricing` (Ramanujam) and
  `distribution` (Traction's Bullseye with the Ellis survey). Customer
  discovery is served by `recon`; jobs to be done, fundraising terms and
  operating cadence wait on demand.

- The activism pack: `demands`, `pillars`, `tactics`, `organizing`,
  `message` and `backfire`, with the depth in reference files beside
  each skill. It covers the civic rows above except commons governance.

Next: a health and performance pack. It needs recurring tasks in the plan
first, since a habit, a training progression or a practice loop repeats on
a cadence and the plan holds one-off tasks only.

## Sequencing

Order of operations: sort every flagged core-vs-pack candidate first, since
that reassigns several rows in the tables above before any pack is
specified. Then specify one pack fully against the inclusion bar to find
the actual cost of a pack. Then decide whether to repeat the pattern.

Business is the obvious first pack by demand. Health/performance is the
stronger first pack by risk: it's a domain where generic advice is most
visibly inadequate, the sources are unusually rigorous, and the core
doesn't cover it at all.
