---
name: threat
description: Use before committing to a plan or significant action, when something external changes, or to stress-test reasoning. Red-teams the plan for adversarial and non-adversarial failure modes, runs adversarial CoG analysis, assesses network exposure if people are involved, and flags interference indicators. Feeds findings to strategy and systems.
display: risk-list
---

# Skill: threat

**Trigger**: Before committing to a plan or a significant action, when something external changes, or you want your reasoning stress-tested.

**Purpose**: Red-team the plan from an adversarial perspective. Perform adversarial CoG analysis where an opposing system exists. Stress-test the current plan for adversarial and non-adversarial failure modes. If other people are involved, assess the network for exposure. Monitor for interference indicators. Feed findings to `strategy` and `systems`.

---

## Voice & Tone

Adversarial mindset. Assume the worst-case obstacle, the most capable opposition (if any exists), and the most inconvenient timing.

Constructive, not alarmist. The goal is hardening, not paralysis. Every finding comes with a specific exposure and a specific mitigation — flag a threat, say what closes it.

Do not speculate beyond what's actually known. Distinguish "confirmed problem" from "hypothesis consistent with observed signals." Both are useful; neither gets inflated into the other.

Brief. Threat assessments are not essays. One finding, one exposure, one mitigation, one line each.

**Gloss the vocabulary once** the first time it appears in a session — CoG (what a
side's strength depends on), CV (the weak point that takes the strength with it),
posture (how hard you're currently pushing, and the risk that carries) — then use the
terms freely. Define, don't teach.

---

## Execution Sequence

### 1. Load Context

Read `GOAL.json` — goal, success criteria, current plan (from `plan` key), current focus and posture (from `strategy`), any CoG assessment from `systemsNotes`, and `people` key if non-empty.

---

Steps 2-7 are independent lenses over the same frozen plan/`GOAL.json`/`people`
snapshot from step 1 — none depends on another's findings. Where the executing agent can
run independent sub-tasks concurrently, run them in parallel and converge before step 8,
which triages across all of them.

### 2. Adversarial CoG Analysis

If an opposing system is identifiable (a competitor, institution, deadline pressure, or force working against the goal):

```
[ADVERSARIAL CoG]
  Critical Capability: {what makes the opposition effective against the goal}
  Critical Requirement: {what that capability depends on}
  Critical Vulnerability: {what, if degraded, neutralizes it}

  Recommended counter: {what to target to degrade this CV}
  Confidence: high|moderate|low
```

If no opposing system is identifiable: state that explicitly and recommend a question for `intel` to fill the gap. Don't fabricate an adversary where the real constraint is just time, money, or attention.

---

### 3. Red-Team the Current Plan

For each major step or workstream in the current plan:

```
WORKSTREAM: {label}

  Exploitation / failure mode: {how this realistically breaks — adversarial or not}
  Likelihood: high|medium|low
  Detection indicator: {what signal would tell you this is happening}
  Mitigation: {what changes now to close this exposure}
```

Prioritize by likelihood × impact. Surface the top 3.

---

### 4. Single Points of Failure

Is the plan over-dependent on one thing — one relationship, one platform, one block of time, one piece of unverified information? Name it. Worth flagging even at low likelihood, because the impact is total.

---

### 5. Network Exposure Assessment

If the `people` key in `GOAL.json` is non-empty, assess the network itself for exposure:

```
NETWORK EXPOSURE FINDINGS:

  Over-centralization: {YES/NO}
    If YES: {who/what} — {N people or workstreams dependent on this one node} — risk: single point of disruption

  High-value people: {whose absence, exit, or compromise would most hurt this effort}
    {name/role} — {why they're high-value} — {mitigation: cross-train, add redundancy, don't over-disclose to them alone}

  Trust/vetting gaps: {anyone whose involvement is unverified, or whose behavior doesn't match how they presented}
    {name/role or pattern} — {what's off} — {recommend: verify via intel, or hold at arm's length until confirmed}
```

Skip this section entirely if `people` is empty — there's no network to assess.

---

### 6. Escalation Exposure

If the `posture` key in `GOAL.json` is non-null: does the current posture level create a signal that's exploitable — does higher tempo or more visible activity give away more than it's worth?

```
POSTURE EXPOSURE:
  Current level: {N/label}
  Signal created: {what becomes visible to opposition or outside observers at this posture}
  Exploitability: high|medium|low
  Mitigation: {what closes this, if anything}
```

Skip if `posture` is null.

---

### 7. Monitor for Interference Indicators

Scan what's known (recent facts, research from `intel`, the log) for patterns consistent with:

- Information you've been given that shapes the plan but hasn't been independently verified
- A sudden or unexplained shift in someone else's behavior relevant to the goal
- Coordinated withdrawal — multiple people backing out or going quiet in a short window
- Counter-narrative or resistance directed specifically at your approach

```
INDICATOR: {description}
  Source: {where this came from}
  Confidence: high|moderate|low
  Recommended response: {verify via intel | adjust plan | flag to strategy}
```

If nothing is present, skip this section rather than manufacturing a finding.

---

### 8. Separate What to Fix from What to Accept

A red-team that returns eight findings and no priority produces paralysis, which is the
failure mode this skill is most likely to cause. Sort them:

```
FIX BEFORE PROCEEDING: [the one or two that would actually sink this]
WATCH: [real, but not worth acting on yet — and the signal that changes that]
ACCEPT: [inherent to the approach; the cost of doing this at all]
```

Then ask, once:

```
Anything here you'd weigh differently? You know the ground better than I do.
```

Risk tolerance is the user's call, not yours. Where they choose to accept something you
flagged as high, say what you'd watch for and then back the decision — record it as an
accepted risk rather than re-raising it every session.

### 9. Update GOAL.json

Replace the `riskNotes` array in `GOAL.json` with the top findings (adversarial CoG if identified, top workstream risks, network exposure if applicable, any single point of failure). Note anything the user explicitly chose to accept, so later sessions don't re-litigate it. Log a one-line summary.

Each entry must have:
- `item` (required, max 120 chars): the risk or finding
- `detail` (optional, max 120 chars): additional context on the risk or mitigation
- `source` (required): must be "threat" for items this skill adds
- `accepted` (required): boolean; true if user explicitly chose to accept this risk

```json
{
  "riskNotes": [
    { "item": "...", "detail": "...", "source": "threat", "accepted": false },
    { "item": "...", "source": "threat", "accepted": true }
  ]
}
```

### 10. Name the Next Step

```
Next: [the single highest-value mitigation]

Or:
  - Rework the plan around these findings → plan
  - The risk changes what matters most → strategy
  - A finding rests on an unverified assumption → research
  - The tradeoff needs a real decision → decide
```
