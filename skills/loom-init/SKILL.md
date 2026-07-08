---
name: loom-init
description: One-time Loom bootstrap for a project — scaffold docs/, inject the AGENTS.md orientation block, then synthesize docs/loom/project.md from existing context (AGENTS.md, README, manifests, any OpenSpec config) and, if an OpenSpec tree exists, import its specs and changes with confirmation. Use once right after installing Loom (Claude Code plugin or install.sh), or when the user says initialize, bootstrap, set up, or onboard Loom in this repo.
---

# loom-init

Run this once per project, right after installing Loom — whether via the Claude Code plugin
(`/plugin install loom@loom`) or `install.sh`. It reads what the project already knows and lays down
Loom's starting state. It is a comprehension task, not a code change — it writes docs, never source.

## 0. Scaffold the project structure

`install.sh` does this when it runs, but the Claude Code plugin install does not — so make it
idempotent and always ensure it here. Re-running must never duplicate or clobber existing content.

- **Directories:** create `docs/adr/`, `docs/capabilities/`, and `docs/loom/changes/archive/` if
  absent.
- **AGENTS.md orientation block:** ensure the Loom section (the content of `AGENTS.tmpl.md`, delimited
  by `<!-- LOOM:START -->` … `<!-- LOOM:END -->`) is present. Source the block verbatim from
  `AGENTS.tmpl.md` — it sits at the checkout root, or at `${CLAUDE_PLUGIN_ROOT}/AGENTS.tmpl.md` for a
  plugin install. If `AGENTS.md` already has the markers, replace what's between them; if it exists
  without them, append the block; if there's no `AGENTS.md`, create it from the template.
- **CLAUDE.md import:** ensure `CLAUDE.md` imports the instructions — it must contain `@AGENTS.md`
  (create `CLAUDE.md` with that single line if missing).

If `install.sh` already ran, every check above is a no-op. Report only what you actually created.

## 1. Synthesize `docs/loom/project.md`

Read whatever exists and distill it into `docs/loom/project.md` (the on-demand config the other
skills rely on):

- `AGENTS.md` / `CLAUDE.md` — existing conventions and instructions.
- `README*`, and build/test manifests (`mix.exs`, `package.json`, `Cargo.toml`, `pyproject.toml`,
  `Makefile`, CI config) — the stack and the **test / build / lint commands**.
- Any `openspec/project.md` or `openspec/config.yaml` — prior project context.

Capture: stack & versions, how to run tests / build / lint, key conventions, and notable
constraints. Keep it tight; ask the user only for commands you genuinely can't infer.

## 2. Import an existing OpenSpec tree (if present)

If `openspec/` exists, follow [reference/import-openspec.md](./reference/import-openspec.md):

- `openspec/specs/*` → `docs/capabilities/*` (they're already capability-shaped behavior docs).
- `openspec/changes/<active>` → `docs/loom/changes/<slug>/` (remap `proposal.md`→`intent.md`, keep
  `tasks.md`; deltas become the change's `behavior.md` context).
- `openspec/changes/archive/*` → `docs/loom/changes/archive/<date>-<slug>/` — **only with the user's
  confirmation** (history can be large; offer a list and let them choose all / some / none).

## 3. Guardrails

- **Never reverse-engineer specs from source code.** Inventory what exists; do not invent behavior
  docs the project didn't already have. Specs accrue through real changes via `loom-propose`.
- **Don't eagerly build `CONTEXT.md`.** The glossary stays lazy — it's built term-by-term in
  `loom-explore`. You may *list candidate domain terms* you noticed, but don't write the glossary.

## Hand-off

Report what was synthesized and imported. Then: "Loom is set up. Start your first change with
`/loom-explore`."
