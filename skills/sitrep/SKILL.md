---
name: sitrep
description: Use when the user brings several updates at once — "quick catch-up", a list of things that happened, news touching the plan, people, time and money together. Sorts each update to the skill that writes it, shows the routing for a yes, then works through each one in the next turn. Writes only the log itself.
display: plain-card
writes: log
requires: goal
next: plan, stakeholders, capacity, decide, strategy, recon
---

# Skill: sitrep

**Purpose**: Take a batch of updates in one go. Route each to the skill that writes it with `route_updates`, show the routing as a `confirm` reply, and once the user answers, load each routed skill in turn and write its update in that same turn.

Sequence: TODO filled in by phase 2.
