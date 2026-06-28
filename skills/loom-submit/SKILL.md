---
name: loom-submit
description: Verify a built Loom change, archive it on green, and open (or update) a PR that becomes the human acceptance gate — a draft PR when verification fails, a ready PR when it passes. Owns all forge-specific and outward-facing actions; never edits code. Use when the user says submit, ship, open a PR/MR, or finish/land an applied Loom change.
---

# loom-submit

The publish stage. `loom-apply` built the change on its branch; this step **verifies** it,
**archives** it on green, and opens the **PR** that serves as the human acceptance gate. It owns every
outward-facing and forge-specific action — `loom-apply` never pushes or opens PRs. It **never edits
code**: if verification fails it reports; fixing is `loom-apply`'s job.

Run from inside the change's worktree (`.loom-worktrees/<slug>/`).

## Verify — the gate

Three **mechanical** checks decide draft-vs-ready and archive-or-not:

1. Every `intent.md` "Done" line is demonstrably met.
2. Every `behavior.md` scenario has a materialized test (or, for a prose change, is encoded).
3. The full suite is green — use the commands from `docs/loom/project.md`.

A fourth, **plan-drift**, is a judgment: read `plan.md` against the diff. If the implementation
diverged, note it — but this is a **warning**, never a hard fail.

## Archive — only on green

If all three mechanical checks pass, archive the change **inside the branch**: move
`docs/loom/changes/<slug>/` → `docs/loom/changes/archive/<YYYY-MM-DD>-<slug>/` (suffix `-2` on
collision) and commit. Merging the PR carries the archive to `main` atomically — there is no merge
hook and none is needed (see ADR 0002). If any mechanical check fails, **do not archive**.

## Push and open (or update) the PR

Rebase the change branch onto the latest `main` and re-run verify, so collisions with already-merged
changes surface here rather than at merge time. Then push the branch and:

- **Green** → a **ready** PR. Body = `acceptance.md` (the human acceptance checklist).
- **Red** → a **draft** PR. Body = which mechanical check failed and where, plus any acceptance
  residue. Draft is the safety: visible on the dashboard, not mergeable.
- **Drift** → a warning section in the body either way; it never flips a green PR to draft.

**Re-runnable:** if a PR already exists for this branch, **update it** rather than open a duplicate —
and flip **draft → ready** once the change is green. When review bounces a change, `loom-apply`
reworks it in place and you re-run submit.

## Forge specifics

The forge and repo come from `docs/loom/project.md`; the API token comes from an **env var**, never
from `project.md`. Follow the matching reference for exact commands:

- GitHub → [reference/github.md](./reference/github.md)
- Codeberg / Forgejo / Gitea → [reference/codeberg.md](./reference/codeberg.md)
- GitLab → [reference/gitlab.md](./reference/gitlab.md)

## Hand-off

Report the PR URL and whether it is draft or ready. The human reviews, runs the acceptance checklist,
and **merges** — that merge is the acceptance, and it lands the archive on `main`. Suggest
`/loom-explore` for the next change.
