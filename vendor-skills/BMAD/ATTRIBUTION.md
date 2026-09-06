# Attribution

This directory vendors a subset of [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD)
(`bmad-code-org/BMAD-METHOD`), MIT-licensed. See `LICENSE` in this directory
for the full license text.

- **Source repo:** https://github.com/bmad-code-org/BMAD-METHOD
- **Vendored from:** tag `v6.11.0`, commit `890fcda760bade4d6080f5fa09aa8f658bc4a4a5`
- **Vendored on:** 2026-09-06
- **Module:** `bmm` (BMAD Method Module)

Pinned to the same ref as the sibling project Hedgehog
(`/Users/williamgikandi/Documents/code/hedgehog/vendor-skills/BMAD/`), which
vendors a larger subset from the same upstream tag. Nothing enforces the two
stay in sync — a re-vendor pass on one project should prompt a check of the
other.

## What's vendored

Six skills from BMAD-METHOD's planning shelf, plus the two shared scripts
they depend on:

- `core-skills/bmad-forge-idea`
- `core-skills/bmad-brainstorming`
- `core-skills/bmad-advanced-elicitation`
- `core-skills/bmad-deep-recon`
- `bmm-skills/plan/bmad-product-brief`
- `bmm-skills/plan/bmad-prfaq`
- `scripts/memlog.py`, `scripts/resolve_customization.py` (shared utilities
  every vendored skill calls, originally at `src/scripts/` in the source
  repo)

Not vendored: `bmad-prd`, `bmad-ux` — neither has a module axis or UI surface
a personal/campaign goal maps onto. `bmad-party-mode` (the multi-agent
roster `bmad-forge-idea` can optionally draw on) is also not vendored, for
the same reason Hedgehog excludes it: a real roster needs BMAD's own
`bmm-skills/agents/bmad-agent-*` persona skills too, out of scope here.
`bmad-forge-idea` degrades gracefully without it — `resolve_personas.py`
returns an empty roster and the skill falls back to generating personas on
the fly, its documented normal path, not a degraded one.

Each skill directory carries its own templates, reference files, and
scripts as vendored, unmodified except where noted below.

`{bmad-root}` is a convention used across the vendored files, meaning this
directory (`vendor-skills/BMAD/`) — used to address the shared scripts
(`{bmad-root}/scripts/memlog.py`, etc.) without reaching outside this
vendored tree.

## Local changes (not upstream)

- `bmm-skills/plan/bmad-product-brief/customize.toml`'s `doc_standards`
  default (`["skill:bmad-review lenses=structure,prose"]` upstream) is
  stripped to `[]` — `bmad-review` isn't among the 6 vendored skills, and
  the entry is a dangling reference.
- `core-skills/bmad-deep-recon/customize.toml`'s `doc_standards` default
  (same upstream entry, `["skill:bmad-review lenses=structure,prose"]`) is
  stripped to `[]` for the same reason.
- `core-skills/bmad-brainstorming/customize.toml`'s `keepsake_format`
  workflow key (present upstream, `"html"` default) is set to
  `"markdown-only"` here rather than left at its default — Gambit's
  deliverables are markdown/prose (`GOAL.json` plus archive files), and an
  auto-generated, browser-opened HTML keepsake mid-onboarding is a worse
  interruption for a personal-goal conversation than for a
  software-planning one. A re-vendor pass must re-apply this override to
  the freshly-fetched file rather than letting it silently reset to
  `"html"`.
- `scripts/resolve_customization.py` gains a `BMAD_PROJECT_ROOT` env-var
  override, checked before its own `find_project_root(skill_dir) or
  find_project_root(Path.cwd())` directory walk. Verified by direct testing
  (not just reading) that the unmodified walk is unsafe for Gambit's
  install shape: `find_project_root(skill_dir)` is entirely cwd-independent
  — it always walks up from the vendored skill's fixed install location —
  and on this development machine it resolves to Gambit's own repo root
  (its `.git`) rather than any goal directory; installed globally via npm,
  it instead resolves to whatever git-managed directory happens to sit
  above the npm prefix (e.g. `~/.nvm`, itself a git clone on most
  installs). In both cases the intended cwd-fallback is never reached, so
  no goal directory's own `_bmad/` marker can ever be found this way. Every
  Gambit invocation of `uv run {bmad-root}/scripts/*.py` (and every BMAD
  skill invocation that shells out through it) sets `BMAD_PROJECT_ROOT` to
  the resolved `<goal-dir>` so this is moot in practice — see AGENTS.md's
  "Vendored BMAD skills" for the calling convention. The blast radius of
  the underlying bug is narrow (it only affects discovery of optional
  `_bmad/custom/*.toml` overrides — a feature no Gambit goal has used yet —
  not the skills' own prose-level activation reasoning), but the fix is
  cheap and removes a latent trap. A re-vendor pass must re-apply this
  patch to the freshly-fetched script.

Read at implementation time: `bmm-skills/plan/bmad-prfaq/customize.toml`,
`core-skills/bmad-forge-idea/customize.toml`, and
`core-skills/bmad-advanced-elicitation/customize.toml` carry no
`doc_standards` key and no other dangling `skill:` reference — no changes
needed there.

## Re-vendoring

Pinned deliberately. Re-vendoring against a newer BMAD-METHOD commit is a
manual act: repeat the fetch against the new ref, re-apply "Local changes"
above, update this file's pinned commit and date, and check whether
Hedgehog's own vendor tree should be re-vendored too.
