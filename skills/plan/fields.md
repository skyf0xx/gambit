# Plan reference: detail and items on a step

Read from `plan` step 8 when a step carries a list of items, or a move needs a
`detail`. These are the full rules.

`detail` on a `criticalPath` step or a `nextAction` (max 280 chars) is shown in small
grey text right under the move: in the plan, on the "Your top move" card, and on the
sticky note. Write it as one plain sentence on why this move, why now: what it unblocks,
what it tests, or which criterion it serves. Don't restate the label. A `proposed` action
must carry it, because the sticky note asks the user to keep or toss the move and the
detail is their reason to decide; a write without it is rejected. Give a `pending` action
or step a detail too, unless the label alone makes the why obvious. It is never a
substitute for `status` — "Done — see log" belongs in `status: "done"` with an optional
short `detail` for context, not in `detail` alone with `status` left `pending`.

`items` on a `criticalPath` step (array of `{label, status}` objects, max 10 entries,
optional) is a real enumerable sub-list the step needs to track — e.g. a step drafting
one angle per subreddit, one line per sub. `label` is `shortLabel` (40-char cap); `status`
is one of `pending` (default), `done`, `dropped` — the same enum as a step's own `status`,
tracked per item rather than only at the parent step. Use `items` whenever the step's
content is actually a list of short items, not prose — the visual layer renders `items`
as its own bulleted list with per-item done/dropped icons, where packing the same content
into `detail` renders as one unbroken run-on line with no way to mark individual items
done. Never comma- or semicolon-splice a list into `detail` just because `items` feels
like more structure than the step needs — if there's more than one item to track, it's a
list and belongs in `items`.

A step's own `status` should agree with its `items`: don't mark the parent step `done`
while any of its items are still `pending` — mark items done individually as they
complete, and only flip the step to `done` once every item is `done` or `dropped`.
Write validation warns (not a hard failure) when a step's items are all done but its own
`status` still lags behind — treat that warning as a prompt to update the step, not
something to ignore.

