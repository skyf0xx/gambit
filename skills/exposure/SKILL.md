---
name: exposure
description: Use before a public action, a filing, a publication, or anything that puts the user personally on the record — protests, campaigns, public criticism, or organising that touches permits, liability, employment, or personal safety. Maps legal, financial, professional, and personal-safety exposure, and what reduces each. Not legal advice; a checklist for knowing what to check and who to ask.
display: plain-card
---

# Skill: exposure

**Trigger**: Something is about to become public, official, or irreversible. A protest or
public event, a publication or public statement, a filing or submission, taking money,
signing something, or putting your name to a position that has opponents.

Also use when the goal has quietly grown — an effort that was small enough not to matter
crosses a threshold where permits, liability, or attention start applying, and nobody
notices the crossing.

**Purpose**: Map what the user is personally exposed to, and what reduces it. `threat`
covers exposure of the *effort* to opposition. This covers exposure of the *person* —
legally, financially, professionally, and physically.

This is the domain where a regular person running a coordination goal is least equipped
and most likely to be seriously hurt, because the risks are procedural and unfamiliar
rather than strategic.

---

## Voice & Tone

Calm, specific, non-catastrophising. The goal is informed action, not deterrence — most
of what surfaces here is routine, handled with a form, a phone call, or a sentence of
wording.

**You are not a lawyer and must say so.** Where something has real legal weight, name it,
say what kind of professional handles it, and say what to ask them. Never give a
jurisdiction-specific legal conclusion — the failure mode is a confident answer about
liability or permits that is wrong for the user's actual jurisdiction.

Never use this skill to talk someone out of a lawful goal. Naming a risk is not advising
against the action; it's making the choice informed. If the user decides to accept a risk
you flagged, record it and back the decision.

---

## Execution Sequence

### 1. Load Context

Read `GOAL.json` — goal, `plan` key, `people` key, `posture` key, `riskNotes` key. Note the
jurisdiction if it's stated; if it isn't, ask, because almost nothing here generalises
across jurisdictions.

### 2. Establish Jurisdiction and Trigger

```
JURISDICTION: [country / state / council area — ask if not known]
WHAT'S TRIGGERING THIS: [the specific action being assessed]
IS THE USER PERSONALLY NAMED / PUBLIC: yes | no | partly
```

If the user isn't currently public and the action would make them so, flag that as a
threshold decision in its own right — it's reversible only in the weakest sense.

### 3. Work the Categories

Only populate what actually applies. Do not manufacture risk to fill a table.

The seven categories below are independent — none depends on another's findings, and
none needs input from the user mid-category. Where the executing agent can run
independent sub-tasks concurrently, work them in parallel and converge for the Report
(step 4); this is also where a category calling for an external lookup (permit rules,
employer policy) can hand off to `research` without blocking the others.

**Permissions and process**
Permits, approvals, notifications, venue conditions, insurance requirements, road or
public-space rules, filing deadlines. For each: is it required, who issues it, what's the
lead time, and what happens if it's missing or late?

**Liability**
If something goes wrong — injury, damage, a crowd incident, a data breach — who is
exposed? Is there an entity between the user and the liability (an incorporated
association, a company), or is the user personally on the hook? Does insurance exist, and
does it actually cover this activity?

**Speech and publication**
Defamation, misleading claims, copyright, privacy. Where a claim about a person or
organisation is load-bearing in public communication, flag it for verification via
`research` before it goes out — the cheapest defamation mitigation is being right, and
having the source saved.

**Data and other people's information**
If the effort collects names, contacts, addresses, or signatures: what obligations attach,
how is it stored, who can access it, and what happens if it leaks? A list of supporters is
a liability as well as an asset, and this is routinely overlooked.

**Employment and professional**
Does the user's employer, professional body, licence, or visa status create constraints on
public political activity? This is frequently the largest real risk for an individual and
almost never considered until after the fact.

**Personal safety and privacy**
Doxxing, harassment, home address exposure, family exposure. What is currently
discoverable about the user, and what reduces it? Practical, specific measures — separate
contact details, registry privacy options, what not to publish — rather than general
caution.

**Financial**
Personal funds at risk, unrecoverable commitments, contracts signed personally, tax or
reporting obligations if money is being collected from others. Money taken from
supporters creates obligations that surprise people.

### 4. Report

```
EXPOSURE: [the action assessed] — [jurisdiction]

MUST HANDLE BEFORE PROCEEDING
  [item] — [why] — [what to do] — [who to ask] — [lead time]

SHOULD HANDLE
  [item] — [what reduces it]

BE AWARE — accepted, or inherent
  [item] — [why it's likely acceptable]

GET PROFESSIONAL ADVICE ON
  [item] — [what kind: solicitor, insurer, accountant, union] — [the specific question to ask]
```

The last block is not a disclaimer to pad the output. Where something belongs there, put
it there and don't answer it yourself.

### 5. Check the People, Not Just the User

If the `people` key in `GOAL.json` lists others, their exposure is also the user's concern — practically and
ethically.

```
OTHERS' EXPOSURE
  [name/role] — [what they're exposed to] — [do they know?] — [what reduces it]
```

"Do they know?" is the important column. Someone taking on risk they haven't been told
about is a problem regardless of how the effort turns out.

### 6. Elicit

```
Before I write this up:

  - Which of these did you already know about?
  - Is there anything about your own situation — work, visa, family, prior
    history — that changes the weight of any of this?

Only what you're comfortable saying. It affects the advice, but it's yours.
```

Ask once, accept a non-answer, and don't press. Some of this is genuinely private and the
user is entitled to withhold it; the assessment is partial where they do.

### 7. Update GOAL.json

Replace the `exposure` array with the must-handle items as open actions and anything the
user explicitly chose to accept — so later sessions don't re-raise a settled decision.
Where an item is a real blocker on a plan step, say so and hand to `plan` to resequence.

Each exposure entry must have:
- `item` (required, max 120 chars): the exposure, item, or risk
- `status` (required): 'open' or 'accepted'
- `mustHandleBefore` (optional, max 40 chars): action or timeline this blocks
- `acceptedDate` (optional, YYYY-MM-DD format): when this was accepted
- `why` (optional, max 120 chars): rationale for accepting or handling approach

```json
{
  "exposure": [
    { "item": "...", "status": "open", "mustHandleBefore": "..." },
    { "item": "...", "status": "accepted", "acceptedDate": "YYYY-MM-DD", "why": "..." }
  ]
}
```

Log a one-line summary.

### 8. Name the Next Step

```
Next: [the single must-handle item with the longest lead time]

Or:
  - This blocks a plan step → plan
  - Accepting or avoiding it is a real choice → decide
  - You need to know the actual rule → research
  - Someone needs to be told what they're taking on → comms
```

Lead time is why the first line is what it is. Permits and insurance fail on calendar
time, not difficulty — the item to start today is the slowest one, not the biggest one.
