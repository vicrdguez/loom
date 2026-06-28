# Plan — Ship changes via a worktree and PR (loom-submit)

## Approach
Move the loop's finalization out of `loom-apply` and into a new `loom-submit` step. `loom-propose`
gains branch lifecycle (create the change worktree, GC merged ones). `loom-apply` becomes purely
build + docs + `acceptance.md`, forge-agnostic and never touching `main` or remotes. `loom-submit`
owns verification and everything outward-facing: archive (on green), push, and PR creation, with the
PR review acting as the human acceptance gate. The whole change is **prose edits to skill files** plus
README/AGENTS/project.md — there is no automated test surface (see ADR 0002 and Out of scope).

## Module shapes & seams
<!-- "Modules" here are the skills and the seams between them. -->
- **`loom-submit`** (skill): orchestrates `verify → archive(green) → push → open/update PR`.
  Forge interaction is the one true-external seam → isolated in per-forge reference files
  (`github.md`, `codeberg.md`, `gitlab.md`), selected by `project.md` config; tokens via env var.
  Invariant: nothing outward (push/PR) leaks code changes — it never edits code; archive happens only
  when the three mechanical checks pass.
- **verify** (internal to `loom-submit`): the gate. Three **mechanical** checks (every `intent.md`
  "Done" line met, every `behavior.md` scenario covered, suite green) decide draft-vs-ready and
  archive-or-not. The fourth, **plan-drift**, is an agent judgment surfaced as a *warning* only —
  never a hard block. Invariant: a mechanical failure ⇒ no archive, draft PR; mechanical pass ⇒
  archive, ready PR.
- **`loom-apply`** (skill): forge-agnostic build. Interface unchanged externally; now commits per
  TDD slice, writes `acceptance.md`, and locates the change wherever it sits (`changes/` or
  `archive/`). Invariant: never touches `main`, the archive directory, or git remotes; never modifies
  `intent.md`.
- **`loom-propose`** (skill): owns the change-branch lifecycle. Creates `.loom-worktrees/<slug>/` from
  `main` after committing durable-doc stragglers; GCs worktrees whose change archive is present on
  `main`. Invariant: runs from the `main` checkout, so it never removes the worktree it stands in.

## Pinned decisions
- The **PR review is the acceptance gate**; merging brings the in-branch archive to `main` atomically
  — there is no merge hook and none is needed. See ADR 0002.
- **Archive lives in the branch and only on green.** Red ⇒ draft PR, no archive. See ADR 0002.
- **Edit-in-place, sticky after first green.** `loom-apply` never moves a change back to `changes/`.
  Reason: determining "is this a rework vs. merged" would require querying the forge, and `loom-apply`
  must stay forge-agnostic.
- **`loom-apply` never touches `main`, the archive, or git remotes.** All outward/forge-specific
  actions live in `loom-submit` only.
- **Forge specifics are data, not logic**: per-forge reference files chosen by `project.md`; API
  tokens come from env vars and never live in `project.md`.
- **`intent.md` is frozen after `loom-propose`.** Post-implementation notes go to `acceptance.md`.
- **No capability doc for the workflow** — `AGENTS.md` is its living summary. `installation.md` is
  untouched (it keeps its capability-doc status because it has real tests).
- **Out: dependency-detection.** Parallel changes are the orchestrator's call; collisions resolve at
  merge with tests as the tie-breaker.

## Sequence
1. `loom-propose` — commit durable-doc stragglers to `main` → GC merged worktrees → create
   `.loom-worktrees/<slug>/`.
2. `loom-apply` — per-slice commits → update capability doc in the worktree → write `acceptance.md`.
3. `loom-submit` — verify → green: archive + ready PR (body = acceptance.md) / red: draft PR (body =
   failure report) → push; re-run updates the existing PR.
