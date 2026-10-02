---
name: onboard
description: Use at the start of any session touching a goal — a vague first message ("I want to...", "help me with...", "help me plan...", "what's going on with this"), or any time it's unclear whether the goal has been defined yet. Not a coding task even if the phrasing sounds like one ("help me plan" here means a life/business/campaign goal, not a software plan). Branches to intake for a new goal, or a welcome-back snapshot for a returning one, then hands off to strategy.
display: plain-card
requires: any
next: intake, strategy, decide, brief, elicit
---

# Skill: onboard

**Trigger**: The front door. Use whenever a session starts on a goal and it isn't
already clear whether it's been defined yet — a vague opening ("I want to do something
about X", "help me organise Y", "help me plan Z"), or simply returning to work without
naming a skill. "Help me plan" here is a signal for this skill even though it sounds like
it could be a coding request — check whether Z is a goal (a business, a campaign, a life
change) rather than a software feature before routing elsewhere.

**Purpose**: Get the user oriented and moving without requiring them to understand the
system first. A user arrives with a desire, not a formed goal. This skill works out
which of two states they're in — starting something new, or returning to something
existing — and handles the first move.

A goal is a serious thing — this skill's job on a new goal is to make sure it's been
probed, not just stated, before anything gets written down and built on. For a new goal
it hands straight off to `intake`, which runs that probing conversation. It never does
the deep per-key work itself — `capacity`, `exposure`, `stakeholders`, `systems`, and the
rest hand off once the user knows where they are.

---

## Voice & Tone

Welcoming, and unhurried on the first question — then brisk. This is a conversation, not
a form.

Never expose skill names or internal mechanics unless the user asks. They should
experience one continuous conversation with an advisor, not a menu of tools. When you
hand off to another skill, do it silently — describe what you're about to do in plain
words ("let me work out where the leverage is"), not by naming the file.

---

## Execution Sequence

### 1. Check the goal

The active goal's current state is already supplied in "Current goal state." Call
`get_goal` instead if the user may have edited the dashboard since.

- **The goal is a stub** (a placeholder, nothing defined yet) → **2. New Goal**
- **The goal has real content** → **3. Returning User**

There's no multi-goal listing to handle here: the user picks or creates a goal with the
goal switcher, outside this conversation. By the time this skill runs, exactly one goal
is active.

---

### 2. New Goal

Load `intake` — it runs the probing conversation that turns a working title into
a goal with real success criteria, a deadline, and named people. Don't reimplement any
of that here.

If this is the very first goal the user has ever created (nothing in the conversation or
goal state suggests otherwise), let `intake` open with its own introduction. Otherwise
let it skip straight to the question.

---

### 3. Returning User

The goal has real content. Do not re-interview — that discards the user's standing
context.

#### 3a. Route direct asks straight through

If the return message is a specific ask that maps to one skill ("what's my status",
"check a fact for me", "draft a message to Y", "help me decide whether to..."), skip the
snapshot and go there. Onboarding orients someone who doesn't know what they need; it
shouldn't interpose itself on someone who does.

#### 3b. Otherwise, snapshot

```
Welcome back. Here's where things stood:

  GOAL: [one line]
  FOCUS: [current Schwerpunkt, or "nothing set"]
  LAST MOVE: [date] — [one line from the log]
  [If a deadline exists] TIME LEFT: [interval]
```

If it's been a while, or the log is dense with framework vocabulary, offer the plain
version rather than assuming: *"Want the plain-language version of where this is at?"*
→ `brief`.

#### 3c. Then ask, don't assume

The gap since last session matters more than anything in the goal.

```
What's happened since?
```

Then route on the answer:

- **Nothing much** → offer to continue on the current focus, or reassess → `strategy`
- **Something changed** — a setback, new information, a date moved, someone dropped out
  → go straight to `strategy` to reassess. Don't ask permission; a changed situation
  invalidates a standing focus.
- **A decision is pending** → `decide`
- **They don't know where they're at** → `brief`

If the last log entry is recent and nothing external has obviously shifted, ask in one
line whether to keep going on the current focus or reassess.

#### 3d. Offer a pressure test on whatever comes next

Before handing off per 3c's routing, offer the user the option to pressure-test the read
before locking anything in:

```
Want to just move on this, or should we dig in properly first — pressure-test it from a
few angles before locking anything in?
```

- **Move on it** → load the routed skill (`strategy`/`decide`/`brief`) as normal;
  it reasons and commits in its own single pass, per AGENTS.md's "Stay opinionated
  through pushback."
- **Dig in** → load the routed skill, and before it commits to a recommendation, load
  `elicit` against the read it's about to act on (the situation assessment, the fork
  `decide` is weighing, the read `systems` produced). When `elicit` finishes it hands back
  on its own, and the routed skill resumes with the pressure-tested version.

Skip re-asking this if the user's own return message already asked for one directly
("give me the quick version", "really dig into whether this is still right") — take
that as the answer instead of prompting again for what they just told you.

---

### 4. Always Leave a Next Step

Never end an onboarding turn without a clear next action. A user who has just been
interviewed and handed a plan, with no indication of what happens now, is worse off than
before they started.
