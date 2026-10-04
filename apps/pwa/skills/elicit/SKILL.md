---
name: elicit
description: Use at a natural pause, or when the user asks for a deeper critique or names a method (socratic, first principles, pre-mortem, red team), to pressure-test the most recent piece of work — a draft, plan, decision or set of criteria — by running a chosen elicitation method against it. Offers a short menu of methods drawn from a catalog, runs the chosen ones, and hands back an improved version.
display: plain-card
requires: any
phase: any
checkpoint: true
---

# Skill: elicit

Adapted from BMAD-METHOD's advanced elicitation skill (MIT; see the bundled attribution).

**Purpose**: A shared refinement checkpoint. Other skills call it at a pause to pressure the work they just produced; the user can call it directly on anything recent. The target is the most recent output in the conversation unless the user points elsewhere. Offer a short menu, run the chosen methods against the target, and hand back the improved version so the calling flow resumes where it paused. It writes nothing itself; the calling skill writes whatever the user accepted.

## Serving the catalog

Use the `elicitation_methods` tool; never try to recall the catalog from memory.

- `categories` — category names and counts.
- `list` with `categories` — the methods in those categories; `all: true` lists everything (only when the user picks [a]).
- `show` with `names` — full rows by name or number.
- `random` with `n` and `exclude` — a category-diverse draw.

**First menu**: call `categories`, pick the 2 to 4 that fit the target (risk before a launch, technical for code, collaboration when stakeholders compete, creative when the content is flat), `list` them, and hand-pick five methods that attack the target from different angles.

## The menu

```
**Advanced Elicitation Options**
Choose a number (1-5), [r] to Reshuffle, [a] List All, or [x] to Proceed:

1. [Method Name]
2. [Method Name]
3. [Method Name]
4. [Method Name]
5. [Method Name]
r. Reshuffle the list with 5 new options
a. List all methods with descriptions
x. Proceed / No Further Actions
```

- **1 to 5**: run that method (several numbers: in sequence), then show the menu again.
- **r**: `random` with `n: 5`, excluding everything already offered, and show the menu.
- **a**: show the full catalog as a compact table; a pick by name or number runs like a numbered choice.
- **x**: done. The current enhanced version is final. If anything shown was never accepted, confirm what should carry over first, then call `finish_skill` to hand back to the calling skill, which writes the accepted changes.
- **Anything else**: treat it as direction, apply it to the target, and show the menu again.

## Running a method

Use the method's description as its intent and its output pattern as a flexible flow guide; scale depth to the target. Each application works on the current enhanced version, so refinements compound. Show what the method revealed and the changes it proposes, then ask whether to apply them (y/n/other) and wait. Never change the work without a yes; on no, drop the proposal; any other reply is instruction. When a method casts personas, invent named viewpoints suited to the content.
