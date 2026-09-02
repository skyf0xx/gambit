# G A M B I T

![Gambit](https://raw.githubusercontent.com/skyf0xx/gambit/master/assets/banner.jpg)

## Plan your next move

Maybe you're starting a business, getting a
campaign off the ground or just trying to get your own life in order.

Gambit is a set of skills for **thinking it through and getting it done**.

Figure out:

- What truly matters
- What to do next
- Who you need
- What you don't know
- What could go wrong
- And whether you're actually making progress.

## Gambit under the hood

<img src="https://raw.githubusercontent.com/skyf0xx/gambit/master/assets/plan.jpg" alt="A strategic execution plan annotated with leverage points, dependencies, and constraints">

Gambit combines established frameworks for:

- **Strategy & systems thinking**
- **Decision-making & forecasting**
- **Research & intelligence**
- **Risk & red-teaming**
- **Stakeholder analysis & negotiation**
- **Planning & execution**
- **Experimentation & after-action review**

Use Gambit for: **better thinking, clearer decisions, and a plan you can actually get done.**

## Install

**Claude Code, Cursor and Gemini CLI** (global install)

```bash
/plugin marketplace add skyf0xx/gambit
/plugin install gambit@gambit
```

**Any other AGENTS.md-reading agent** (local install)

```bash
npx @skyf0xx/gambit init
```

Then just tell your agent what's on your mind e.g. "help me plan... [your goal]"

## Managing multiple goals

```bash
npx @skyf0xx/gambit list             # goals, with the active one marked
npx @skyf0xx/gambit new "<title>"    # create a goal, make it active
npx @skyf0xx/gambit switch <slug>    # change the active goal
npx @skyf0xx/gambit path             # print the resolved GOAL.json path
npx @skyf0xx/gambit adopt            # move an existing ./GOAL.json into the store
npx @skyf0xx/gambit delete <slug> --force   # permanently delete one goal
npx @skyf0xx/gambit delete --all --force    # permanently delete every goal
npx @skyf0xx/gambit visualize        # open a local, auto-refreshing diagram view of the active goal
```
