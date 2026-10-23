# Plan reference: milestones

Read from `plan` step 4 before writing `criticalPath`. These are the full rules.

Call out the one longest dependency chain per line, the one that delays the line's
outcome most if it slips. Its nodes are the line's milestones: points the line reaches,
not things to do ("Clean-up date set", not "Get a clean-up date"). Keep each a short
label. A milestone comes after the tasks that reach it: give it an `id` and list those
tasks in its `after`; the page rules a line across after them with the milestone's name
on it, the way a notebook rules off a section. It has no status and no sub-items: it is reached once every
task it lists is done or dropped (at least one done), and un-reached if one is ticked
back. Detail it needs goes in `detail`; work toward it goes in its tasks. A task that
can only start once a milestone is reached lists the milestone's `id` in its own
`after`. Every milestone lists at least one task, or the write is refused: a milestone
with nothing leading to it is a wish, not a point on the path. If every task toward one
was dropped, give it a new route or take it out. Every live task should lead to a
milestone; one that leads to none is shown before the milestone the line is heading to.
Give the duration estimate, the
line's status (`on_schedule`, `at_risk`, `blocked`, `done`) and any blocker.
