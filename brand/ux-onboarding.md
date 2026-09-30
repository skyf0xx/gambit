# Gambit onboarding

Stage 2 of the UX rethink: from landing on the app to the first message of the intake conversation. It builds on the chosen core experience in `ux-general.md` and keeps its decisions.

Supporting research, all in `brand/`:
- `research/screens/onb-*.png`: the current first run, at mobile and desktop width
- `research/onboarding-comparables.md`: how bring-your-own-key and connect-an-account products onboard
- `provider-facts.md`: Google AI Studio signup, billing, data terms and live API checks (checked 2026-09-30)

Fixed by stage 1:
- Google AI Studio (Gemini) is the default provider, with a short instruction blurb.
- The key step recommends linking billing, says plainly what the free tier means, and leaves the choice to the user.
- The default model is `gemini-flash-latest`, with a fallback to `gemini-3.5-flash-lite`.
- Installing is required right after the first page is written. It's the end of the first session, so it isn't part of onboarding.

---

## 1. The current first run

**In one line:** a developer settings form stands where a generalist's first impression should be. It never says where a key comes from, and a wrong key isn't caught until after the person has written out their situation.

### The path today

| # | Step | What the person sees | Screenshot |
|---|---|---|---|
| 1 | Open the app | "Strategy and planning with your own model key." Then four fields: Provider (Anthropic), Model id, API key (`sk-…`), Proxy / base URL, and a web search checkbox | `research/screens/onb-01-setup-mobile.png`, `onb-01-setup-desktop.png` |
| 2 | **Work out what a key is and where to get one** | Nothing in the app helps. There's no link, no steps, no time or cost. | — |
| 3 | Get a key from the provider | Anthropic, the current default: create a console account and deposit $5 by card. Google isn't offered. | — |
| 4 | Paste and save | Any string is accepted. A Google key saved under "Anthropic" goes through without a word (verified). | `onb-02-after-save-mobile.png` |
| 5 | Empty app | "Start with a goal. Give it a working title…" | — |
| 6 | Title dialog | "A working title, e.g. Land a job offer" | `onb-03-new-goal-mobile.png` |
| 7 | Empty chat | "Tell me what you want to achieve, as much or as little as you have." | `onb-04-first-chat-mobile.png` |
| 8 | Write the situation and send | With a wrong key: "The provider rejected the API key." No next step, and nothing on the page. | `onb-05-bad-key-error-mobile.png` |
| 9 | First real reply | The intake opener: "👋 I am Gambit. Expert on getting things done…" | — |

**Where people drop off:**
- **Step 2, the most likely point.** Rosa and Joanne are handed a form that asks for a "key" and a "model id", with no path to either. Per audience.md, they leave at the first confusing step.
- **Step 8, the second point, and the costliest.** A key problem surfaces only after someone has written out a hard situation, so the failure arrives at the moment of greatest investment.

### Friction points, ranked

**High**
1. **No path to a key.** The app never links to a key page, never shows steps, and never says how long setup takes or what it costs (`Setup.tsx:74-83`).
2. **It asks questions a generalist can't answer.** "Model id", "Proxy / base URL" with "Needed for providers without browser CORS support", a four-way provider list including "Custom (OpenAI-compatible)", and a web search checkbox, all on the first screen (`Setup.tsx:45-63`).
3. **The key is never checked on save.** A malformed, revoked or wrong-provider key is stored silently (`Setup.tsx:27-38`) and fails only on the first message. It can be checked up front: an invalid key fails immediately on a free model-list call, which a browser can make, with a 401 from Google's native endpoint or 400 "Invalid Auth key." from its OpenAI-compatible one.
4. **The default provider isn't the chosen one.** Anthropic needs an account and $5 before the first message. Gemini isn't in `PROVIDERS` at all (`providers.ts:17-22`).

**Medium**

