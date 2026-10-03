# Plan reference: dependency graph and critical path

Read from `plan` steps 3 and 4. These templates are the full rules for building a
graph; nothing in them is optional.

### 3. Build the Dependency Graph (per line)

For each line of operation, enumerate the concrete actions needed, and their dependencies. If an action belongs to someone specific, name them. If an action's payoff depends on an unverified premise about how a third party or system will behave — not just whether the user can do it, but whether doing it produces the intended effect — flag that node explicitly rather than sequencing it at face value:

```
Action A — no dependencies — can start immediately — [you | person's name/role]
Action B — depends on: A — [...]
Action C — depends on: A — [ASSUMPTION: {premise} — unverified] — insert cheap
  verification step before committing to the expensive steps that follow it
Action D — depends on: B, C — [...]

Critical path: A → B → D (or A → C → D)
Parallel opportunity: B and C once A is done
```

Don't let an unverified assumption sit silently inside an otherwise-confident-looking graph — a flagged node changes what "next action" should be (verify the premise cheaply) versus an unflagged one (execute the expensive step directly).

### 4. Identify Each Line's Critical Path

For each line, call out the single longest dependency chain that, if delayed, delays that line's outcome the most. Keep each node a short label — arrow-chain it on one line if the labels are short enough to fit; switch to one bullet per step rather than let the line wrap:

```
CRITICAL PATH: [A] → [B] → [D]
Estimated duration: [...]
Status: on_schedule | at_risk | blocked | done
Blocker (if any): [what's blocking, what resolves it]
```

```
CRITICAL PATH:
- [short label A]
- [short label B]
- [short label D]
Estimated duration: [...]
Status: on_schedule | at_risk | blocked | done
Blocker (if any): [what's blocking, what resolves it]
```

