# Onboarding comparables — BYO-key and connect-account flows

Date: 2026-09-30. Research only — no design decisions for Gambit here. This
file does not repeat `comparables.md`; it's scoped to BYO-key/connect-account
onboarding specifically: step counts, how the key step is explained, key
validation and error UX, cost display, trust copy, pre-key value, and
setup-for-someone-else patterns. Claims are sourced with a URL where found;
anything from memory only is marked **unverified**.

---

## Patterns worth stealing / patterns to avoid (one screen)

**Steal**

- **Validate the key immediately, in the UI, before the first real request.**
  BoltAI's key-entry field has an explicit "Validate API Key" button right
  next to the paste field — the user gets a pass/fail before they've typed
  a single prompt. Raycast does the same: paste key → click **Verify** →
  only then **Save**. Source: [BoltAI Setup](https://boltai.com/docs/start/setup), [Raycast BYOK](https://manual.raycast.com/ai/bring-your-own-key)
- **Offer a guided path and a skip-it path on the same screen, and let the
  user self-select their skill level.** Chatbox's welcome screen literally
  offers "I'm new to this" (guided, browser-based OAuth flow) vs. "Skip
  guide" (go straight to Settings and paste a key) — it doesn't force a
  novice through developer-speak, and doesn't force an expert through hand
  holding. Source: [Chatbox getting started](https://chatboxai.app/en/guide/getting-started/first-chat)
- **Local models need zero key, cloud models need one — and the app leads
  with the zero-key path by default.** Jan downloads a local model on first
  launch automatically; you're chatting with no setup, and BYOK cloud
  provider setup is presented later as an upgrade path, not a requirement to
  start. Source: [Jan QuickStart](https://www.jan.ai/docs/desktop/quickstart)
- **A dedicated per-provider setup guide page, not just a generic "enter
  API key" field.** Chatbox ships separate guide pages for OpenAI, Claude,
  and OpenRouter — each with the provider's own account-creation and
  key-creation steps spelled out, since every provider's console looks
  different. Source: [Chatbox OpenAI Setup Guide](https://chatboxai.app/en/guide/byok/openai)
- **Say exactly where the key lives and that it's never sent anywhere but
  the provider — in one sentence, in the FAQ, not a modal.** TypingMind:
  "Your API key is stored locally in your browser's local storage and is
  never sent to TypingMind's servers. TypingMind is a static app — there is
  no backend that could intercept your key." Source: [TypingMind General FAQs](https://docs.typingmind.com/general-faqs)
- **Show a running cost/usage estimate inline, not just at the provider's
  invoice.** TypingMind estimates token cost per session so spend isn't a
  surprise later (carried over from prior research; same citation).
  Source: [TypingMind General FAQs](https://docs.typingmind.com/general-faqs)
- **Full product, no account, no time limit, before any signup ask.**
  Excalidraw: "no onboarding, no signup, no confirmation email, no
  OAuth — you're just in the product," and it's the complete app, not a
  crippled demo. Source: [dev.to: Excalidraw no login](https://dev.to/nologintools/excalidraw-free-online-whiteboard-no-login-required-25j5)
- **Let people preview community/template content before they must create
  an account, and only gate the "keep a copy" action.** Figma Community and
  Notion's template gallery both let you browse/preview freely; the account
  wall appears only at "duplicate into your own workspace." Source:
  [Figma: Duplicate Community files](https://help.figma.com/hc/en-us/articles/360038510873-Duplicate-Community-files), [Notion: ultimate guide to templates](https://www.notion.com/help/guides/the-ultimate-guide-to-notion-templates)
- **Setup-for-someone-else: the helper does the install, the other person
  only has to accept a code/prompt on their own device.** Chrome Remote
  Desktop's family-support pattern: you install and register their computer
  once; from then on your parent just opens the app, sees a PIN, and clicks
  accept — no further tech literacy required per session. Source:
  [How to help your parents with remote access (TeamViewer)](https://www.teamviewer.com/en-us/insights/remote-access-help-parents/)
- **A key ↔ device is per-provider and toggleable without deleting it.**
  Raycast shows each provider's key as a row with an enable/disable toggle,
  so a user can turn a provider off (e.g., ran out of credit) without
  losing the stored key. Source: [Raycast BYOK](https://manual.raycast.com/ai/bring-your-own-key)

**Avoid**

- **Conflating "bad key" with "no credits" into one generic error.** Both
  the OpenAI community and GitHub issue trackers show apps repeatedly
  surfacing "insufficient_quota" and outright invalid-key failures as the
  same undifferentiated error, leaving users unable to tell if they typed
  the key wrong or simply need to add billing. Source: [OpenAI Community: insufficient quota with credits](https://community.openai.com/t/i-have-credits-but-i-still-get-you-exceeded-your-current-quota/928972), [GitHub agent-zero: user-friendly API error messages](https://github.com/agent0ai/agent-zero/issues/1111)
- **Marketing "free tier, no credit card" language that quietly means
  "free but not the flagship model."** OpenRouter's free tier is real but
  limited to open-weight or promotional `:free`-suffixed models — not
  Gemini's paid flagship tiers — and this distinction is easy to miss on a
  skim. Source: [costgoat: OpenRouter free models](https://costgoat.com/pricing/openrouter-free-models)
- **A generic provider doc page that assumes the reader already knows what
  a "project" or "billing account" is.** Google's own `ai.google.dev`
  API-key doc doesn't walk through key-creation steps at all — it just
  links out to AI Studio and talks about treating the key "like a
  password," with zero screenshots or beginner framing. The actual
  step-by-step walkthroughs for a first-timer live on third-party blogs and
  YouTube, not on Google's own docs. Source: [ai.google.dev: Using Gemini API keys](https://ai.google.dev/gemini-api/docs/api-key)
- **Requiring an account just to duplicate/keep something you were only
  ever previewing.** Figma Community requires a full account for the
  "duplicate" action even though browsing is free — the wall appears at the
  exact moment of commitment, which is reasonable, but it's easy to build
  this wall one step too early (gating the preview, not just the keep).
  Source: [Figma: Duplicate Community files](https://help.figma.com/hc/en-us/articles/360038510873-Duplicate-Community-files)
- **Per-provider account creation, billing setup, and key creation treated
  as one seamless "step 2" when it's actually 4–6 sub-steps on someone
  else's website.** Chatbox's own guides admit the pattern is "register an
  account, add a payment method, create an API key, enter it" — four
  distinct actions on a third-party site compressed into what the app
  calls a single setup step. Source: [Chatbox OpenAI Setup Guide](https://chatboxai.app/en/guide/byok/openai)

---

## Per-product notes

### BYO-key chat apps

**TypingMind** — Settings → Models → API keys tab, paste key per provider,
start chatting; key stored in browser LocalStorage, never touches
TypingMind's servers (it markets itself as a "static app" with no backend).
Shows inline token/cost estimation. No explicit statement found on
immediate key validation on save — **unverified** whether it validates on
entry vs. first message. Source: [TypingMind API Keys Setup](https://docs.typingmind.com/manage-and-connect-ai-models/set-up-api-keys), [TypingMind General FAQs](https://docs.typingmind.com/general-faqs)

**Msty** — First launch asks: use existing local models, set up a new local
model, or add an API key for an online provider — three parallel paths, no
forced order. Adding a remote provider needs the key already in hand before
starting that flow (no in-app deep link to the provider's key page found).
No telemetry/analytics collected, pitched as the trust claim. Source:
[Msty Studio Onboarding](https://msty-studio-docs.nuxt.dev/getting-started/onboarding), [Msty on byoklist.com](https://byoklist.com/tool/msty.app)

**Chatbox** — Two-track welcome screen: "I'm new to this" (opens
browser-based login/authorization, then offers a free daily-refreshing
quota with no BYO key needed) vs. "Skip guide" (Settings → Model Provider →
paste key + host). Separate dedicated guide pages per provider (OpenAI,
Claude, OpenRouter) walk through that provider's own account/billing/key
steps. Source: [Chatbox first chat guide](https://chatboxai.app/en/guide/getting-started/first-chat), [Chatbox OpenAI Setup Guide](https://chatboxai.app/en/guide/byok/openai)

**BoltAI** — Install → pick provider → paste key → click **Validate API
Key** inline, immediate pass/fail. Docs explicitly warn OpenAI keys need
billing/credits set up on OpenAI's side first, and that the API key format
differs from BoltAI's own license key (a real point of user confusion it
calls out proactively). Source: [BoltAI Setup](https://boltai.com/docs/start/setup), [How to create an OpenAI API Key](https://boltai.com/docs/guides/how-to-create-an-openai-api-key)

**Jan** — Local model auto-downloads on first launch; no key, no setup,
chat works immediately. Cloud/BYOK path is opt-in and later: Settings →
Model Providers → pick provider → paste key → pick model → chat. Also ships
its own local OpenAI-compatible API server for developers (not relevant to
the non-technical audience). Source: [Jan QuickStart](https://www.jan.ai/docs/desktop/quickstart)

**LibreChat** — Self-hosted, so "onboarding" starts with running a server,
opening localhost, and registering an account — already a different
audience than Gambit's. Two BYOK modes: `user_provided` (each user pastes
their own key via a gear-icon dialog next to the model endpoint) or a
server-wide key set once by whoever runs the instance. Keys reviewed at
Settings → Data & Privacy → API keys. Source: [LibreChat Quick Start](https://www.librechat.ai/docs/quick_start/local_setup), [LibreChat authentication](https://www.librechat.ai/docs/configuration/authentication)

**Open WebUI** — Also self-hosted/admin-first: Settings → Admin →
Connections, paste URL + key per provider, auto-detects available models.
Framed around an admin configuring the instance for other users, not a
single non-technical end user configuring their own key — a materially
different setup audience than Gambit's single-user case. Source: [Open WebUI Quick Start: connect a provider](https://docs.openwebui.com/getting-started/quick-start/connect-a-provider/)

**Pal** — Minimal documented flow: install from App Store → get a key from
a provider (OpenAI or, more flexibly, OpenRouter for broader model access)
→ paste into app settings. Framed on privacy/cost: "fully private and
secure," pay-per-use rather than subscription. No detail found on
validation-on-entry or error states — **unverified**. Source: [aibucket.io: Pal Chat](https://www.aibucket.io/tools/pal-chat)

### Developer tools with BYOK, for contrast

**Raycast** — Settings → AI → Models & Providers → add key per provider →
click **Verify** → click **Save**. Verify is a separate, required step
before save — the strongest "don't let a bad key sit silently" pattern
found in this whole set. Each provider row has an enable/disable toggle
that doesn't delete the stored key. Cost framing is direct: "you'll be
responsible for the API costs incurred at the provider's standard rates."
Source: [Raycast BYOK](https://manual.raycast.com/ai/bring-your-own-key)

**Zed** — Agent Panel settings → find provider → paste key → hit enter.
Keys are stored in the OS's secure credential store, not in a plain-text
settings file — a stronger local-storage claim than most BYOK chat apps
make (browser LocalStorage vs. OS keychain). No explicit "Validate" click
described; **unverified** whether it checks the key before first use.
Source: [Zed: Use API Access](https://zed.dev/docs/ai/use-api-access)

**Obsidian plugins (contrast pair)** — Smart Connections needs *zero*
setup and no API key at all — install, enable, it indexes the vault with a
built-in local model. Copilot plugin, by contrast, needs BYOK for any
cloud model, entered at Settings → Copilot → BYOK, stored in the OS-level
Obsidian Keychain rather than the vault's own `data.json` (so the key
doesn't leak if you share vault files). The two plugins are a clean natural
experiment in "same host app, zero-key path vs. BYOK path." Source:
[GitHub: obsidian-smart-connections](https://github.com/brianpetro/obsidian-smart-connections), [Obsidian Copilot community page](https://community.obsidian.md/plugins/copilot)

### Guides to creating a Google AI Studio / Gemini key

Google's own developer docs (`ai.google.dev/gemini-api/docs/api-key`) do
**not** walk through key creation at all — no numbered steps, no
screenshots. It states the security framing ("treat your key like a
password") and links out to `aistudio.google.com/apikey`, leaving the
actual beginner walkthrough to third parties. Source: [ai.google.dev: Using Gemini API keys](https://ai.google.dev/gemini-api/docs/api-key)

Third-party beginner tutorials converge on roughly the same **4-step**
sequence: (1) go to aistudio.google.com and sign in with an existing Google
account — "if you already use Gmail, YouTube, or Google Drive, you can
often proceed with that same account"; (2) accept the Generative AI terms
of service on first visit; (3) go to the API Keys section, create or pick a
Google Cloud project; (4) click "Create API Key," copy it. Several
tutorials add a fifth informal step: "save it securely" / "don't share it."
Delivery is a mix of numbered blog steps and narrated YouTube screen
recordings — several dedicated videos exist just for this one task,
suggesting real demand for a visual (not just textual) walkthrough for this
audience. Source: [lilys.ai: Google AI Studio API Key beginner guide](https://lilys.ai/en/notes/google-ai-studio-20251212/google-ai-studio-api-key), [wedevs: Generate Gemini API Key without credit card](https://wedevs.com/blog/510096/how-to-generate-gemini-api-key/), [apideck: How to Get Your Gemini API Key](https://www.apideck.com/blog/how-to-get-your-gemini-api-key)

No in-app deep link from a third-party chat app straight to
`aistudio.google.com/apikey` with a pre-filled project or scope was found
in this research — every BYOK app reviewed above sends the user out to the
provider's own console unassisted. **Unverified / apparent gap**: none of
TypingMind, Msty, Chatbox, BoltAI, Jan, LibreChat, or Pal appear to deep
link directly to Google's key-creation page from within their own
Gemini-provider setup screen (only generic "get your key" mentions were
found — not confirmed as a tappable in-app deep link for any of them).

### Value before signup or connection

**Excalidraw** — Full, unrestricted product with no signup, no confirmation
email, no OAuth — the complete tool is what you land on. Source: [dev.to: Excalidraw no login required](https://dev.to/nologintools/excalidraw-free-online-whiteboard-no-login-required-25j5)

**Figma Community** — Files can be browsed and previewed with no account;
the account wall appears specifically at "duplicate into your own
workspace," not at browsing. Paid Community files add a "Get free preview"
step so you can see inside before buying. Source: [Figma: Duplicate Community files](https://help.figma.com/hc/en-us/articles/360038510873-Duplicate-Community-files)

**Notion templates** — Same shape as Figma: preview freely in the gallery;
duplicating (keeping a working copy with its sample content intact and
fully editable) requires being signed in. Source: [Notion: ultimate guide to templates](https://www.notion.com/help/guides/the-ultimate-guide-to-notion-templates)

No consumer-facing AI chat app with a genuine no-signup "canned demo
conversation" (i.e., a scripted sample chat you can play with before
providing any key) was found in this pass — search results in this
category returned only enterprise/developer demo sandboxes (Azure AI
Search's fictitious-health-plan demo, AWS App Studio, Oracle APEX sample
datasets), none of them a consumer BYOK chat product. **Gap noted, not
filled**: this may be worth Gambit differentiating on, since none of the
BYOK chat apps surveyed above appear to let a user experience a real
sample conversation before they've supplied a key. Source: [Microsoft Learn: Chat with your data demo](https://learn.microsoft.com/en-us/azure/search/resource-demo-sites)

### Setup-for-someone-else patterns

**Chrome Remote Desktop (family tech support)** — One-time asymmetric
setup: the helper installs and registers the *other* person's computer to
their own Google account once ("it takes a bit to install, but once set
up, parents just click on Remote Desktop in Chrome, give you a code, accept
the connection and you're in"). After that one-time cost, all future
sessions require only that the helped person's machine be on — no repeated
setup burden on the non-technical side. Source: [bruceb.com: Set Up Remote Access To Help Your Parents](https://www.bruceb.com/2021/02/set-up-remote-access-to-help-your-parents-with-their-computer/)

**TeamViewer (family tech support)** — Same asymmetric shape: install on
both machines once, with the parent's side able to be configured to launch
automatically at startup so "your parent doesn't have to do anything
besides making sure the computer is turned on." First-time setup explicitly
recommends doing it together, in person or on a call, rather than mailing
instructions for the parent to follow alone. Source: [TeamViewer: How to help your parents with remote access](https://www.teamviewer.com/en-us/insights/remote-access-help-parents/)

**Apple Family Setup (Watch)** — The organizer (a family member with an
iPhone) does the entire pairing flow from their own phone; the person who
will actually use the device never needs their own iPhone at all — the
whole setup is designed to be completed by someone else, on someone else's
hardware, on the beneficiary's behalf. Requires a Family Sharing group and
an Apple Account already existing for the beneficiary. Source: [Apple Support: Set up Apple Watch for a family member](https://support.apple.com/en-us/109036)

No sourced example of a prefilled-config deep link specifically for handing
someone a ready-to-paste API key setup (e.g., a link that opens an app with
a provider and redirect pre-selected) was found for any BYOK product in
this research pass — **unverified / apparent gap**. The closest verified
analogue is generic app-invite deep-linking infrastructure (Branch,
AppsFlyer) used for referral/invite flows, not specifically for handing off
a model API key setup task.

---

## Sources

- https://boltai.com/docs/start/setup
- https://boltai.com/docs/guides/how-to-create-an-openai-api-key
- https://manual.raycast.com/ai/bring-your-own-key
- https://docs.typingmind.com/manage-and-connect-ai-models/set-up-api-keys
- https://docs.typingmind.com/general-faqs
- https://msty-studio-docs.nuxt.dev/getting-started/onboarding
- https://byoklist.com/tool/msty.app
- https://chatboxai.app/en/guide/getting-started/first-chat
- https://chatboxai.app/en/guide/byok/openai
- https://www.jan.ai/docs/desktop/quickstart
- https://www.librechat.ai/docs/quick_start/local_setup
- https://www.librechat.ai/docs/configuration/authentication
- https://docs.openwebui.com/getting-started/quick-start/connect-a-provider/
- https://www.aibucket.io/tools/pal-chat
- https://zed.dev/docs/ai/use-api-access
- https://github.com/brianpetro/obsidian-smart-connections
- https://community.obsidian.md/plugins/copilot
- https://ai.google.dev/gemini-api/docs/api-key
- https://lilys.ai/en/notes/google-ai-studio-20251212/google-ai-studio-api-key
- https://wedevs.com/blog/510096/how-to-generate-gemini-api-key/
- https://www.apideck.com/blog/how-to-get-your-gemini-api-key
- https://dev.to/nologintools/excalidraw-free-online-whiteboard-no-login-required-25j5
- https://help.figma.com/hc/en-us/articles/360038510873-Duplicate-Community-files
- https://www.notion.com/help/guides/the-ultimate-guide-to-notion-templates
- https://learn.microsoft.com/en-us/azure/search/resource-demo-sites
- https://www.bruceb.com/2021/02/set-up-remote-access-to-help-your-parents-with-their-computer/
- https://www.teamviewer.com/en-us/insights/remote-access-help-parents/
- https://support.apple.com/en-us/109036
- https://community.openai.com/t/i-have-credits-but-i-still-get-you-exceeded-your-current-quota/928972
- https://github.com/agent0ai/agent-zero/issues/1111
- https://costgoat.com/pricing/openrouter-free-models