5. **Errors only half-translate.** `errorText` maps 401, 403 and 429 (`agent.ts:165-170`). Everything else reaches the person as raw provider text. That includes Gemini's invalid-key 400 through the OpenAI-compatible endpoint and its "high demand" 503. Even the mapped message names no next step.
6. **The first sentence talks about the mechanism.** "Strategy and planning with your own model key" and "no account and no server" are written for the setter-upper. Rosa needs to hear what she gets (`Setup.tsx:77-80`). Cost isn't stated anywhere before use.
7. **There are two extra steps before any conversation.** After setup come the "Start a goal" screen and a title dialog (`App.tsx:100-104`, `NewGoal.tsx`). The title is a guess typed before any thinking has happened.
8. **Nothing can be seen before a key.** There's no preview of what Gambit produces. It's a wall.

**Low**

9. **The key field's `sk-…` placeholder is wrong for Google.** Google keys look like `AQ.…` (`Setup.tsx:52`). The earlier `AIza…` format is also accepted.
10. **The web search checkbox appears on first run** (`Setup.tsx:57-62`).
11. **The dark developer styling** works against identity.md.

### The Google key path, step by step

From Google's docs (`provider-facts.md`). The sign-in itself wasn't walked, because it needs a real Google account.

**Free:**
1. Open `aistudio.google.com/api-keys`.
2. Sign in with a Google account. Most of the audience already has one through Gmail or Android.
3. Accept the terms the first time. AI Studio creates a project and a key automatically.
4. Copy the key.
5. Return to Gambit and paste it.

**Private (paid terms):** the five free steps, then:

6. Click **Set up billing** next to the project in AI Studio.
7. Add a card and prepay $5.
8. The upgrade usually shows within 10 minutes. A monthly spending cap can be set on AI Studio's Spend page.

At about 6¢ a session, $5 covers roughly 80 sessions.

What this means for onboarding: the free path is short enough for Rosa and Joanne. The paid path adds a card, $5 and a wait, so it can't sit between someone and their first answer.

### What comparable products do

From `research/onboarding-comparables.md`:

- **Check the key before any real use.** BoltAI's "Validate API Key" and Raycast's "Verify" both do this. Gambit checks nothing today.
- **Offer a guided path and a skip path on the same screen.** Chatbox has "I'm new to this" and "Skip guide". People who already have a key, like Kwame, Ines and the setter-upper, shouldn't have to read the steps.
- **Give each provider its own guide** instead of one generic "enter API key" field (Chatbox).
- **Show the real thing before asking for anything.** Excalidraw works with no login at all. Figma Community and Notion templates let you browse freely and ask for an account only when you want to keep a copy.
- **Put the setup burden on the helper, once.** Apple Family Setup lets the organiser pair a device from their own phone.
- **No bring-your-own-key app found links straight to the AI Studio key page.** Google's own docs skip the beginner walkthrough, and the step-by-step exists only on third-party blogs and YouTube. That's a gap Gambit can close.
- **Jan starts with no key at all** by downloading a local model. A zero-key path here would mean running a model in the browser. That's a multi-gigabyte download for a model far weaker than Gemini Flash at following long skill instructions and making tool calls, so it isn't a real option for Gambit's first session.

---

## 2. Directions

Each direction reaches the first message of intake. Step counts start from opening the app and assume a first-time user who already has a Google account.

### A. Guided key card

One calm card replaces the form:
- **The copy:** "Gambit needs a key from Google to think. About 2 minutes, free to start."
- **Three numbered steps**, with a button that opens `aistudio.google.com/api-keys`.
- **The paste box checks the key on paste** with a free model-list call and shows "Key works". A mismatched key is recognised by its prefix. For example, `sk-ant-…` prompts "That's an Anthropic key. Use Anthropic instead?"
- **One line on privacy and billing.**
- **Other providers and model choice** sit under "Use a different provider".
- **After the key, the conversation starts directly.** There's no title dialog, and intake's first question is the first thing on the page.

