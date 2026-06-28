---
name: loom-init
description: One-time Loom bootstrap for a project — synthesize docs/loom/project.md from existing context (AGENTS.md, README, manifests, any OpenSpec config) and, if an OpenSpec tree exists, import its specs and changes with confirmation. Use once right after running install.sh, or when the user says initialize, bootstrap, set up, or onboard Loom in this repo.
---

# loom-init

Run this once per project, after `install.sh`. It reads what the project already knows and lays down
Loom's starting state. It is a comprehension task, not a code change — it writes docs, never source.

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
