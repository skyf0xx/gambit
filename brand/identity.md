# Visual Identity

## 01 — Identity strategy

**A notebook you think in.** Gambit looks and feels like a real pad of paper for one hard goal: a grained page on a desk, typed ink for what's settled, pencil for what isn't, and a few loose slips on top for the things you can pick up. The paper isn't decoration. It's how the screen says what matters, what's certain and what you can touch, without badges, colours or chrome.

The order of attention is always:
1. the thought
2. the next move
3. everything else

The page is still mostly empty. Paper earns its place by carrying meaning, and when a material doesn't mean anything, it comes off the page.

## 02 — Logo

**Wordmark:** "gambit" in lowercase Noto Serif Semibold, drawn as an SVG so it never waits on a font. Inside the app it appears small, and only on the first screen and inside the cover: the foot of the Settings page.

**Symbol:** **"!?"**, the chess annotation for a *speculative, interesting move*, which is exactly what a gambit is. It's drawn with a single pencil stroke in the accent colour. It's the app icon and favicon. Inside the app, it's never used as decoration.

**Character:** a considered risk, with curiosity and nerve.

**Avoid:** knight chess pieces, chessboards, crosshairs, targets, brains, sparkles or stars, anything military, and gradients.

**References:**
- *A yellow legal pad and an index card box*: the materials themselves
- *iA Writer*: typography that gets out of the way of the writing
- *Are.na*: restraint and confidence without decoration

App icon: the accent "!?" on a grained ivory square. Favicon: the "!?" only.

## 03 — Materials and colour

### The materials

Every element on screen is made of one of these, and each one means something:

| Material | Means | Looks like |
|---|---|---|
| **Desk** | Outside the record. Nothing lives here. | A flat, darker warm surround the page sits on |
| **Page** | The record, which you read | Ivory paper with a fine grain, a pink legal-pad margin rule on the left, and a soft shadow on the desk |
| **Ink** | Committed: the goal, criteria, people, moves, decisions | Crisp typed text. The goal title and the one filled button have a faint bleed, like ink that soaked in. |
| **Pencil** | Changeable or unproven: statuses, dates, guesses, notes to self | Graphite with visible grain. Short pencilled words are handwritten. |
| **Margin** | Notes about a line | The strip left of the margin rule. Stars, "?" and arrows live here, never over the text. |
| **Slip** | Something you can touch or act on | Paper laid on top of the page, the only material that casts a shadow |
| **Highlighter** | The focus | One translucent yellow swipe behind the text |
| **Eraser** | No longer true | A strikethrough, a grey smudge and a fade |

