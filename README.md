# G A M B I T ⭐ A.I.

![Gambit](https://raw.githubusercontent.com/skyf0xx/gambit/master/assets/banner.jpg)

## Planning your next move?

Starting a business, organizing a campaign, **changing your life**.

Trying to **make something happen**.

**Gambit is a strategist** that helps you think it through, **make better decisions, and get it done.**

Figure out:

- What truly matters
- What to do next
- Who you need
- What you don't know
- What could go wrong
- And whether you're actually making progress.

## Get 10X better outcomes for your goals

Use Gambit for almost anything:

- **Business**: find opportunities, make decisions, execute
- **Marketing**: sharpen your strategy and messaging
- **Fitness**: set goals, build a plan, stay on track
- **Life goals**: work out what matters and what to do about it
- **Anything you can imagine**: Gambit helps you think clearly and move forward

## Why Gambit works

<img src="https://raw.githubusercontent.com/skyf0xx/gambit/master/assets/plan.jpg" alt="A strategic execution plan annotated with leverage points, dependencies, and constraints">

### Gambit combines powerful frameworks for:

- **Strategy & systems thinking**: understand the bigger picture and what actually drives outcomes
- **Decision-making & forecasting**: make better calls under uncertainty
- **Risk & red-teaming**: expose weaknesses before they become problems
- **Stakeholder analysis & negotiation**: understand people, incentives, and competing interests
- **Planning & execution**: turn strategy into concrete next steps
- **Experimentation & after-action review**: test, learn, adapt, and improve

**Better thinking. Clearer decisions. Plans you can execute today.**

## What it is

Gambit is a local-first web app (PWA). Chat with an agent that runs
Gambit's strategy skills — onboarding, strategy setting, planning,
threat/premortem, stakeholder mapping, negotiation prep, forecasting, and
more — next to a live dashboard of your goal. There's no backend and no
account: your goal, your chat history, and your model API key live only in
your browser.

## The skills

| Group | Skills |
|---|---|
| Orient | `onboard`, `brief`, `status` |
| Direct | `strategy`, `systems`, `plan`, `decide` |
| Establish | `experiment`, `forecast` |
| Stress | `threat`, `premortem`, `exposure`, `capacity` |
| People | `stakeholders`, `negotiate`, `comms` |
| Assess | `eval`, `review` |

See `AGENTS.md` for what each skill does and how they fit together.

## Privacy and how it stores data

- **Local-first.** Your goal, chat history, and API key are stored in your
  browser's IndexedDB. Nothing is sent anywhere except the model provider
  you configure, and only when you send a message.
- **Your own key.** Bring a key for Anthropic, OpenAI, OpenRouter, or any
  OpenAI-compatible endpoint. The app never sees or stores it anywhere but
  your own browser.
- **No analytics, no accounts.** Nothing about your usage is collected or
  transmitted.
- **Strict Content-Security-Policy.** The build ships a locked-down CSP
  that only allows network calls to your configured model provider.
- **Export / import.** Your goal and settings can be exported to a file and
  re-imported later, or on another device.

## Use the hosted app

`https://<your-vercel-domain>` — the app is deployed on Vercel. Open it,
add your model API key in Settings, and start a goal.

## Run it locally

```bash
npm install
npm run dev
```

## Deploy your own

Import this repository into Vercel. `vercel.json` at the repo root sets
the build command, output directory, and headers — no other configuration
is required.

If you're routing model API calls through your own proxy rather than
calling providers directly from the browser, set `VITE_EXTRA_CONNECT_SRC`
as a build-time environment variable to the proxy's origin, and update the
`Content-Security-Policy` in `vercel.json` to match (a test enforces that
the two stay in sync).

## License and attribution

MIT licensed — see `LICENSE`.

Gambit's elicitation method catalog is vendored from
[BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD)
(`apps/pwa/vendor/BMAD/`) — see `ATTRIBUTION.md` there for the pinned
source, license, and any local changes.
