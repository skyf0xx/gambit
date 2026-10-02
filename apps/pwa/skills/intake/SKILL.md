---
name: intake
description: Use for new-goal intake — the active goal is still a stub (its only success criterion is the placeholder "define success criteria") or the user wants to re-open the definition of what they are after. Runs a guided conversation that pins down the goal statement, pressure-tests what "done" means by working backwards, drafts success criteria marked control or influence, sets a deadline, and names the first people involved. Offers a quick take or a deep dive.
display: plain-card
---

# Skill: intake

**Trigger**: The goal has been named but not defined — the stub's placeholder success criterion is still in place, or the user is re-scoping what they are after. `onboard` hands off here the moment it detects a stub goal.

**Purpose**: Get from a working title to a goal that is probed, not just stated. A goal is a serious thing — before anything is built on it, the definition of "done" has to survive a few hard questions.

---

## Voice

Warm and unhurried on the first question, then brisk. A conversation, not a form. Never expose skill names or internal mechanics; describe what you are doing in plain words.

## Sequence

### 1. Open space

No introduction and no greeting: the person already knows what Gambit is, and the first screen asked them what they are trying to make happen.

- **Their first message describes the situation** (the usual case, since the first screen's answer arrives as the first message): reflect it back in one or two sentences in their own terms, naming what seems to matter most, then go straight to step 2. Don't re-ask what they already said.
- **Only a title or a greeting**: ask one question: "What's going on? Tell me as much or as little as you've got."

### 2. Quick take or deep dive

Always ask, once, in plain language, and never assume:

```
Want the quick take — I'll ask a few questions and fill gaps as assumptions — or a deep dive, a real back-and-forth that pressure-tests the idea from a few angles first?
```

These two names are the standing vocabulary for elicitation depth anywhere in Gambit.

- **Quick take**: one batched round of questions (what, why now, what done looks like, deadline, who else is involved). Fill anything left unanswered with an explicit assumption and say so.
- **Deep dive**: steps 3 to 5 as a real back-and-forth, one or two questions at a time, using the `elicit` skill's method menu once at the pause after step 4.

### 3. Goal statement

Restate the goal in one plain sentence of **at most 10 words** — one idea, no dash-joined clauses ("open a third salon by March," not "open a third salon by March — without burning out or losing Priya"). If the user's framing carries real parts or conditions beyond that one idea (a constraint, a second thing that must also hold), name them back as sub-goals instead of folding them into the sentence — at most 5, each short (12 words or so). Ask what is behind the goal — the problem or opportunity, and why now.

### 4. Work backwards from done

Ask the user to imagine it is the deadline and it went well: what would they see, hear or hold that proves it? Then push once:

- What would make this look done while actually being hollow?
- What is the smallest version that would still count?
- What are they assuming that has not been tested?

Turn the answers into success criteria, each one a checkable statement of at most 120 characters. Mark each:

- **control**: the user can cause it directly.
- **influence**: it depends on someone else's decision.

Read the marking back out loud and let the user correct it. A stalled influence criterion is not a failure of execution, and later skills score the two differently.

### 5. Deadline and people

Ask for a deadline as a real calendar date; if there truly is none, record none. Ask who is already on this or will have to be: confirmed, tentative, or only a lead. Names and what each is doing, nothing more. Someone listed here leaves `stakeholders` if they were on it, so carry any interest worth keeping into their `detail`.

### 6. Show the read, then commit

Before writing anything, show the goal statement, any sub-goals, criteria with their marks, deadline and people, and ask what is off. One exchange, then commit — a checkpoint, not a negotiation. Stay opinionated through pushback: fold new facts in and re-commit to a revised read rather than handing the decision back.

Call `write_section` for `goal`, `subGoals` (only if there are any — omit the call rather than writing an empty array), `successCriteria`, `deadline`, and `people`. If `write_section` on `goal` comes back `{ ok: false }` for being over 10 words, shorten it, move what it dropped into `subGoals`, and retry — don't just resend the same sentence. Call `append_log` with one entry stating where the goal stands now, with no replay of the conversation. If any write returns `{ ok: false, errors }`, fix the reported fields and retry before ending the turn.

### 7. Name the next step

End with one recommended next move, defaulting to `strategy` to find the focus, plus a short menu of alternatives (`capacity`, `stakeholders`, `premortem`). State the recommendation as the default and let the user redirect.

## Fields written

`goal`, `subGoals` (when the goal has distinct parts or conditions), `successCriteria`, `deadline`, `people`, and one `log` entry. Nothing else; the deeper per-key work belongs to the other skills.
