# Attribution

This directory vendors a single data file from
[BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD)
(`bmad-code-org/BMAD-METHOD`), MIT-licensed. See `LICENSE` in this directory
for the full license text.

- **Source repo:** https://github.com/bmad-code-org/BMAD-METHOD
- **Vendored from:** tag `v6.11.0`, commit `890fcda760bade4d6080f5fa09aa8f658bc4a4a5`
- **Vendored on:** 2026-09-06
- **Module:** `bmm` (BMAD Method Module)

## What's vendored

`methods.csv` — the elicitation method catalog from
`core-skills/bmad-advanced-elicitation`, originally at
`core-skills/bmad-advanced-elicitation/assets/methods.csv` in the source
repo. It is vendored unmodified and adapted into the app's own `elicit`
skill, which reads it to offer named pressure-test methods at a checkpoint
(a goal statement, a plan, a risk read) before the user commits to it.
