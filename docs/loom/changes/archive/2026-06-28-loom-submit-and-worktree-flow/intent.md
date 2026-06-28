# Ship changes via a worktree and PR (loom-submit)

## Why
After `loom-apply` the change is silently archived with nothing committed to git: no human
ratification, no reviewable history, no acceptance gate. The loop ends in a void, and there is no
way to run several changes at once or to monitor them anywhere but on the machine running the agent.

## What
Replace the tail of the loop. `loom-apply` builds each change in its own git worktree and stops at
code + capability doc + `acceptance.md`. A new `loom-submit` step verifies the change, archives it,
and opens a PR — and the PR review becomes the human acceptance gate. The worktree-per-change model
enables parallel changes for free.

## Scope
- New **`loom-submit`** skill: verify → (green) archive in branch → push → open PR; **draft** PR on
  red, **ready** PR on green; re-runnable so it updates the existing PR (flips draft→ready); all
  forge-specific work isolated in per-forge reference files selected by `project.md` config, with API
  tokens via env vars.
- **`loom-apply`** changes: one logical commit per TDD slice; write `acceptance.md` after
  implementation; work the change **in place** wherever it lives (`changes/` or `archive/`), sticky
  after first green; **never** touch `main`, the archive, or git remotes; no PR.
- **`loom-propose`** changes: commit any durable-doc stragglers to `main`, then cut the change branch
  in a gitignored `.loom-worktrees/<slug>/`; opportunistically GC worktrees of already-merged
  changes.
- New **`acceptance.md`** artifact, authored by `loom-apply`.
- Docs (prose deliverables): `AGENTS.md` loop + "where things live"; `README.md` loop table +
  executor paragraph; `docs/loom/project.md` forge config section.
- Already written during explore: `CONTEXT.md` Workflow terms, ADR 0002.

## Out of scope
- Dependency-detection or execution-ordering between parallel changes (the orchestrator's call;
  capability-doc collisions resolve at merge via git, tests as tie-breaker).
- Automated tests for skill prose, or extracting git mechanics into tested shell scripts — this is a
  prose change with no automated test surface.
- Auto-fixing on verify failure — `loom-submit` reports; `loom-apply` fixes.
- A dedicated capability doc for the workflow — `AGENTS.md` is its living summary.
- Merge automation — a human merges the PR.

## Done
- `loom-propose` commits pending durable-doc changes to `main`, then creates the change branch in a
  gitignored `.loom-worktrees/<slug>/`.
- `loom-propose` removes the worktree of any change already merged (its archive dir is present on
  `main`) before creating a new one, and leaves unmerged changes' worktrees intact.
- `loom-apply` commits one logical commit per TDD slice and never touches `main`, the archive, or git
  remotes.
- `loom-apply` writes `acceptance.md` capturing the human-checkable residue after implementation, and
  does not modify `intent.md`.
- `loom-apply` works a change wherever it currently lives and never moves it once archived.
- `loom-submit`, with the three mechanical checks passing, archives the change in the branch and opens
  (or updates to) a **ready** PR whose body contains `acceptance.md`.
- `loom-submit`, with any mechanical check failing, does not archive and opens (or updates to) a
  **draft** PR whose body reports which check failed and where.
- `loom-submit` reports plan-drift as a warning in the PR body without blocking or flipping to draft.
- Re-running `loom-submit` updates the change's existing PR instead of creating a duplicate, flipping
  draft→ready once the mechanical checks pass.
- `loom-submit` never modifies code, and selects forge-specific PR steps from per-forge reference
  files using `project.md` config and env-var tokens.
- `AGENTS.md` and `README.md` describe the `explore → propose → apply → submit` loop, `acceptance.md`,
  the change worktree, and the PR-as-acceptance-gate.
