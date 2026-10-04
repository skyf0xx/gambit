# Design: a fixed method, decision points and escalation ladders

Status: proposal, for approval before build.

## Problem

1. **Skills are picked opportunistically.** `suggestSkills` (`packages/core/src/flow.mjs`)
   lists what is overdue or missing, and each skill's `next` frontmatter names likely
   hand-offs, but nothing says where a goal sits in an overall method. Two sessions on the
   same goal can walk the skills in different orders, and a plan can be written before
   anyone has asked who actually holds authority.
2. **Plans have no "if this, then that".** A line of operation is an ordered list of
   steps and next actions. It cannot say "if the council hasn't replied in 14 days, send
   the reference number to the head of council." That conditional move lives only in the
   user's head.

## Sources

- **Military planning process** (US Army FM 5-0 / Joint Publication 5-0, the military
  decision-making process). A fixed order: understand the situation, develop courses of
  action, wargame them, decide, issue the plan, then assess and loop. A plan carries
  **decision points** (a condition, set in advance, that forces a choice), **branches**
  (prepared alternatives taken at a decision point) and **sequels** (the next phase if
  it goes well), tied together in a **decision support matrix**. The information that
  settles a decision point is a **critical information requirement**, which `recon`
  already models as its open questions.
- **Interests, rights, power** (Ury, Brett & Goldberg, *Getting Disputes Resolved*,
  1988). Disputes are settled by reconciling interests (cheap), by appeal to rights or
  formal authority (dearer), or by power (costliest, burns the relationship). Good
  systems climb in that order and keep a **loop-back** open: every rung offers the other
  side an easy way back to the cheaper level.
- **Escalation ladder** (Herman Kahn, *On Escalation*, 1965): the rung metaphor itself,
  each rung a deliberate, visible step up in pressure.

Gambit's skills already map onto the military planning process; this design makes that
order explicit and adds the missing decision points and branches.

## Part A — The method

Every goal moves through one fixed cycle. Each skill belongs to one phase, declared in
its frontmatter as `phase:`.

| # | Phase | Question | Skills | Done when |
|---|---|---|---|---|
| 1 | Define | What exactly do we want? | `intake` | goal is not a stub |
| 2 | Understand | Who decides, what moves them, what can we spend? | `stakeholders`, `systems`, `capacity`, `recon` | `stakeholders` mapped if any criterion is `influence`; `systemsNotes` set; `capacity` set |
| 3 | Direct | Where do we push, and how hard? | `strategy` | `posture` set (focus named) |
| 4 | Develop | What are the real routes? | `options`, `decide` | a course is `chosen`, or `strategy` recorded that only one route exists |
| 5 | Plan | What happens, in what order, and what if it stalls? | `plan` | `plan` set, focus line has at least one decision point or ladder |
| 6 | Stress | How does this fail, and what does it cost me? | `threat`, `premortem`, `exposure` | a `threat` risk exists; `exposure` checked if a ladder has a `power` rung |
| 7 | Run | What happened, what now? | `sitrep`, `plan` (status), `comms`, `negotiate`, `forecast`, `experiment`, `review`, `eval` | never; loops to 3 on a review, a stale focus, or a branch taken |

`onboard`, `brief`, `elicit` sit outside the cycle (entry, read-only, checkpoint).

### In code

- **`methodStep(goal)`** in `flow.mjs` returns the first phase not yet done, derived from
  the goal; nothing new is stored.
- **`suggestSkills` order** becomes: dated items first (forecasts, experiments, overdue
  moves, intel, talks, decisions, ladder rungs), then the method's next phase, then stale
  sections. Today the missing-section checks come in a fixed but arbitrary order; this
  makes that order the method's.
- **State block** names the phase: "Method: Understand — stakeholders not mapped yet."
- **`load_skill` stays permissive but warns.** Loading a skill whose phase is ahead of
  `methodStep` succeeds, and the tool result names the skipped phase so the model says so
  (the way `plan` step 1 already flags a missing `systemsNotes`). A hard refusal would
  stop a user who just wants `decide` on one question.
- **One hard gate:** a `plan` write fails if the focus line has neither a decision point
  nor a ladder. That is what "a plan isn't finished until it says what happens if it
  stalls" means in code.
