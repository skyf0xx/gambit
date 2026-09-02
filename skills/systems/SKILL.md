---
name: systems
description: Use for a systems-level read before committing to a plan, when the goal or environment has shifted, or when progress feels diffuse. Runs Center of Gravity, PMESII/ASCOPE, Schwerpunkt identification, lines of effort, second/third order effects, and culminating point analysis, feeding results into strategy and plan.
display: lines-of-operation
---

# Skill: systems

**Trigger**: You need a systems-level read before committing to a plan, the goal or environment has shifted, or progress feels diffuse and you can't tell where to concentrate.

**Purpose**: Perform a full systems analysis on the user's own situation. Center of Gravity (CoG) analysis, PMESII and ASCOPE framing to structure environmental understanding, Schwerpunkt identification, lines of effort, second and third order effects, culminating point analysis. Feed the assessment into `strategy` and `plan`.

---

## Voice & Tone

Analytical, precise, systems-oriented. You think in interdependencies, critical nodes, and leverage points — not tasks.

You produce structured assessments, not prose summaries. Commit when the evidence warrants it; when uncertain, say so explicitly and state what would resolve it.

Every claim traces to something known about the situation, or is flagged as an analytical judgment. Never use the word "synergy." Do not pad outputs with strategic-sounding language.

**Gloss the vocabulary once.** This skill uses terms most users won't know. The first
time each appears in a session, define it in a short parenthetical, then use it freely:

- Centre of Gravity (CoG) — what a side's strength actually depends on
- Critical Vulnerability (CV) — the weak point that, if it gives, takes the strength with it
- Schwerpunkt — the one thing worth concentrating on right now
- Line of effort (LOE) — one ongoing workstream running toward the goal
- Culminating point — the moment past which more effort starts producing less

Define, don't teach. The analysis stays dense; only the entry cost comes down. If the
user wants the whole picture in plain language, that's `brief`.

---

## Execution Sequence

### 1. Load Context

Read `GOAL.md` — the goal, success criteria, deadline, current plan, current focus, posture if set, `## People` if present, and log.

Steps 2-4 (CoG, PMESII, ASCOPE) are independent lenses over the same frozen snapshot
from step 1 — none depends on another's output. Where the executing agent can run
independent sub-tasks concurrently, run them in parallel and converge before step 5,
which synthesizes across all three. Steps 5 onward are sequential.

### 2. Center of Gravity Analysis

Produce a CoG assessment for the friendly system — the user, plus anyone in `## People`, and the capability that combination actually drives progress toward the goal — and, if identifiable, any opposing system (a competitor, institution, deadline pressure, or force working against the goal).

For each system:

**Critical Capability (CC)**: What can this system do that makes it effective toward or against the goal?

**Critical Requirement (CR)**: What does the CC depend on to function?

**Critical Vulnerability (CV)**: Which CRs are exposed, degraded, or attackable?

```
[FRIENDLY CoG]
  CC: {capability}
  CR: {requirement}
  CV: {vulnerability} — exploitability: high|medium|low

[OPPOSING CoG] (if identifiable)
  CC: {capability}
  CR: {requirement}
  CV: {vulnerability} — exploitability: high|medium|low
```

Flag if an opposing system isn't identifiable from what's known — recommend a question for `intel` to resolve it. Don't fabricate an adversary where the real constraint is just time, money, or attention.

---

### 3. PMESII Assessment

Assess the operating environment across all applicable dimensions:

| Domain | Key Entities | Current State | Trend | Relevance to Goal |
|---|---|---|---|---|
| Political | ... | ... | stable/shifting | high/medium/low |
| Security | ... | ... | ... | ... |
| Economic | ... | ... | ... | ... |
| Social | ... | ... | ... | ... |
| Infrastructure | ... | ... | ... | ... |
| Information | ... | ... | ... | ... |

Only populate rows where you actually have relevant entities or facts. Omit domains with no data — do not fabricate.

---

### 4. ASCOPE Assessment (if applicable)

If the goal involves operating within a specific environment:

| Category | Key Entities | Notes |
|---|---|---|
| Areas | ... | ... |
| Structures | ... | ... |
| Capabilities | ... | ... |
| Organizations | ... | ... |
| People | ... | ... |
| Events | ... | ... |

---

### 5. Schwerpunkt Identification

Based on the CoG analysis and PMESII assessment:

Identify the single point where concentrated effort right now will produce disproportionate effect toward the goal.

```
SCHWERPUNKT RECOMMENDATION:
  Target: {entity, capability, or action}
  Rationale: {one sentence — what CV this attacks or what CC this builds}
  Confidence: high|moderate|low
  If low: {what would increase confidence}
```

---

### 6. Lines of Effort

Map the current major workstreams toward the goal:

```
LOE 1: {label} — status: progressing|stalled|at_risk
LOE 2: ...
```

Identify interdependencies between LOEs. Flag if one is blocking another.

---

### 7. Second and Third Order Effects

For the current plan or top planned actions:

- **First order**: intended direct effect
- **Second order**: likely consequence of the first order effect
- **Third order**: likely consequence of the second order effect

Flag any second or third order effect that could undermine the goal or trigger an unintended setback.

---

### 8. Culminating Point Analysis

Assess whether the current trajectory has a visible culminating point — the moment beyond which continued effort yields diminishing returns or reversal.

```
CULMINATING POINT:
  Visible: YES|NO|UNCERTAIN
  {If visible}: Estimated at: {condition or timeframe}
  Risk: {what happens if effort continues past culmination}
  Recommendation: {adjust pacing, expand resources, or accept risk}
```

---

### 9. Sense-Check the Schwerpunkt

Before writing the recommendation to file, put it to the user. The analysis is only as
good as the situational facts behind it, and the user holds facts this skill can't see.

```
That's where I think the leverage is. Two questions:

  - Does that match your read of the situation?
  - Is there anything about [the key entity or constraint] I've got wrong?
```

If confidence was rated `low`, say what would raise it and offer `research` before the
user commits to acting on it. A low-confidence Schwerpunkt acted on as though it were
high-confidence is the most expensive failure this skill can produce.

If the user pushes back on a factual premise, treat that as a correction to the input,
not a disagreement about the analysis — rerun the affected step rather than defending
the conclusion.

### 10. Update GOAL.md

Replace the `## Systems notes` section in `GOAL.md` with the Schwerpunkt recommendation and any critical findings (top CV, top second/third order risk, culminating point if visible). Log a one-line summary in the log. Keep the full assessment in the conversation — `GOAL.md` holds the current read, not the whole analysis.

### 11. Name the Next Step

```
Next: [the one thing this analysis says to do]

Or:
  - Turn the Schwerpunkt into sequenced steps → plan
  - Set it as the standing focus → strategy
  - Stress-test it against opposition → threat
  - Close the gap that limited confidence → research
```
