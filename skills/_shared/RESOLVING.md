# Resolving GOAL.json

Every skill in this repo reads and writes "`GOAL.json`" as its state file. Which
actual file that means is decided once, by this rule, in precedence order.

**Resolve it by running `gambit path`, not by hand.** It applies every case
below and prints the one file this rule would choose, or a nonzero exit with
a message telling you what to do next (create a goal, or pick one of several
listed). Do not reimplement this rule with raw file checks — don't guess
`$GAMBIT_HOME`/`$XDG_DATA_HOME` fallback order, don't guess a goal's slug
from its name, don't `ls`/`find` the store directory looking for a match.
Any of those can silently land on the wrong goal (or "no goal" when one
exists) in exactly the cases this rule exists to get right. If `gambit` isn't
on PATH, fall back to reading the precedence rule below by hand — but treat
that as the exception, not the default.

1. **`GOAL.json` in the current working directory** → use it. A repo-local goal
   always wins. This is what makes existing per-project installs keep working
   unchanged after the global store exists.
2. **Otherwise, the goal named by `~/.gambit/active`** → read
   `~/.gambit/goals/<slug>/GOAL.json`. (`~/.gambit` is `$GAMBIT_HOME` or
   `$XDG_DATA_HOME/gambit` if either is set.)
3. **Otherwise, if exactly one goal exists in the store** → use it, and set it
   active (write its slug to `~/.gambit/active`) so the next session resolves
   without asking.
4. **Otherwise, if no goals exist anywhere** → hand off to `onboard` for
   first-contact intake. This is the only case with no `GOAL.json` to read yet.
5. **Otherwise (several goals exist, none active)** → hand off to `onboard`,
   which lists them and asks which one. This is the only case in the whole
   rule that asks the user anything — every other case resolves silently.

A skill that finds no file after applying this rule follows its own
not-found behavior (most defer to `onboard`; `status` and `brief` say so and
point there).

Skills should read and write "the resolved file," not restate this
precedence table — it exists once, here, so it stays in sync as the store
evolves.
