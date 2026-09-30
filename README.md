# Gambit

**The notebook that thinks back.**

![Gambit](https://raw.githubusercontent.com/skyf0xx/gambit/master/assets/banner.jpg)

Stuck on something hard? Changing careers, starting a business, running a
campaign, and going in circles on what to do next?

Gambit is a strategist you think it through with. It asks the questions
you've been avoiding, tells you where the plan is weak, and writes it all
down on one page beside the chat: your plan, risks, decisions, the people
involved, and whether you're actually making progress.

Every conversation ends with your next move.

**[Open Gambit →](https://<your-vercel-domain>)**

## What it helps with

- **Deciding.** Work an open choice down to a call you can stand behind.
- **Planning.** Turn a goal into the next few concrete steps.
- **Finding weak spots.** Imagine it failed, then work out why, before it does.
- **People.** Map who matters, and prepare for the hard conversation.
- **Checking progress.** An honest read on whether you're on track.

It uses methods professional planners use (premortems, red-teaming,
negotiation prep, forecasting) without making you learn them.

## Private by design

No account and no server. Your goals, chats, and key stay in your browser.
You bring an API key from Anthropic, OpenAI, OpenRouter, or any
OpenAI-compatible provider, and pay them directly for what you use.

## For developers

Local-first PWA (Vite, React, Dexie). The agent runs in the browser and
talks only to the provider you configure, enforced by a strict CSP.

```bash
npm install
npm run dev
```

Deploy your own by importing the repo into Vercel; `vercel.json` handles
the rest. To route model calls through a proxy, set
`VITE_EXTRA_CONNECT_SRC` at build time and match the CSP in `vercel.json`
(a test keeps them in sync).

How the skills and goal record work: [AGENTS.md](AGENTS.md).

## License

MIT. The elicitation method catalog is vendored from
[BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD); see
`apps/pwa/vendor/BMAD/ATTRIBUTION.md`.