| | |
|---|---|
| Steps | About 7: open, tap "Get a free key", sign in, copy, return, paste (checked and continued automatically), then intake's first question |
| Good | Fixes friction 1–5 and 7 directly. The simplest to build and test. |
| Bad | The key is still the first thing a person meets. Nothing shows what Gambit is for before asking for effort. |
| Assumes | People arrive already convinced, from a friend's link or a community post. |
| Cost | Small. Rewrite `Setup.tsx`, add a Gemini provider, a validation call, prefix detection, and "create the goal from the first message" in place of `NewGoal`. |

### B. Your goal first, the key second

The app opens on the notebook's first question, before any key: **"What are you trying to make happen?"** The person writes their situation, and it's kept on the device. Then the key card appears with a reason attached: *"To think this through with you and push back, Gambit needs a key from Google. About 2 minutes, free to start."* Once the key checks out, their words go in as the first message automatically. The first reply starts streaming, and the page starts filling in, seconds after the key is pasted.

| | |
|---|---|
| Steps | About 7: open, write the goal, tap "Get a free key", sign in, copy, return, paste. Then the first reply is already arriving. |
| Good | People invest a little before the hardest step, and the key request comes with a purpose. The first thing Gambit asks is the product's own question, not a settings form. The title comes from their words, so there's no title dialog. The wait between pasting the key and seeing value is close to zero. |
| Bad | Someone who can't get a key has written something for nothing. The first screen has to say up front that a free Google key comes next, or it reads as bait-and-switch. |
| Assumes | Writing the goal is a motivator, not a hurdle, which matches audience.md's "trigger: a moment of commitment or a stall". |
| Cost | Small to medium. A: plus a pre-key question screen, a stored draft, and an automatic first send. The draft goes into intake as the first message, so intake's own flow (quick take or deep dive) still runs. |

### C. Example notebook first

