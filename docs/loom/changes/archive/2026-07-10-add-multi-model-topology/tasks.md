# Tasks — add-multi-model-topology

<!--
NOTE: this is a prose change. "Behavioral" tasks below each materialize into SKILL.md instructions
(and README/AGENTS prose), not red-green tests. Their ids still trace to behavior.md scenarios for
coordination. The new skills install by glob, so install.sh and its tests are untouched.
-->

## Behavioral  (one per scenario → encoded as skill / doc prose)
- [x] B1  Publish opens a ready issue pointing to the branch        → behavior.md §Propose/1
- [x] B2  Publish ensures the four labels exist first (idempotent)  → behavior.md §Propose/2
- [x] B3  Without a publish request, propose stays local            → behavior.md §Propose/3
- [x] B4  Claim a ready issue and build test-first (composes apply) → behavior.md §Implement/1
- [x] B5  Open the PR (loom:review) and close the issue             → behavior.md §Implement/2
- [x] B6  Implement never blesses its own work                      → behavior.md §Implement/3
- [x] B7  Pick up a rework bounce, push to the same PR              → behavior.md §Implement/4
- [x] B8  Review verifies independently, not on trust              → behavior.md §Review/1
- [x] B9  Review judges test strength, not mere presence           → behavior.md §Review/2
- [x] B10 Review grounds quality in the project's own skills        → behavior.md §Review/3
- [x] B11 Pass → land (archive + finalize) + loom:done              → behavior.md §Review/4
- [x] B12 Fail → loom:rework, PR-comment feedback, no code edits    → behavior.md §Review/5
- [x] B13 Single-model review runs in a fresh context              → behavior.md §Standing/1
- [x] B14 Human merge of a loom:done PR is the acceptance gate      → behavior.md §Standing/2

## Chores  (non-behavioral work)
- [x] C1  Author `loom-implement` SKILL.md — claim ready/rework → compose loom-apply → push → open PR
          `loom:review` → close issue; the never-blesses invariant
- [x] C2  Author `loom-review` SKILL.md — claim `loom:review` → independent verify (compose loom-submit)
          → guilty-until-proven review (test strength + project quality skills) → pass: land + `done`,
          fail: `rework` + PR comments, no code edits; the fresh-context requirement for single-model
- [x] C3  Edit `loom-propose` SKILL.md — add the on-demand publish tail (ensure labels → push branch →
          open `loom:ready` issue with a thin pointer), reusing the `## Forge` config
- [x] C4  Board/forge references for issue + label + close operations (per-forge, token via env),
          consistent with `loom-submit`'s per-forge pattern — shared or per-worker as apply decides

## Docs
- [x] D1  Update `README.md` — describe the two topologies, the workers, the board + four labels,
          review as a standing model stage, and the per-change/no-flag nature
- [x] D2  Update `AGENTS.md` (+ `AGENTS.tmpl.md` if present) — the workflow's living summary gains the
          multi-model topology, `loom-implement`/`loom-review`, the board, and review-as-standing-stage
<!-- No capability-doc task: AGENTS.md is the workflow's living summary (see plan.md). CONTEXT.md terms
and ADR-0003 were already written during explore. install.sh / tests unchanged (skills install by glob). -->