- **Test:** every skill in `skills/` declares a valid `phase`, and each skill's `next`
  points only to its own phase, the next one, or back to Direct.
- **GUIDED.md** gains a short "Work the method" rule: lead with the due item, otherwise
  the method's next phase; never skip Understand on an `influence` goal.

## Part B — Decision points and escalation ladders

Both live on a line of operation, owned by `plan`.

### Decision points (general branches)

```js
decisionPoint = {
  if: mediumLabel,      // "no reply by 20 Oct", "under 10 signatures by 1 Nov"
  by: dateString?,      // when the condition is checked
  then: mediumLabel,    // the branch: what we do if it's true
  status: 'open' | 'taken' | 'passed',
}
lineOfOperation.decisionPoints: array(decisionPoint).max(4)
```

### Escalation ladder

```js
rung = {
  level: 'interests' | 'rights' | 'power',
  action: mediumLabel,   // "Send letter of complaint"
  to: shortLabel,        // a people[] or stakeholders[] name, verbatim
  carries: shortLabel?,  // "reference number", "full paper trail"
  waitDays: int 1–90,    // how long they get before the next rung
  status: 'pending' | 'sent' | 'answered' | 'skipped',
  sentOn: dateString?,   // stamped by setStatus on → 'sent', like doneOn
  outcome: mediumLabel?, // what they said, once answered
}
lineOfOperation.ladder: array(rung).max(6).optional()
```

Write rules (`writeSection` / `setStatus`, `ops.mjs`):

- Rungs climb in order: `level` never goes down the ladder (interests → rights → power).
- `to` must name someone in `people` or `stakeholders`, as `prep.with` does. This forces
  `stakeholders` to find who actually has authority before the ladder is built.
- At most one rung is `sent` at a time.
- An `answered` rung stops the climb: later rungs stay `pending` until `plan` decides
  whether the answer was enough (the loop-back).
- The user can tick a rung `sent` or `answered` on the page; it queues in
  `pendingEdits` like any status flip.

Flow (`suggestSkills`):

- A `sent` rung past `sentOn + waitDays` with no answer:
  `plan` — "no reply from Council in 14 days; next rung: Head of council".
- A `decisionPoint` whose `by` has passed while `open`: `plan` — "decision point due".
- The next rung is `power` and no `exposure` entry exists: `exposure` —
  "check your own risk before going public".

How the other skills fit:

| Skill | Role |
|---|---|
| `stakeholders` | names who holds authority at each rung |
| `strategy` | reads the ladder; climbing to a `power` rung prompts a posture review |
| `comms` / `negotiate` | prepare the message for the active rung |
| `recon` | an open question per rung where the answer isn't simply "did they reply" |
| `exposure` | required before a `power` rung |
| `threat` | `reads: plan`, so a new ladder makes it due |
| `review` | runs once a ladder resolves, either way |

Registry and page: the plan line renders its ladder as a short vertical list, with the
active rung highlighted and its "next rung on" date shown, and decision points as
"if → then" rows under the critical path.

## Example: Sydney train tunnel cleanup

Stakeholders first finds that the tunnel belongs to Sydney Trains (Transport for NSW),
not the council. The ladder then reads:

| # | Level | Action | To | Carries | Wait |
|---|---|---|---|---|---|
| 1 | interests | Report via feedback form, ask for clean-up date | Sydney Trains | photos | 14 days |
| 2 | rights | Formal complaint quoting reference number | TfNSW complaints | reference number | 21 days |
| 3 | rights | Ask your state MP to raise it | State MP | paper trail | 21 days |
| 4 | rights | Complaint to the NSW Ombudsman | NSW Ombudsman | paper trail | 30 days |
| 5 | power | Story pitch with photos and petition | Local paper | photos, signatures | — |

Rung 5 makes `exposure` due before it can go out.

## Open questions

1. **Gate strength.** Proposed: warn when skipping a phase, and hard-gate only "focus line
   needs a decision point or ladder." Do you want any phase hard-gated?
2. **Decision points everywhere?** Proposed: required on the focus line only. Other
   lines may carry them but don't have to.
3. **Ladder per line.** Proposed: one ladder per line, since a goal can push on two
   authorities in parallel lines. One ladder per goal would be simpler.
