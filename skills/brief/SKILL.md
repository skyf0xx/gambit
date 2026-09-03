---
name: brief
description: Use when the user wants to understand where things stand in plain language rather than in framework terms — returning after a gap, feeling lost, showing the situation to someone else, or asking "so what does all this actually mean". Translates GOAL.json into ordinary prose, explains any jargon it contains, and names the one thing to do next. Read-only.
display: plain-card
---

# Skill: brief

**Trigger**: The user wants to know where things stand, in plain terms. Returning after a
break, feeling lost in the analysis, needing to explain the situation to somebody else,
or asking some version of "so what does all this actually mean".

Also use when `GOAL.json` has accumulated framework vocabulary — Schwerpunkt, CoG, CV,
culminating point — and the user shouldn't have to hold a glossary to read their own
file.

**Purpose**: Translate. `status` gives a structured readout in the system's own
vocabulary; this gives the same picture the way you'd explain it to a smart friend who
has no background in any of it.

Read-only. Never writes to `GOAL.json`.

---

## Voice & Tone

Plain, direct, unhurried. Short sentences. No framework terms unless you immediately
say what they mean in ordinary words.

Not dumbed down — a competent adult who happens not to know strategic planning
vocabulary. Respect the intelligence, drop the jargon.

Honest about trouble. If things are stalled, say stalled — translating into accessible
language must never soften a hard finding. That's the one way this skill does real
damage.

---

## Execution Sequence

### 1. Load Context

Resolve `GOAL.json` per `skills/_shared/RESOLVING.md` and read it in full.

If resolution finds no goal: say there's nothing set up yet, and point to `onboard` to
start (it also handles several goals with none active). Stop there.

Per AGENTS.md's "Opening the visualizer," open the live diagram view now if this is the
first Gambit skill run this session (`nohup gambit visualize >/dev/null 2>&1 &`, detached
and silent, mentioned once in passing) — don't relaunch it on a later call within the
same session.

### 2. Write the Brief

Prose, not a template. If more than one goal exists in the store, open by naming which
one this brief is for — one plain clause is enough, not a heading. Roughly this shape,
in this order, adapted to what's actually in the file:

**What you're trying to do** — the goal, in one or two sentences, as a person would say
it out loud.

**How you'll know it worked** — the success criteria, restated concretely. If a
criterion isn't something the user can directly cause — a government decision, another
organisation's choice — say so here. That's not a flaw, but it changes what progress
looks like, and it should be visible.

**Where things actually stand** — what's moved, what hasn't. Pull from the log. Be
specific about dates. If nothing has moved in a while, say that.

**What you're focused on right now, and why** — the current Schwerpunkt in plain terms.
Say the word once, in parentheses, if it's in the file — the user will see it there and
should know what it means.

**What could go wrong** — the top one or two risks from the `riskNotes` key or
the `systemsNotes` key, translated. Not the whole list. The ones that would actually hurt.

**Who's involved** — if the `people` key is non-empty: who's committed, who's not confirmed yet,
and who the effort would be in trouble without.

**The clock** — deadline, time remaining, and a straight answer on whether the current
pace fits. Yes, no, or genuinely unclear.

### 3. Translate the Jargon

Whenever a framework term appears in `GOAL.json`, define it inline the first time, in one
clause:

- **Schwerpunkt** — the one thing worth concentrating on right now
- **Centre of Gravity (CoG)** — what a side's strength actually depends on
- **Critical Vulnerability (CV)** — the weak point that, if it gives, takes the strength
  with it
- **Culminating point** — the moment past which more effort starts producing less
- **Line of effort (LOE)** — one ongoing workstream running toward the goal
- **Posture** — how hard you're currently pushing, and how much risk that carries
- **PMESII / ASCOPE** — checklists for reading an environment without missing a dimension
- **Admiralty rating (e.g. B/2)** — how trustworthy a source is, and how well-corroborated
  the specific claim is

Define only what's actually present. Don't teach the glossary.

### 4. Name the Next Thing

End with one concrete next action and a short menu. Not a list of everything possible —
the single most useful move, then the alternatives:

```
The most useful thing you could do next: [one specific action]

If you'd rather:
  - Rethink what to focus on → strategy
  - Turn this into steps → plan
  - Find out something you're unsure about → research
  - Make a call you've been putting off → decide
  - Check whether this is really working → eval
```

### 5. Offer to Go Deeper

Close by inviting the question the brief probably raised:

```
Anything in there you want the longer version of?
```
