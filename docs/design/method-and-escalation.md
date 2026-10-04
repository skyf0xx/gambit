# Design: the method and linked tasks

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
  systems climb in that order and keep a **loop-back** open: every step offers the
  other side an easy way back to the cheaper level.
- **Escalation ladder** (Herman Kahn, *On Escalation*, 1965): each step a deliberate,
  visible move up in pressure.

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

| Goal | Understand | Develop | Fork | Escalations |
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
- **One hard rule.** A `plan` write is refused unless its focus line carries a
  conditional task: an escalation or a fork. This is the one requirement that fits every
  goal, and it's what makes a plan more than a to-do list. Other lines may carry them
  too, but don't have to.
- **Due list.** Dated items first, then the method's next phase, then the reviews that
  keep a running goal honest, then stale sections.

## Linked tasks

A plan line's moves are tasks that point at each other. Ordering, escalation and forks
are links the page draws under a task, not words the model writes into it, so each
move stays a plain todo and the hard-to-read compressed sentences ("if council's reply
names no chase to rail") have nowhere to come from.

```js
task = {
  id: 'letter',                          // short, stable; for tasks others point at
  action: 'Send the complaint letter',   // a plain todo
  who, when?, status, detail?,
  after?: ['photos'],                    // waits until these are done
  to?: 'Sydney Trains',                  // a message: a people or stakeholders name
  level?: 'interests',                   // on an escalation: interests | rights | power
  if?: { noReply: 'letter', days: 14 }   // an escalation of that message
     | { event: 'under 10 sign-ups', by?, happened? }, // a fork
  replied?, reply?,                      // they answered: when, and what they said
}
```

`taskState` reads each task as `blocked` (waiting on `after`), `waiting` (its condition
hasn't come true) or `live`. Only a live task can be the top move, count as overdue, or
go on the calendar.

**Escalations.** A message is a task with `to`; done means it went out. An escalation
is a message with `if: {noReply}`, live once the message it follows went out, got no
reply, and its `days` passed. A reply stops the climb until `plan` decides whether it
settles the ask. Escalations climb `interests` → `rights` → `power` and never step down,
and `to` must already be in `people` or `stakeholders` and is never the user, which
forces the question of who actually holds the authority. A `power` escalation still to
go holds the method in its stress phase until `exposure` has checked it.

**Forks.** A task with `if: {event}` is a move made only if the event happens. The test:
if the event never happened, would the user still make this move? If yes, it forks
nothing, so a fork saying the plan carries on ("anyway", "still", "keep chasing"), or
matching a move already in the plan unconditionally, is refused. The event is one plain
phrase of at most 8 words, a fact outside the user's control, saved in lower case unless
it opens with a name, so it reads after the page's "if". A line with no natural fork
carries the one every plan has: no measurable progress by a date, then rethink the
approach. A worry about being sidetracked by a token gesture is a `threat` risk, not a
fork. The user's own routine is a plain dated move.

**Milestones.** A line's critical-path steps are its milestones: points it passes, not
things to do. A milestone lists in `after` the tasks that reach it and shares the plan's
ids with them, so a task can also wait on a milestone. It has no status and no
sub-items. In project planning a milestone is a zero-duration event, reached when its
predecessors finish; here too it is reached once every task it lists is done or dropped,
with at least one done, and un-reached the moment one is ticked back. Nothing is stored,
so the page and the due list can't disagree with the tasks. The due list flags
a milestone whose every task was dropped: its route is gone, so it needs a new one.

**Page.** A task is something to do; a milestone is something that becomes true, so it
never gets a box. It is a checkpoint, drawn the way a notebook draws a line under a column
of figures and writes the total beneath: a line under the tasks that reach it, at their
level, then its name beside a diamond in the marker column. The diamond is open until
those tasks are done, then filled. The name is a size smaller than a task and not bold, so
the moves stay the loudest thing on the page, and it stays left-aligned with them, so
every row starts at one edge and a milestone never reads as a heading for what follows.
The line's material says where it stands, the way the rest of the page does: ink once
passed, pencil for the one the plan is heading to, a faint broken pencil line for one
further on. Each task row's marker says where that task stands, so no group labels are
needed except for forks:

```
☑  Find who owns the tunnel                       (grey)
☑  Ask Sydney Trains who cleans it                (grey)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
◆  Owner on record
   reached Wed 16 Sep

☐  Collect signatures from neighbours        Mon 12 Oct
      → Print the flyers
✉  Report the graffiti · to Sydney Trains · sent Mon 28 Sep
      · waiting for a reply, day 6 of 14
      if no reply: Formal complaint to TfNSW complaints, then State MP,
      then Local paper (public)                            they replied
•  Collect signatures from neighbours → Print the flyers
   ─────────────────────────────────────────────
◇  Clean-up date set

•  Clean-up date set → Walk the site with the crew
   - - - - - - - - - - - - - - - - - - - - - - -
◇  Tunnel cleaned                                 (grey)

if things change
↳  if under 10 sign-ups · check Sun 1 Nov
      then Door-knock the street first            it happened  it didn't
```

A passed milestone stays where it was, its diamond filled, its line in ink, and the day it
was reached (the last day a task toward it was done) pencilled under its name. Done tasks
never fold away: they stay where they were, ticked and grey, so a passed milestone keeps
the moves that reached it above its line, and the moves still to make stand out in ink. A
message still waiting for a reply stays in ink, marked ✉. The done tasks above the line
the plan is heading to show how far toward it the plan has come. The top move, on the
index card, is listed in its place too, so its milestone always has a move above its
line. A task no milestone lists sits before the milestone the plan is heading to. The
arrow always means "then"; "to" names who a message goes to. ☐, ✉, •, ↳ and the diamond
share one column, so every row's text starts at one edge.

A sent message stays marked ✉ until it's answered, rather than ticked
done. An escalation still waiting shows only in its message's "if no reply" line, and
becomes a row of its own when its wait runs out.

How the skills share the work:

| Skill | Role |
|---|---|
| `stakeholders` | finds who owns the problem and who sits above them |
| `recon` | the formal channels: complaint process, response times |
| `options` | treats one ask at three volumes as one course with escalations, not three courses |
| `plan` | links the tasks, and records sends, replies and forks |
| `threat` | red-teams the climb |
| `exposure` | checks the user's own risk before any public step |
| `comms` / `negotiate` | draft each message, naming what would settle it |
| `strategy` | a step up a level can mean a posture change; a spent climb or a taken fork reopens the focus |
| `review` | runs once a climb resolves |

## Example: Sydney train tunnel cleanup

`stakeholders` finds that the tunnel belongs to Sydney Trains (Transport for NSW), not
the council. The plan's tasks:

| id | Action | To | Level | Link |
|---|---|---|---|---|
| `report` | Report it and ask for a clean-up date | Sydney Trains | interests | |
| `complaint` | Formal complaint quoting the reference | TfNSW complaints | rights | if no reply to `report` in 14 days |
| `mp` | Ask the state MP to raise it | State MP | rights | if no reply to `complaint` in 21 days |
| `ombudsman` | Complain to the NSW Ombudsman | NSW Ombudsman | rights | if no reply to `mp` in 21 days |
| `paper` | Pitch the story with photos and signatures | Local paper | power | if no reply to `ombudsman` in 30 days |
| | Door-knock the street first | | | if under 10 sign-ups, check 1 Nov |
| | Rethink the approach | | | if no clean-up date set, check 1 Dec |

The `paper` step makes `exposure` due before it goes out.
