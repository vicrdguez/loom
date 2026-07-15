# Add reviewer WIP Claims

## Why
`loom:review` PRs expose no durable evidence that a reviewer has started. Two reviewer Workers can
therefore review the same Change concurrently, duplicate expensive verification, and race conflicting
`loom:done` and `loom:rework` handoffs.

## What
Extend Loom's additive `loom:wip` Claim protocol to reviewers. A reviewer selects an unclaimed
`loom:review` PR, adds `loom:wip` before accessing the Change, and retains that Claim until a
successful review handoff or explicit human requeue.

## Scope
- Reviewer selection and Claim instructions in `loom-review`
- Symmetric reviewer discovery, Claim, requeue, and handoff commands for GitHub, GitLab, and Codeberg
- Fail-closed handling for unsuccessful or ambiguous reviewer Claims
- Human requeue for interrupted reviews
- Installed orientation, workflow documentation, and dependency-free command-contract tests

## Out of scope
- Changes to implementor Claim behavior
- Worker console or scheduler implementation
- Atomic locks, claimant identity, leases, expiry, or automatic requeue
- New Board labels or forge integrations
- Automatic retry of a claimed review

## Definition of Done
- Reviewers exclude `loom:review + loom:wip` PRs before age ordering and one-item selection on every
  supported forge.
- A reviewer adds `loom:wip` without replacing `loom:review` and touches no Change until the Claim is
  proven successful.
- Failed, ambiguous, or interrupted review Claims remain safe: no unclaimed Change is touched, and a
  successful interrupted Claim remains until a human removes only `loom:wip`.
- Passing review hands `loom:review + loom:wip` to `loom:done`; failing review comments first, then
  hands it to `loom:rework`; both remove `wip` only when reviewer eligibility ends.
- Partial handoffs are reported as incomplete instead of silently releasing the Claim.
- Installed skills, forge references, orientation, tests, and the workflow capability consistently
  describe Claims for both implementors and reviewers.
