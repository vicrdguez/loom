# Changes Ship via a Per-Change Worktree and PR

Each change is built on its own change branch in a gitignored `.loom-worktrees/<slug>/`, created at
`loom-propose`. `loom-apply` builds test-first, committing one logical commit per TDD slice (cheap,
reworkable history) and recording the human-checkable residue in `acceptance.md`. A separate
`loom-submit` step then **verifies** (automated: every intent "Done" line met, every behavior
scenario has a test, suite green, no drift from plan), **archives** the change *inside the branch*,
pushes, and opens the PR (forge-specific, configured in `docs/loom/project.md`).

The PR review is the **acceptance gate**: a human runs `acceptance.md` and merging the PR is the
acknowledgment. Because the archive move lives in the branch, merging brings it to `main` atomically
— there is no merge hook to archive after the fact, and none is needed. Durable docs are committed
wherever they are authored: `CONTEXT.md`/ADRs land on `main` during `loom-explore`; capability docs
are updated during `loom-apply` and ride the PR. Merged worktrees are garbage-collected
opportunistically at the next `loom-propose` (detected by the archive dir being present on `main`).

The alternatives rejected: committing/archiving directly on `main` in `loom-apply` (the original
flow — it silently finalized changes with no ratification and no git history worth reading); folding
PR creation into `loom-apply` (puts an outward-facing, forge-specific, CI-triggering act in the
decision-free step, and recreates the "silently finalize" smell); and a bespoke "acknowledge
`validation.md`" gate (the PR already *is* that gate).

## Consequences

Archiving happens *before* human acceptance, so it must be reversible: a change whose PR is sent back
for rework keeps living on its branch (archived in place) until merge — nothing is final until then.
Worktrees enable parallel changes for free, but two parallel changes touching the same capability doc
will conflict; this is left to git to resolve at merge time (tests are the tie-breaker), and
dependency detection between changes is explicitly out of scope. `loom-apply` no longer touches
`main`, archives, or git remotes; `loom-submit` owns all outward-facing and forge-specific actions,
keeping `loom-apply` forge-agnostic and safe to hand to a cheaper model.
