# Design: the method, decision points and escalation ladders

Gambit works every goal through one fixed method, and every plan says what
happens if it stalls. This page explains why it's built that way. `AGENTS.md`
holds the contract the code enforces.

## Sources

- **Military planning process** (US Army FM 5-0 / Joint Publication 5-0). A fixed
  order: understand the situation, develop courses of action, wargame them, decide,
  issue the plan, then assess and loop. A plan carries **decision points** (a
  condition, set in advance, that forces a choice) and **branches** (prepared
  alternatives taken at a decision point). The information that settles a decision
  point is a critical information requirement, which `recon` models as its open
  questions.
- **Interests, rights, power** (Ury, Brett & Goldberg, *Getting Disputes Resolved*,
  1988). Disputes are settled by reconciling interests (cheap), by appeal to rights or
  formal authority (dearer), or by power (costliest, burns the relationship). Good
  systems climb in that order and keep a **loop-back** open: every rung offers the
  other side an easy way back to the cheaper level.
- **Escalation ladder** (Herman Kahn, *On Escalation*, 1965): the rung metaphor, each
  rung a deliberate, visible step up in pressure.

## The method

| # | Phase | Question | Skills |
|---|---|---|---|
| 1 | define | What exactly do we want? | `intake` |
| 2 | understand | Who decides, what moves them, what can we spend? | `stakeholders`, `systems`, `capacity`, `recon` |
| 3 | direct | Where do we push, and how hard? | `strategy` |
| 4 | develop | What are the real routes? | `options`, `decide` |
| 5 | plan | What happens, in what order, and what if it stalls? | `plan` |
| 6 | stress | How does it fail, and what does it cost the user? | `threat`, `premortem`, `exposure` |
| 7 | run | What happened, what now? Loops back to direct. | `sitrep`, `comms`, `negotiate`, `forecast`, `experiment`, `review`, `eval` |

`onboard`, `brief` and `elicit` sit outside the cycle.

### Flexible across goals

The order of phases is the same for every goal. How much each phase asks depends on
the goal, read from the goal itself rather than a size the user picks:

| Goal | Understand | Develop | Decision point | Ladder |
|---|---|---|---|---|
| Political campaign | stakeholders, systems, recon | several real routes | many | several |
| Business | stakeholders, capacity | often | yes | sometimes (supplier, landlord) |
| Lifestyle change | capacity | one route | "missed 2 runs in a week → cut to 3 days" | none |
| Picnic | nothing | one route | "rain over 50% by Friday → move to the hall" | none |

The deciding signal is the `influence` criterion: success that rests on someone else's
decision. Such a goal needs its stakeholders mapped, its routes compared, and its plan
red-teamed. A goal without one goes from focus to plan in two turns.

### Enforcement

- **Soft order.** `load_skill` loads a skill further on than the goal has reached, with
  a warning naming the skipped phase. The model says so in one line and offers the
  skipped phase first. A hard refusal would stop a user who only wants one thing.
- **One hard rule.** A `plan` write is refused unless its focus line carries a decision
  point or a ladder. This is the one requirement that fits every goal, and it's what
  makes a plan more than a to-do list. Other lines may carry if-thens too, but don't
  have to.
- **Due list.** Dated items first, then the method's next phase, then the reviews that
  keep a running goal honest, then stale sections.

## Decision points and escalation ladders

Both live on a plan line, owned by `plan`.

**Decision point**: `{if, by?, then, status: open | taken | passed}`, at most 4 per
line. It becomes due once `by` passes while still open. The page lists them as
checkpoints, open ones soonest first, each with its date in a column of its own:

```
Sun 18 Oct   if   2 weekly photos missed
             then restart the baseline
Mon 19 Oct   if   council offers a one-off clean
             then take it, keep chasing
```

Each half is one phrase of at most 8 words, with no leading "if" or "then" and no
second clause, so it reads at a glance. Flesch-Kincaid already runs on every goal write,
but it measures word and sentence length, so a run-on line of short words passes it.
The word cap is what keeps each half to one idea.

A checkpoint watches what the user doesn't control: someone else's reply, the weather, a
count. The user's own routine is a dated next action instead, and slips show in the due
list. A checkpoint never hands the matter to one of the ladder's rungs; the rung's wait
already does that. Each half is saved starting in lower case unless it opens with a name,
so it reads after the page's "if" and "then".

**Ladder**: at most 6 rungs per line, one ladder per line, so a campaign can push on
two authorities in parallel.

```js
rung = {
  level: 'interests' | 'rights' | 'power',
  action, to,      // `to`: a people or stakeholders name, verbatim
  carries?,        // what it brings forward: reference number, paper trail
  waitDays,        // 1–90: how long before the next rung is due
  status: 'pending' | 'sent' | 'answered' | 'unanswered' | 'skipped',
  sentOn?,         // stamped when sent
  outcome?,        // what they said
}
```

- Rungs climb `interests` → `rights` → `power`, never back down, with one rung sent at
  a time.
- `to` must already be in `people` or `stakeholders`, and is never the user, which
  forces the question of who actually holds the authority.
- Sending the next rung marks the silent one before it `unanswered`, so the ladder
  keeps the paper trail.
- An answer stops the climb until `plan` decides whether it settles the ask.
- The page lets the user mark the next rung sent, or the rung that's out answered.
- Due items: a sent rung past its wait, and an answered rung with no outcome recorded.
- A `power` rung still to go holds the method in its stress phase until `exposure` has
  checked it.

How the skills share the work:

| Skill | Role |
|---|---|
| `stakeholders` | finds who owns the problem and who sits above them |
| `recon` | the formal channels: complaint process, response times |
| `options` | treats one ask at three volumes as one course with a ladder, not three courses |
| `plan` | builds the ladder and decision points, and climbs it |
| `threat` | red-teams the climb |
| `exposure` | checks the user's own risk before any public rung |
| `comms` / `negotiate` | draft each rung's message, naming what would settle it |
| `strategy` | moving up a level can mean a posture change; a spent ladder or a taken decision point reopens the focus |
| `review` | runs once a ladder resolves |

## Example: Sydney train tunnel cleanup

`stakeholders` finds that the tunnel belongs to Sydney Trains (Transport for NSW), not
the council. The ladder:

| # | Level | Action | To | Carries | Wait |
|---|---|---|---|---|---|
| 1 | interests | Report it, ask for a clean-up date | Sydney Trains | photos | 14 days |
| 2 | rights | Formal complaint quoting the reference | TfNSW complaints | reference number | 21 days |
| 3 | rights | Ask the state MP to raise it | State MP | paper trail | 21 days |
| 4 | rights | Complaint to the NSW Ombudsman | NSW Ombudsman | paper trail | 30 days |
| 5 | power | Story pitch with photos and petition | Local paper | photos, signatures | 14 days |

Rung 5 makes `exposure` due before it goes out.
