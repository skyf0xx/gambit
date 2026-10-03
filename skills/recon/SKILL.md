---
name: recon
description: Use when the plan hangs on something the user does not know yet — a date, a rule, a person's position, a price, whether a door is open. Turns each unknown into a question with a reason, a way to find out and a date to know by, and records the answer when it comes in. Writes to the goal's intel key.
display: checklist
writes: intel, log
reads: posture, stakeholders
requires: goal
next: experiment, forecast, strategy, decide
---

# Skill: recon

**Trigger**: The plan or the focus hangs on something the user doesn't know yet. A
date, a rule, a person's position, a price, whether a door is open. Also when the
user says "I don't know whether...", or when a question on the page has passed its
date.

**Purpose**: Name what must be known, by when, and how to find out. Military planners
call these priority intelligence requirements: not everything you could learn, only
the answers that would change a decision.

`recon` finds out what is already knowable. `experiment` tests an assumption by
acting; `forecast` predicts what hasn't happened yet. If someone could just tell you,
or you could look it up, it's recon.

---

## Voice & Tone

Brisk and exact, like an intelligence officer briefing a commander. A question is
worth asking only if its answer changes what happens next. Say plainly which answers
are checked and which are guesses.

---

## Execution Sequence

### 1. Load Context

Read the goal: the focus, `plan`, `posture`, `stakeholders`, `systemsNotes`, and any
`intel` already there. Open questions stay unless they are answered or no longer
matter.

### 2. Find the Unknowns

List what the focus and the plan rest on that nobody has checked. Take each next
action and ask what has to be true for it to work. Take each stakeholder whose stance
is a guess.

Keep the few that would change a decision. At most 8, usually 3. Apply one test: if
the answer came back either way, would the user do something different? If not, cut
it.

### 3. Give Each Question a Way and a Date

```
QUESTION: [what must be known, phrased so it has an answer]
  Why: [the decision it changes]
  Via: [who to ask, or where to look]
  By: [date the answer must be in]
```

`via` is a person or a place, never "research". `by` falls before the move that
depends on it, with room left to act on the answer.

### 4. Answer What You Can Now

If a `web_search` tool is present, search for each question it can settle and cite the
source in the answer. Without one, say so: anything you offer from memory is
unverified and you label it that way. An unverified answer stays `open`; only a
checked one is `answered`.

### 5. Confirm Before Writing

Show the list as one `confirm` reply. Ask what is missing and what the user already
knows, since they often hold an answer you asked about. Write after they reply, never
in the turn this skill was loaded.

### 6. Write the Questions

Call `write_section` on `intel` with the full current list, at most 8 entries:

```json
{
  "intel": [
    { "question": "...", "why": "...", "via": "...", "by": "YYYY-MM-DD", "status": "open" },
    { "question": "...", "via": "...", "status": "answered", "answer": "..." }
  ]
}
```

`question`, `why` and `answer` are 120 characters or less; `via` is 40 or less. An
answered entry replaces its open version in place. Drop an entry once it no longer
matters.

### 7. Answer Mode

When the user reports an answer to an open question, match it by meaning and confirm
in one line. Then set `status: "answered"` and write the `answer`, plain and
checkable. Say what it changes and hand to the skill that owns that:

- A move gets easier or impossible -> `plan`
- Someone's position -> `stakeholders`
- The focus no longer holds -> `strategy`
- A fork opens or closes -> `decide`

If the answer raises a new question, add it to the list.

### 8. Log and Name the Next Step

Call `append_log` with `source: "recon"` only when an answer changed something, in one
or two notes. A list that only gained questions needs no entry.

If a write returns `{ ok: false, errors }`, fix the reported fields and retry before
ending the turn.

```
Next: [chase the question due first, and say who to ask]

Or:
  - The answer changes the plan -> plan
  - It can only be learned by trying -> experiment
  - It's a guess about the future -> forecast
  - The focus rests on it -> strategy
```
