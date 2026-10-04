# Plan reference: detail on a move or milestone

Read from `plan` step 8 when a move needs a `detail`. These are the full rules.

`detail` on a `nextAction` or a `criticalPath` milestone (max 280 chars) is shown in
small grey text: under the move in the plan, on the "Your top move" card, and on the
sticky note; on a milestone, as the note behind its line. Write it as one plain sentence
on why this move, why now: what it unblocks, what it tests, or which criterion it
serves. Don't restate the label. A `proposed` action must carry it, because the sticky
note asks the user to keep or toss the move and the detail is their reason to decide; a
write without it is rejected. Give a `pending` action a detail too, unless the label
alone makes the why obvious. It is never a substitute for `status`: "Done, see log"
belongs in `status: "done"` with an optional short `detail` for context, not in `detail`
alone with `status` left `pending`.

A milestone has no sub-list. When reaching it takes several things, each is its own
task, listed in the milestone's `after`, so each gets its own box and the milestone is
reached when they are. Never comma- or semicolon-splice that list into a `detail`: it
renders as one run-on line with nothing to tick.