The first screen is a read-only example page, rotating between persona goals from business, career, life and campaigning (Rosa's salon, Joanne's career change, Sam's campaign). It shows the next-move card, the pencil marks, "What done looks like" and "What could go wrong", under the line "This is what yours will look like." A "Start your own" button leads to the key card.

| | |
|---|---|
| Steps | About 8: A's steps plus the example screen |
| Good | Shows the output before asking for effort, which the chat-first products can't do. Fully static, so there's no backend and no key. It doubles as the shareable view that audience.md wants for word of mouth, and as the setter-upper's demo. |
| Bad | Doesn't reduce the key friction at all. It adds a screen. An example page can read as a template to fill in. |
| Assumes | People arrive unconvinced, for example cold from GitHub or a search. |
| Cost | Small. Static example records rendered with the existing page components in a read-only mode. |

### D. Bold: the setter-upper does the key

Alex, the developer friend, is treated as a first-class path. On the key card, "Setting this up for someone?" opens a setup kit with three parts:
- a plain-language message to send: steps, cost, and what Gambit is
- a link that opens Gambit with Google already selected, and never carries a key
- a printable one-page "How to get your key" sheet

The friend follows it alone, or Alex sits with them and does it on their phone.

| | |
|---|---|
| Steps | The same as A for the friend, plus one message sent by Alex |
| Good | Matches how audience.md says Gambit spreads. Word of mouth is the main channel, and Alex is how the repo reaches Rosa. It costs little. |
| Bad | It's an add-on, not a whole path, and it helps only people who have an Alex. |
| Assumes | Setup links get sent over WhatsApp, email or Facebook groups. |
| Cost | Small. A read-only settings link (`#setup=google`), a message template, and a print stylesheet. |

**Why a link never carries the key:** a key in a link would sit in someone's chat history, and in any link preview, for as long as the key lives. The only thing a link can safely preset is the provider.

### Constraints

- **No constraint blocks a direction.** Google's API answers browsers directly, and the checks above passed. The only change needed is adding `https://generativelanguage.googleapis.com` to `connect-src`.
- **The no-backend constraint rules out signing in with Google.** Google offers no OAuth flow that hands a static web app an AI Studio key. A key has to be copied and pasted, and the best onboarding can do is make that one clear step. OpenRouter's no-copy-paste sign-in would have removed the step, but it was dropped because OpenRouter's service is unreliable.
- **Switching apps on a phone is the fragile moment.** Opening AI Studio from an installed PWA on iPhone opens Safari. The person copies the key and switches back, and Gambit has to be exactly where they left it. A "Paste" button that reads the clipboard (Safari shows its own paste prompt) saves a long-press.

---

## 3. Chosen direction

**Goal first (B), with a guided key screen (A) and a setup kit for helpers (D), in the paper system from `identity.md`.** Each screen is a mostly empty page, with one thing to do.

1. **The first screen is the question.** A small wordmark, the large question "What are you trying to make happen?", and room to write. At the bottom there's small supporting text: "Next you'll get a free key from Google (about 2 minutes). Your notebook stays on this device." Nothing else is on the screen.
2. **The key screen comes next**, and it's nearly empty:
   - "Get your free key", then three numbered steps: 1 Open Google AI Studio, 2 Copy your key, 3 Paste it here
   - one filled button, "Open Google AI Studio"
   - a paste field, "Paste your key", with a Paste action that reads the clipboard. Someone who already has a key just pastes, and the steps are skippable by nature.
   - "Key works" once the key checks out. The check runs on paste and recognises Anthropic, OpenAI and OpenRouter keys by their prefix.
   - one small line: "Your key and your notebook stay on this device."
   - one small "Other options" link at the bottom. It holds "Use a different provider" (Anthropic, OpenAI, a custom endpoint; OpenRouter only as a custom endpoint) and "Setting this up for someone?", which opens the setup kit: a message to send, a link that presets Google (never a key), and a printable key sheet.
3. **Once the key checks out, their words are sent.** Intake starts on real content, the title comes from the goal, and there's no title dialog.
4. **The intake opener is rewritten to match voice.md.** It drops "👋 I am Gambit. Expert on getting things done". For a first goal it acknowledges what they wrote and asks the quick take or deep dive question.

**That's 7 steps to a first reply, against about 9 today.** More importantly, none of them is a dead end. Today's step 2 ("what is a key?") becomes a button, and today's step 8 failure becomes a check on paste.

**Why not A alone:** it fixes the form but still opens on a key. B costs little more and changes what the first screen says Gambit is: a question about your goal, not a settings form.

**Why not C:** an example page, whether as a screen or a link, pulls attention away from the one thing the first screen asks for, which is writing the goal. The question itself shows what Gambit is.

### Failure paths

| Situation | Detected | What the person sees |
|---|---|---|
| Key mistyped or revoked | On paste (free model-list call) | "That key didn't work. Copy it again from AI Studio. It starts with AQ." |
| Another provider's key | On paste, by prefix | "That looks like an Anthropic key. Use Anthropic instead?" |
| Model busy (503) | First message | Falls back to Flash-Lite quietly. If both are busy: "Google's models are busy right now. Your message is saved, so try again in a minute." |
| Free-tier limit reached (429) | Any message | "You've used Google's free limit for now. To keep going, add credit to this key in AI Studio or switch to another provider. Your message is saved." Actions: Add credit in AI Studio · Switch provider. This is the only place payment comes up. |
| No network | Any message | "You're offline. Your notebook is here, and messages will work when you're back online." |
| Browser blocks the provider | Only for custom endpoints | Stays under "Use a different provider", in the existing wording for developers |

### Money

Gambit never quotes prices. The first and key screens say only "free". Payment comes up once someone has used Gambit and reached the free limit, as a choice between adding credit and switching provider. The provider's billing page is the record of spend.

---

## 4. Decisions

| Question | Decision |
|---|---|
| Goal first, or key first | Goal first. The first screen asks "What are you trying to make happen?", and the key screen follows. |
| Billing on the key screen | None. Payment comes up only in the free-limit message, after someone has used Gambit. No prices are quoted anywhere. |
| Other providers | Anthropic, OpenAI and a custom endpoint, under "Use a different provider". OpenRouter is reachable only as a custom endpoint. |
| Example page | None. It distracts from writing the goal. |
| Setup link | Presets the provider only. It never carries a key. |
| Visual system | Paper as hierarchy: each screen is a mostly empty page, with one thing to do (`identity.md`) |
