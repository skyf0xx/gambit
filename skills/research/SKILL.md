---
name: research
description: Use when a decision depends on something you don't currently know and can't safely assume — a fact, a person, an organisation, a rule, a precedent, or what has happened recently. Runs live web research, date-stamps every claim, separates verified-current from background, rates sources, and reports what it could not confirm. Supersedes intel for anything time-sensitive.
---

# Skill: research

**Trigger**: A decision is waiting on something you don't know. A fact, a person, an
organisation, a rule, a precedent, or — most often — what has actually happened
recently. Also use when `systems` or `threat` flags a gap, or when a plan rests on
something that was true once but may not be true now.

**Purpose**: Find out, for real, right now. Not from memory — from live sources, dated
and rated. The failure mode this skill exists to prevent is a confident answer built
on stale training data, presented as current fact. A plan built on last year's
situation is worse than no plan, because it feels informed.

---

## Voice & Tone

Analyst discipline. Sourcing is explicit, dates are mandatory, confidence is stated
rather than implied.

You never fill a gap with fluent prose. If you could not confirm something, say "could
not confirm" and say what would confirm it. An honest "unknown" is a usable input to a
decision; a confident guess is a trap.

Distinguish three things at all times, and never let one drift into another:
what you **verified this session**, what you're carrying as **background** that you did
not re-check, and what you **could not establish**.

---

## Execution Sequence

### 1. Sharpen the Question

Before searching, get the question to something answerable. Vague questions return
vague results and the user ends up no better off.

- "What's the political landscape" → not researchable.
- "Which federal seats changed hands by under 3% at the last election, and what is
  each sitting member's stated position on immigration intake" → researchable.

If the user's question is broad, split it into 2-4 specific sub-questions and show
them:

```
YOUR QUESTION: [as asked]

I'll research it as:
  1. [specific sub-question]
  2. [specific sub-question]
  3. [specific sub-question]

Anything to add or drop before I start?
```

Wait for a response if the reframing is substantial. If it's a minor tightening,
state it in one line and proceed — don't create a checkpoint over nothing.

Once the sub-questions are confirmed, steps 2-6 run once per sub-question. Where the
executing agent can run independent sub-tasks concurrently, research each confirmed
sub-question in parallel — they don't depend on each other's findings — and converge for
a single combined Report (step 7). A single-question research task just runs steps 2-6
once.

### 2. Establish the As-Of Date

State today's date at the top of the work. Every claim about current state is
implicitly "as of" this date, and anything that could change needs an explicit
publication or observation date attached.

### 3. Research Live

Use the web search and page-fetch tools available in the running environment.

Rules:

- **Search before answering.** Even when you believe you know. Especially when you
  believe you know — that belief is exactly what goes stale.
- **Prefer primary sources.** The agency's own page over a news summary of it. The
  register, the filing, the official announcement, the transcript.
- **Get the date on every source.** Undated is a downgrade in reliability, not a
  neutral fact.
- **Follow up on thin results.** One search is a starting point, not an answer. If the
  first pass returns little, vary the phrasing, try the primary institution directly,
  and search for the counter-position.
- **Actively seek the contradicting view.** Search for what disagrees with the emerging
  answer. If everything agrees, note that as either genuine consensus or narrow
  sourcing — say which.

### 4. Rate Sources (Admiralty Scale)

For each source:

**Reliability** (the source's track record):
A completely reliable · B usually reliable · C fairly reliable · D not usually reliable
· F cannot be judged

**Credibility** (how well *this specific claim* is corroborated):
1 confirmed independently · 2 probably true · 3 possibly true · 4 doubtful · 5 improbable

A source with no track record defaults to F until there's reason to think otherwise.
Combined as e.g. `B/2`.

### 5. Report

```
RESEARCH: [the question]
AS OF: [today's date]

BOTTOM LINE
  [2-3 sentences. What the evidence actually shows, and what it means for the decision
   waiting on it.]

CURRENT STATE — verified this session
  [claim] — [source, rating] — published/observed [date]
  [claim] — [source, rating] — published/observed [date]

BACKGROUND — stable, not re-verified this session
  [claim] — [source, rating]

COULD NOT CONFIRM
  [what] — [why: no source found | sources conflict | behind paywall | not public]
  → What would settle it: [specific action, query, person to ask, or record to check]

KEY JUDGMENTS
  1. [judgment] — Confidence: high | moderate | low
  2. ...

OVERALL CONFIDENCE: high | moderate | low
```

**Deriving confidence**: `high` = multiple independent A/B sources, credibility 1-2,
recent, mutually reinforcing. `moderate` = single reliable source, or mixed credibility,
or the good sources are older than the question's volatility allows. `low` = single weak
source, credibility 3-5, real contradiction between sources, or the answer rests mostly
on inference.

Never round confidence upward because the user needs an answer. The whole value of the
rating is that it's honest when it's inconvenient.

### 6. Volatility Check

Some answers rot faster than others. Flag it:

```
SHELF LIFE: [stable | check again in ~[timeframe] | changing now — re-verify before acting]
```

A stated law is usually stable. A parliamentary numbers count, a media narrative, a
person's public position, or an ongoing event is not.

### 7. Hand Back

Close by connecting the research to the decision it was serving, and offer the next
move:

```
This bears on: [the decision or plan step that was waiting]

Next: [one of —]
  - Enough to decide → run `decide`
  - Changes the picture → re-run `strategy` or `systems`
  - Still a gap → [the specific follow-up question]
```

### 8. Update GOAL.md

Only if the finding is load-bearing for the current plan or focus. Add one line to the
log: date, the question, overall confidence, and the one-sentence bottom line.

Do not paste research transcripts into `GOAL.md`. The file holds current state, not an
archive — the full finding lives in the conversation.
