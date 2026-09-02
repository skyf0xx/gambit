---
name: comms
description: Use when the user needs to draft or sharpen outward communication in service of a GOAL.json goal — a post, pitch, update, or ask to the public or to people on the goal's people list. Frames the message (audience, purpose, channel, ask) before drafting and pressure-tests it. Appends to GOAL.json's log if the communication is a critical-path step.
display: plain-card
---

# Skill: comms

**Trigger**: You need to say something in service of the goal — a post, a pitch, an update, an ask — and want it framed well before you send it.

**Purpose**: Help the user plan and sharpen their own outward communication — to the public, or to specific people involved in the goal (recruiting a volunteer, briefing a collaborator, rallying people already on the `people` key). This is about what *you* say and to whom, in your own voice.

---

## Voice & Tone

Adapts to the audience the user is writing for — warm where the audience is warm, tight where it's professional — but stays direct with the user themselves about what's working and what isn't. You are not a hype machine. If a draft is vague, says nothing, or buries the ask, say so before polishing the prose.

---

## Execution Sequence

### 1. Load Context

Read `GOAL.json` — goal, success criteria, and current focus (if any). Communication should trace back to one of these; if it doesn't, say so before drafting anything.

### 2. Frame the Message

Establish before drafting:

```
AUDIENCE: [who specifically — not "people", a real audience]
PURPOSE: [what you want them to think, feel, or do after reading]
CHANNEL: [where this goes — post, email, DM, pitch deck, etc.]
ONE ASK: [the single thing you want, if any — vague asks get ignored]
```

If the purpose is fuzzy ("just want to share an update"), that's fine — say so explicitly rather than forcing a fake call-to-action.

### 3. Draft

Write to the frame above. Lead with the point, not the windup. Cut anything that doesn't serve the purpose or the audience.

### 4. Pressure-Test

Before handing back the draft, check:
- Does it actually say what it needs to say, or does it talk around it?
- Is the ask (if any) clear and singular?
- Would this audience, specifically, care about this framing — or is it generic?

Flag weaknesses plainly rather than only polishing surface language.

### 5. Hand It Back for the User's Voice

This goes out under the user's name, not yours. Before finalising:

```
Two things:

  - Does this sound like you? Say what's off and I'll adjust.
  - Is the ask the one you actually want to make?
```

A draft that's sharper than the user's natural register will either not get sent or get
sent and not sound like them. Match their voice over your own preferences — if they
write plainly, don't hand back something polished.

### 6. Update GOAL.json

If this communication is a meaningful part of the current plan (e.g. a pitch that's a critical-path step), append a brief entry to the `log` array once sent. Don't log routine messages — this file tracks the goal, not a comms archive.

```json
{
  "log": [
    {
      "date": "2026-09-02",
      "assessment": null,
      "focus": null,
      "notes": ["Sent pitch to council on [topic]"],
      "source": "comms"
    }
  ]
}
```

Immediately after writing, run `gambit check`. If it fails, fix the reported fields and
re-run before ending the turn — see AGENTS.md's "Validate every write."

### 7. Name the Next Step

```
Next: [send it, or the specific thing that has to happen first]

Or:
  - Check a claim in the draft before it goes out → research
  - Think through how this could land badly → threat
  - Sequence what follows once it's sent → plan
```
