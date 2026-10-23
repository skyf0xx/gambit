# Plan reference: quick status updates

Read from `plan` Mode 0 after a flip, when the state block lists overdue moves, or the user reports a
message sent, a reply, an escalation come due or a fork to check. These are the full
rules.

**Overdue moves.** When the state block lists moves past their `when` date, don't replan. Ask about each in one line: "[move], due [date]. Done, a new date, or drop it?" Done and dropped go through `set_status`. A new date is a `plan` write that changes only that move's `when` (YYYY-MM-DD). With three or more overdue on one line, or one move slipped twice, the plan is stale: say so and use Mode 1.

**Messages, escalations and forks.** The same quick path covers linked tasks:

- "I sent the letter": `set_status` that task to `done`. Its `doneOn` is the day it went out, and starts the wait of any escalation of it.
- "They replied": write the task's `replied` (today) and `reply` (what they said) in a `plan` write. A reply stops its escalations from coming due. Decide with the user whether it settles the ask: if it does, drop the escalations; if it falls short, keep them and say which comes next. A reply that meets the ask ends the climb, however high it got.
- The state block lists an escalation come due: name it and who it goes to, and offer `comms` to draft it. Once the user sends it, `set_status` it `done`.
- The state block lists a fork to check: ask whether its event happened. If it did, set `if.happened: true` and the task is a live move; if not, drop the task.

**After a flip.** Don't leave a finished step's story in `detail` ("Done, see log") while
`status` stays `pending`; the page reads `status`. If the flipped action was the focus
line's last `pending` one, the "Your top move" card reads "nothing due yet"; say so and
offer a replan of that line or `strategy`.
