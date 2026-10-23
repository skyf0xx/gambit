# Plan reference: linking the moves

Read from `plan` step 6a before writing any `after`, escalation or fork. These are the
full rules.

A plan isn't a list of chores: moves wait on each other, some only happen if a message
goes unanswered, and some only if something occurs. Say that with links, never in the
wording of a move. Each move stays a plain todo ("Send the complaint letter"), and the
page draws the links under it. Give a task an `id` (short: `letter`, `ombudsman`) when
another task points at it.

**After.** `after: [ids]` holds a move until the tasks it waits on are done. "Print the
flyers" after "take the photos", not "Print the flyers once the photos are in".

**Escalations**, when the line needs someone else to act and they can ignore the user: a
council, a landlord, a supplier, an employer. A message is a task with `to`, a name from
`people` or `stakeholders`, verbatim, never the user; a name not mapped is refused, so
find who actually holds the authority first (a tunnel may belong to the rail operator,
not the council) and load `stakeholders` if they aren't there. An escalation is a message
with `if: {noReply: <id>, days}`: it comes due once the message it follows went out and
got no reply in `days`. Each carries a `level`, climbing in three steps (Ury, Brett &
Goldberg) and never back down:

1. `interests`: ask whoever can fix it, directly. Cheap, and keeps the relationship.
2. `rights`: formal channels with authority behind them: a complaint with a reference
   number, the person above, an ombudsman, a regulator, an elected member.
3. `power`: pressure from outside: press, petition, public posts. Costly, and burns the
   relationship.

Set `days` long enough for a real reply (14 for a formal body is usual), short enough
that the deadline survives the whole climb. Add the waits up and check them against
`deadline`. What a message brings forward (the reference number, copies of every
letter, photos) goes in its `detail`. Keep the way back open: each message says what
would settle it, so the other side can stop the climb by meeting the ask. A `power` step
puts the user's name in public, so `exposure` runs before it goes out.

**Forks**, for any goal: a move made only if something happens. `if: {event, by?}`: the
event is a fact outside the user's control, checkable on the `by` date, in one short
phrase of 8 words or fewer with no leading "if" ("under 10 sign-ups", "rain over 50% on
Friday", "council offers a one-off clean"). The move is one the user would not make
otherwise. Test it: if the event never happened, would they still do this move? If yes,
it forks nothing. "Under five signed → send the follow-up anyway" fails, and a fork
whose move already sits in the plan unconditionally, or says "anyway", "still" or "keep
chasing", is refused. The page shows a fork as "if [event] / then [move]", so the move
never restates its condition: "Take a floor job", not "Take a floor job if nothing lands
by then". The event names its own date or leaves it to `by`: "no staff offer by
mid-December", never "no live staff role by then". One fork per question on a line: two
forks waiting on something not happening ("no offer by December", "no role yet") are
refused; keep the one with the earlier date. The user's own routine ("take the weekly photo") is a plain dated
move, never a fork; the due list flags it when it slips.

Skip escalations when nobody else's decision is involved: a picnic or a running habit
gets a fork, not escalations.

The focus line needs at least one conditional task (an escalation or a fork); a plan
without one is refused. **When nothing on a line forks**, don't invent one to satisfy
the rule. Every plan has one honest fork: the date by which, if the line isn't working,
the approach changes. Write it with a measurable event and a move that sends it back to
`strategy`: event "no clean-up date set", `by` the date, action "Rethink the approach". A
worry about being sidetracked ("they offer a one-off clean to make us stop") is a risk,
not a fork: it belongs to `threat`, or to a walk-away line in `negotiate`.

Write each move and event in plain words you'd say out loud, per GUIDED.md: verbs kept,
no shorthand coined in the conversation, a person's role with their name, and an event
as something that happened. "the council hasn't asked Sydney Trains to act", not
"council's reply names no chase to rail".