**Slips.** Each touchable surface is a different kind of paper, so its shape says what it is:
- **The next move is an index card, taped to the top of the page.** It has a red header rule, blue ruled lines, and a slight tilt. It carries the move, its date in pencil, and three text actions.
- **A suggestion from the advisor is a sticky note.** It's proposed, not yet yours, so it sits on the page but isn't the next move yet, with "Keep it" and "Toss". Keeping it turns it into a next move in ink, and tossing it drops it.
- **The composer is a torn slip** resting on the bottom edge of the page.
- **The conversation is a loose leaf** laid over the page, with a torn top edge. On desktop it lies along the right-hand side.
- **Something to hand over** (the setup kit's message) is a torn-off slip.

### Colour tokens

Tokens are defined once as CSS custom properties. Light is the default and dark is the alternate.

| Token | Light | Dark | Role |
|---|---|---|---|
| `--desk` | `#E7E1D4` | `#0F0E0D` | the surround the page sits on |
| `--bg` | `#F8F5EE` | `#1D1B18` | the page |
| `--surface` | `#FFFDF8` | `#262320` | slips and leaves laid on the page |
| `--rule` | `#E6E0D4` | `#34312C` | hairlines, used sparingly |
| `--ink` | `#1F2733` | `#ECE8E1` | typed text and the one filled button |
| `--graphite` | `#6B665D` | `#A39C8E` | pencil: secondary text, handwriting, pencil marks |
| `--accent` | `#B83A26` | `#E2694F` | the single mark that matters |
| `--margin-rule` | `#EBC8BE` | `#4A2E28` | the legal-pad margin line |
| `--card-rule` / `--card-head` | `#C9DCEB` / `#E7A89B` | `#2C3A45` / `#6E3A30` | an index card's ruled lines and red header rule. `--card-rule` also rules any line you write on. |
| `--hi` | `rgba(250,214,80,.55)` | `rgba(214,170,60,.30)` | the highlighter |
| `--note` / `--note-edge` | `#FBEFA6` / `#EEDC7C` | `#3B3522` / `#4A4229` | the sticky note and its folded corner |
| `--tape` | `rgba(222,206,170,.62)` | `rgba(150,135,105,.35)` | the tape holding the card |
| `--lift` / `--lift-far` | warm brown at 16% / 10% | black at 50% / 35% | the shadow under a slip |
| `--grain` | fractal noise as an SVG data URI, plus faint paper fibres in light | lighter specks, no fibres | the paper's tooth, on the page and every slip |

**Personality:** warm, tactile, trustworthy. The page is quiet so that the few marks on it stand out.

**Rules:**
- **The accent is used extremely sparingly: at most one mark per screen.** It's used for exactly three things: the loop on a line the conversation just changed, the name of the skill that's working, and error text.
- **Status is a pencilled word, not a colour.** "on track", "waiting" and "not asked" are handwritten in graphite, because statuses change. There are no status colours, badges, dots or progress bars.
- **Only slips cast shadows.** The page's own shadow on the desk is the one exception, since it sits on the desk and not on the page. A shadow anywhere else would claim something is touchable when it isn't.
- **Grain goes on paper only**: the page and slips. Text, marks and icons never get it, apart from pencil.
- **No brown backgrounds, wood, leather, spiral bindings, coffee rings or other props.** The materials above are the whole kit.
- Never put accent text on an accent-tinted background.
- Check contrast in both themes before shipping, against the grained paper and not the flat colour. Target 4.5:1 for typed body text. Handwriting is only ever secondary, and still needs 3:1.

## 04 — Typography

Inter does almost all the work, and hierarchy comes from size and weight. The type is large, the lines are short, and there's generous whitespace.

All fonts are **self-hosted** (`@fontsource-variable/*` and `@fontsource/caveat`). The app's CSP blocks Google Fonts, and privacy is part of the brand.

- **Inter** (variable), the default and the "typed ink". Section headings, the advisor's answers, your own writing, actions and labels.
- **Noto Serif** (variable), only for the wordmark, the goal title, and notebook titles on the shelf. Never for running text or controls.
- **Caveat**, the pencil hand. Used only for short pencilled words: statuses, dates and times, move numbers, step numbers, method names beside a heading, empty-section prompts, the composer's placeholder, the change note, and one-line reassurances ("saved", "Your key and your notebook stay on this device"). Never for anything longer than a line, never for the advisor's words or yours, and never for headings or actions.
- **Noto Sans Mono** (variable), only where characters must be told apart: the API key field and links.

**Hierarchy** (Inter unless noted):
- Large question (first screen): 30/38, weight 500, with the ink bleed
- Goal title: Noto Serif 29/37, weight 500, with the ink bleed
- Next move, on the card: 20/28, weight 500
- Section heading: 20/28, weight 600 (an empty section's heading: weight 400, `--graphite`)
- Body, the advisor's text and your text: 17/27, weight 400. The advisor's text and yours are told apart by position (yours on the right, the advisor's on the left), never by bubbles.
- Pencilled words: Caveat 21–24px, weight 500, `--graphite` with the graphite grain, sentence case ("by Friday 3 Oct", "6 weeks left")
- Small typed text (labels, hints that need to be exact): 14/20, weight 400, `--graphite`
- Reading width: about 60 characters on large screens
- Figures: Inter's tabular numbers (`font-variant-numeric: tabular-nums`) wherever numbers line up
- Inputs: at least 16px, so iPhone doesn't zoom on focus

**Avoid:**
- Serif for running text or controls
- Handwriting for anything longer than one line, or anything the person must read exactly (keys, amounts, error text)
- Uppercase or letter-spaced labels
- Inter Display, or tight negative letter-spacing on big headings
- Any family beyond these four

## 05 — Layout and components

- **The page is one sheet on the desk.** On mobile it fills the screen, with a sliver of desk at the top. On desktop it's a centred column at reading width. The margin rule sits 34px in on mobile and 48px in on desktop, and text starts just past it.
- **No containers around ordinary text.** Sections are a heading and text on the page, separated by whitespace. A container means a slip, and a slip means you can touch it.
- **Actions are text by default.** "Keep it" and "Toss" are plain typed words. Marking something done is the exception: it is always a hand-drawn tick box, on the index card as on every other line. On hover or keyboard focus, a pencil circles the action. Quiet secondary links ("undo", "Details") stay underlined instead of circled. A screen has at most one filled button, a block of ink with a slight bleed, and only when a single action is clearly the way forward ("Open Google AI Studio").
- **The next move is the index card at the top of the page** (§03). When nothing is due, the card asks "What's your next move?", and its pencilled line says there's nothing due yet.
- **Where you write is ruled.** The first-screen writing area and text fields sit on `--card-rule` lines.
- **The conversation is a loose leaf over the page.** It reads like a messenger without the bubbles: your words and the advisor's are typed text. Yours sit on the right behind a pencilled rule, with no mark. The advisor's sit on the left beside its portrait (`apps/pwa/public/avatar.webp`: a hand-drawn strategist in ink and muted wash, with one accent pocket square) in a pencilled ring. The conversation's top bar names the other side once, with the portrait and "Gambit", never over each message. Everything between turns sits centred in pencil: "thinking…", the "Show reasoning" toggle, and the one line summing up what the turn wrote to the page ("wrote to your page: Priya confirmed · 1 new risk").
- **A change made by the conversation** gets the accent loop, and a pencilled accent note under the line ("new, from your chat · undo").
- **An empty section is one pencilled question you can tap**, phrased as the question that fills it ("Nobody named yet. Who has a say in this?"). It isn't an illustration or a button.
- **Every text action has a tap area at least 44px tall**, and every control shows an ink focus ring for keyboard use.
- **Chrome is minimal.** A small wordmark, one menu, and the composer slip at the bottom. The send button is a pencil ring until there's text, then an ink circle. The input is the only way to act on the goal: you talk, and the agent does the adding. Settings and the notebook shelf sit one tap away on a leaf.
- **Icons only when essential**, and where a familiar icon beats an unfamiliar word: menu, close, back, share and send. Each carries a text label for screen readers.

### Pencil marks

The page carries a small set of hand-drawn marks, like going back over a notebook with a pencil. Each mark means one thing, and it comes from the state of the goal, never from decoration. The agent writes the record, and the page draws the marks from it.

Strokes are drawn with **perfect-freehand**, so they taper with pressure like a real pencil. Pencil marks run through the graphite grain filter. Ink marks (the tick) and the highlighter don't.

| Mark | Means | Comes from | Material | Lasts |
|---|---|---|---|---|
| Index card | Your top move | The first `pending` next action on the focus line, else in plan order | Slip, taped | Always, for the next move only |
| Open loop | The most important change from the last conversation | The last turn's writes | Pencil, in the accent | Until the next session, a tap on the line, or undo. Draws in once, then stays still. |
| Tick | Done | A next action or step with status `done`, or a criterion `eval` scored `met` | Ink, overshooting a hand-drawn box | While true |
| Highlighter | The focus: anything that doesn't help this can wait | The line named by `focusLine` on the newest log entry that sets a focus, from `strategy` only; a newer focus with no single line clears it | Highlighter, behind the text | While it's the focus |
| Star | The step your top move is working toward | The first pending critical-path step on the top move's own line. None without a top move or an open step on its line | Pencil, in the margin | While it's pending |
| Arrow | This depends on that: a risk and the person it hangs on | A risk's `dependsOn`, pointing at a name in people or stakeholders | Pencil, out through the margin and back | While the link holds |
| Status label | Not known yet: an assumption or prediction, not a fact | Open experiments grouped under "not tested yet", open forecasts under "waiting to find out", open decisions under "still to decide" | A pencilled label over the group, and the unproven text itself is in pencil | Until a test, forecast or decision settles it, when the item moves to the settled group |
| Erased | No longer true: dropped, disproved, or a risk that went away | An item set to `dropped` (including a tossed suggestion), a failed experiment, a removed risk | Pencil strikethrough, smudge and fade | Only in the session it happened. After that the line leaves the page, and the log keeps it. |
| "?" in the margin | An open question waiting on a decision | A decision with status `open` | Pencil, handwritten | Until it's decided |
| Sticky note | A suggestion you haven't taken yet | A next action with status `proposed` | Slip | Until you keep it or toss it |

**Rules:**
- **The loop is the only mark in the accent,** so it stays the one thing on screen to look at.
- **At most one mark per line.** When two apply, the event mark (the loop or the eraser) wins while it's showing.
- **One loop and one highlighter per page.** The Moves divider tab also carries a faint wash of the highlighter, to mark it as the tab the notebook is for; it sits on the desk, outside the page, so it doesn't count against this. A star is always single, never two or three, so it can't read as a rating.
- **Margin marks stay in the margin.** An arrow runs through the margin, never across text, and only one is visible at a time. When its two ends are more than a screen apart, it becomes a pencilled note on the line instead ("→ Priya").
- **The eraser is the one mark that shows something that is no longer true,** and it lasts only one session, so the page still reads as current state.
- **No boxes drawn around text.** A drawn box reads as a container, and containers are slips.
- **Hover circles are the only marks that aren't from the record.** They appear on hover or focus and fade when the pointer leaves.
- **Every mark has a text equivalent for screen readers** ("focus", "not checked yet", "depends on Priya", "dropped", "suggestion").
- **Motion is short and happens once**: the loop draws in once on arrival from the chat, and hover circles draw in about 0.4s. With reduced motion, marks appear without drawing in.

### Building it

- **Grain** is a small tiled SVG data URI (`feTurbulence`) on the page and slip backgrounds, rendered once as an image and never as a live full-screen filter.
- **The graphite and bleed filters** are two inline SVG filters in the app root. Graphite punches noise holes in pencil and adds a slight wobble. Bleed displaces ink edges by under 1px.
- **Marks** are drawn into two SVG layers per page, positioned from the real text layout (one rect per rendered line) and redrawn on resize. The highlighter layer sits under the text, and the pencil layer sits over it. Randomness is seeded per line, so marks don't reshuffle between renders.
- **Torn edges** are a `clip-path` polygon generated from the element's width. The slip's shadow comes from a `drop-shadow` filter on its parent, because a clip-path cuts off a box-shadow.
- **Dependencies:** `perfect-freehand` and `@fontsource/caveat`, both bundled. Nothing is loaded at runtime, so the CSP doesn't change.
- The reference implementation is `brand/mockups/tokens.css`, `notebook.css` and `marks.js`.

## 06 — Imagery

For the README, website and social posts only. The app itself has no imagery, except the advisor's portrait beside its turns in the conversation.

- **Aesthetic:** documentary and quiet. Hands, pads, index cards and plans in progress.
- **Treatment:** warm natural light, slightly desaturated, with lots of negative space.
- **Avoid:** glowing brains, robots, chess pieces, mountain summits and anyone pointing at a whiteboard.

## 07 — Iconography

- Line icons (Lucide), 1.5px stroke, rounded caps, in `--ink` or `--graphite`
- Used only when essential, and never decoratively or on every row
- The one exception is section glyphs. On a tab that mixes several kinds of record (Bets: decisions, tests, predictions, leverage), each section heading can carry a small pencil glyph so its kind can be recognised at a glance. The glyphs are hand-drawn with perfect-freehand like the other marks, grained, in `--graphite`, and hidden from screen readers because the heading already names the section. They never go on the tabs themselves.
- No emoji in the interface. The advisor's replies follow GUIDED.md's formatting rules, which allow at most one emoji per heading. Gambit's own output should use them rarely.

## 08 — Design principles

**The material is the meaning.** Ink is settled, pencil is open, a slip can be picked up, and the margin is for notes. If a material doesn't mean something, take it off the page.

**The thought first, the next move second, everything else third.** If something doesn't serve one of the first two, it goes one tap away.

**Remove before adding.** Paper makes it tempting to add props. Don't.

**Ink first, accent last.** Almost everything is ink and pencil. The accent marks the one thing to look at, at most once per screen.

**Plain labels, methods underneath.** UI names are plain words ("What could go wrong"). The method name is secondary ("premortem"), pencilled beside the heading, and only where it helps.

## 09 — Expressions

- **First screen:** the first page of a new notebook. A small wordmark, the large question "What are you trying to make happen?", ruled lines to write on, and one pencilled line underneath.
- **Notebook:** the index card taped at the top, then the goal title in Noto Serif with "6 weeks left" pencilled under it, then three sections by default ("What done looks like", "Who's involved", "What could go wrong"). Other sections appear only once they have content. The composer slip at the bottom reads "Think out loud…" in pencil.
- **Conversation:** a leaf with a torn top edge laid over the page, with the next move faintly visible above it. Gambit's replies are 80 words at most, and a reply taller than the view opens at its first line.
- **Key screen:** nearly empty. "Get your free key", three pencil-numbered steps, one ink button ("Open Google AI Studio"), a ruled paste field, "Key works", and one pencilled line: "Your key and your notebook stay on this device."
- **README / GitHub:** the wordmark on grained ivory, and screenshots in light mode.
- **Social / OG image:** "What's your next move?" in Noto Serif on an index card taped to grained ivory, with a small accent "!?".
- **Share view (future):** a read-only rendering of the page, without slips.

## 10 — Applying this to the current UI

What the current code uses and what it changes to:

| Now | Change to |
|---|---|
| `styles.css`: `color-scheme: dark`, `#020617` bg, system font | Tokens and materials from §03 on `:root`, light by default plus dark through `prefers-color-scheme`, grain on the page and slips, the graphite and bleed filters in the app root |
| System font everywhere | Inter body, Noto Serif for the goal title, Caveat for pencilled words, all self-hosted |
| `ui.tsx` primary button `bg-sky-500` | Text actions circled in pencil on hover, and at most one ink filled button per screen |
| `slate-*` everywhere (inputs, cards, modals) | `--desk` / `--bg` / `--surface` / `--ink` / `--graphite` through Tailwind theme variables. Modals become leaves. |
| Bordered `<details>` cards on the dashboard | Plain sections on the page: a heading and text, separated by whitespace |
| `Dashboard.tsx` `segColor` bar and status `Pill`s | Status as a pencilled word. The criteria bar is removed, and criteria get hand-drawn boxes. |
| Bridge card at the top of the dashboard | The taped index card with the next move and three text actions |
| Card headings via `titleForKey` (skill-ish names) | Plain-language titles, with the method pencilled beside the heading |
| Chat bubbles in `Chat.tsx` | Typed text on a loose leaf over the page, with no bubbles |
| Chat input | The torn composer slip |
| `index.html` `theme-color #0f172a`, placeholder `icon.svg` | `#F8F5EE` / `#1D1B18`, the accent "!?" icon |
| `Setup.tsx` developer-style key form | The question-first start and the nearly empty key screen (`ux-onboarding.md`) |
