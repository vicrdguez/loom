# Add additive WIP Claims

## Why
Board implementors can select the same `loom:ready` issue or `loom:rework` PR because lifecycle labels do not show that another implementor has already started. Duplicate pickup wastes work, while automatic claim expiry would hide interrupted work and require lease machinery.

## What
Add `loom:wip` as a durable, additive Claim marker across Loom's GitHub, GitLab, and Codeberg Board instructions, without introducing a runtime or atomic ownership protocol.

## Scope
- Ensure Board publishing creates the fifth `loom:wip` label.
- Make implementors exclude claimed objects before preference, age ordering, and result limiting.
- Require a successful additive Claim before an implementor touches a Change.
- Preserve interrupted or ambiguous Claims until explicit human requeue.
- Remove Claims only after a Change is no longer eligible for implementation and is ready for review.
- Keep forge-specific query and label operations correct for GitHub, GitLab, and Codeberg.
- Install and document the five-label Board model consistently.

## Out of scope
- Worker console behavior or code.
- The untracked `loom_workers.exs` scheduler.
- Atomic locks, claimant identity, leases, timeouts, or automatic requeue.
- Claims for reviewers or lifecycle stages other than `loom:ready` and `loom:rework`.
- Eliminating the race between simultaneous implementors that select before either Claim is visible.

## Done
- Installed Loom skills describe and provision all five Board labels on every supported forge.
- An implementor selects only objects without `loom:wip`, filtering before ordering and limiting results.
- A selected ready issue or rework PR keeps its lifecycle label while gaining `loom:wip` before any local Change access.
- A failed or ambiguous Claim attempt leaves the Change untouched.
- Failed or interrupted implementation retains `loom:wip` until a human removes only that marker.
- New implementation removes its Claim only after the review PR exists and its ready issue is closed.
- Rework replaces `loom:rework + loom:wip` with `loom:review` only when the Change is ready for review.
- A partial handoff is reported as incomplete rather than presented as success.
- Codeberg Claim operations resolve label names to the numeric IDs required by Forgejo.
- Durable orientation and workflow documentation consistently describe advisory additive Claims.
