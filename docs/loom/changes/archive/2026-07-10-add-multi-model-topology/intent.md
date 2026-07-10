# Add the multi-model topology (board-coordinated workers)

## Why
Loom's loop assumes one model does every stage. But `loom-apply` is decision-free by design and
already "safe to hand to a cheaper model," and an independent reviewer catches the blind spots a
single model blesses in its own work. There is no way today to hand a proposed change to one model to
implement, have a *different* model review it, and keep the human as the final gate.

## What
Add an opt-in **multi-model topology** where distinct models fill the pipeline's roles, coordinating
asynchronously through the **forge board** (issues + PRs + four labels). Introduce the `loom-implement`
and `loom-review` worker skills, give `loom-propose` an on-demand **publish** tail, and make **review a
standing model stage in both topologies**. There is no project-wide mode flag: topology is per-change
and emergent from what you run. See ADR-0003.

## Scope
- New **`loom-implement`** skill (implementor worker): claim a `loom:ready` issue or `loom:rework` PR →
  set up the branch → build test-first by composing `loom-apply` → push → open/update a PR labeled
  `loom:review`, closing the issue on first PR open. It **presents** work; it never blesses it.
- New **`loom-review`** skill (reviewer): claim a `loom:review` PR → run the mechanical verify
  independently + a guilty-until-proven code review (test strength + the target project's own quality
  skills) → **pass**: land (archive in branch + finalize) + `loom:done`; **fail**: `loom:rework` with
  feedback as PR comments, editing no code. A **standing** stage in both topologies; single-model runs
  it in a **fresh context**.
- **`loom-propose`** gains an on-demand **publish** tail: push the branch and open a thin `loom:ready`
  issue pointing to the brief on the branch; ensure the four labels exist first; reuse the existing
  `## Forge` config. Without a publish request it stays local, exactly as today.
- **Board protocol**: four labels (`loom:ready/review/rework/done`), the issue→PR handoff, the rework
  loop, and PR-comment feedback. Forge specifics live in per-forge reference files (token via env),
  consistent with `loom-submit`.
- **Docs**: `README.md` "The loop" section and `AGENTS.md` (the workflow's living summary) describe the
  two topologies, the workers, the board, review-as-a-standing-stage, and the per-change/no-flag nature.
- Already written during explore: `CONTEXT.md` topology terms, **ADR-0003**.

## Out of scope
- Concurrency / atomic-claim / races between workers — the design assumes ≤1 worker per role looping at
  a time (ADR-0003).
- A Loom orchestrator or runtime, and any automated model dispatch — the harness's own scheduler
  supplies the loop and the fresh context; Loom ships no runtime.
- A project-wide topology flag or per-change model pinning — topology is emergent from what you run.
- Dependency detection or ordering between parallel changes.
- Automated tests for skill prose — this is a prose change; the new skills install by glob, so
  `install.sh` and its tests need no change.
- Independent **test re-derivation** as the reviewer's default — it stays an opt-in escalation; the
  standing default is adversarial test-strength review.
- The reviewer applying fixes directly — deliberately rejected; it collapses the trust boundary.
- A separate capability doc — `AGENTS.md` is the workflow's living summary.

## Done
- `loom-propose`, when asked to publish, ensures the four labels exist, pushes the change branch, and
  opens a `loom:ready` issue pointing to the brief on the branch; without that request it pushes
  nothing and opens no issue.
- `loom-implement` claims a `loom:ready` issue (or a `loom:rework` PR), builds test-first by composing
  `loom-apply`, pushes, and opens/updates a PR labeled `loom:review`, closing the issue on first PR open.
- `loom-implement` never verifies, archives, or marks a change `loom:done` — it only presents work.
- `loom-review` claims a `loom:review` PR and re-runs the mechanical verify independently rather than
  trusting the implementor's green suite.
- `loom-review` reviews guilty-until-proven — judging whether each test would fail if the behavior
  broke, and grounding style/hygiene judgment in the target project's own quality skills.
- `loom-review`, on a pass, lands the change (archive in branch + finalize) and labels it `loom:done`;
  on a fail, it labels `loom:rework`, leaves findings as PR comments, and edits no code.
- `loom-review` runs in a fresh context in the single-model topology (a separate invocation or a
  spawned reviewer sub-agent), as the standing review stage before the human.
- Merging a `loom:done` PR is the final human acceptance gate.
- `README.md` and `AGENTS.md` describe the two topologies, the workers, the board and its four labels,
  review as a standing model stage, and the per-change/emergent (no-flag) nature.
