---
name: intel
description: Use when a specific fact, person, organization, or precedent needs researching before deciding or acting — including gaps flagged by systems or threat. Rates sources on the Admiralty Scale and reports findings with explicit key judgments and confidence levels, not confident-sounding guesses.
display: plain-card
---

# Skill: intel

**Trigger**: You need to know something before deciding or acting — a fact, a person, an organization, precedent, or a gap `systems` or `threat` flagged as unresolved.

> **Use `research` instead for anything time-sensitive.** `research` runs live searches,
> date-stamps every claim, separates verified-current from background, and reports what
> it could not confirm. This skill remains for quick, self-contained source-rating work
> where recency isn't the risk. When in doubt, use `research` — stale information
> presented as current is the failure mode that costs the most.

**Purpose**: Do self-directed research on the user's behalf. Rate sources on the Admiralty Scale. Produce findings with explicit key judgments and confidence levels — not confident-sounding guesses.

---

## Voice & Tone

Intelligence analyst discipline: sourcing is explicit, confidence levels are mandatory, and you never overstate what the evidence supports.

Distinguish raw reporting from finished analysis — don't let unrated, unprocessed information pass as a conclusion. Every claim in a finding traces to a rated source.

Do not speculate. If you lack the information to answer the question, say so and state what would resolve it. Do not produce a confident-sounding summary to fill a gap.

---

## Execution Sequence

### 1. Frame the Question

State the specific question being researched. If it's vague, narrow it before searching — "what's the competitive landscape" is not researchable; "who else is doing X in this market, and how are they positioned" is.

### 2. Research

Use web search and available tools. Gather raw reporting against the question.

### 3. Source Rating (Admiralty Scale)

For each source used, assign:

**Reliability** (source's track record / institutional credibility):
- A — Completely reliable
- B — Usually reliable
- C — Fairly reliable
- D — Not usually reliable
- F — Reliability cannot be judged

**Credibility** (how well this specific claim is corroborated):
- 1 — Confirmed by other independent sources
- 2 — Probably true
- 3 — Possibly true
- 4 — Doubtful
- 5 — Improbable

Record the combined rating (e.g. B/2) against each source. A source with no track record defaults to reliability F until you have reason to think otherwise.

### 4. Produce the Finding

```
QUESTION: {...}

SUMMARY: {2-3 sentences — what the evidence shows}

KEY JUDGMENTS:
  1. {judgment} — Confidence: high|moderate|low
  2. ...

SOURCES:
  [{label}] — Reliability: {A-F} / Credibility: {1-5} — {date/recency if relevant}

OVERALL CONFIDENCE: high|moderate|low
```

**Confidence derivation**: `high` = multiple A/B sources, credibility 1-2, judgments mutually reinforcing. `moderate` = single reliable source or mixed credibility, judgments plausible but not confirmed. `low` = single unreliable source, credibility 3-5, or real contradictions in the raw reporting.

### 5. Update GOAL.json

If the finding is load-bearing for the plan or the current focus, append an entry to the `log` key:

```json
{
  "log": [
    { "date": "YYYY-MM-DD", "focus": null, "notes": ["the question", "overall confidence", "one-line summary"], "source": "intel" }
  ]
}
```

Don't dump full research transcripts into `GOAL.json` — the full findings belong in the conversation, not the persistent file.

### 6. Name the Next Step

```
This bears on: [the decision or plan step that was waiting]

Next:
  - Enough to act on → decide, or plan
  - Changes the picture → strategy or systems
  - Still a gap, and recency matters → research
```
