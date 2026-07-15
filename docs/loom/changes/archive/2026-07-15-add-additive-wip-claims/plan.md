# Plan — Add additive WIP Claims

## Approach
Extend the existing skill-and-reference Board interface rather than adding executable coordination code. `/loom-implement` owns forge-neutral Claim invariants; each forge reference supplies concrete discovery, label mutation, requeue, and handoff commands. `/loom-propose` provisions the fifth label. POSIX shell installer tests exercise the installed skill payload as the public product surface.

ADR 0007 defines Claims as durable, additive, advisory markers and supersedes ADR 0003's single-worker concurrency assumption.

## Module shapes & seams
- `/loom-implement` skill: interface `select → claim → build → present`; hides forge command details behind linked Board references. Invariants: filter `loom:wip` before selection, touch no Change before a proven Claim, retain interrupted Claims, and release only after implementor eligibility ends. Seam: installed agent instruction — test through installed skill content.
- `/loom-propose` skill: interface `publish(Change)`; hides idempotent forge label setup in Board references. Invariant: all five labels exist before publishing. Seam: installed agent instruction — test through installed skill content.
- Board reference per forge: interface comprising label setup, candidate discovery, Claim, human requeue, and review handoff commands; hides CLI/API differences. Seam: true-external forge documentation — verify command contracts hermetically in installer tests and leave live forge execution as acceptance residue.
- Codeberg label operations: internal interface `label name → numeric repository label ID`; invariant: every Forgejo add/replace/remove request sends numeric IDs while preserving additive lifecycle state where required. Tested at the installed Codeberg reference seam.

## Pinned decisions
- Support GitHub, GitLab, and Codeberg consistently; no forge-specific Claim semantics.
- Filter WIP objects before rework preference, oldest-first ordering, and result limiting.
- Add `loom:wip` without replacing `loom:ready` or `loom:rework`.
- Treat definite and ambiguous Claim failures as fail-closed; do not touch the Change.
- Never auto-expire or auto-release interrupted Claims; only a human requeues by removing `loom:wip`.
- New work hands off in order: open review PR, close ready issue, then remove the issue Claim.
- Rework hands off by replacing `loom:rework + loom:wip` with `loom:review` when ready.
- A handoff is complete only when reviewer eligibility and Claim cleanup are both observable; partial handoff is reported as incomplete.
- Accept simultaneous-selection races. Do not add locks, leases, claimant identity, or a runtime. See ADR 0007.
- Do not modify Worker console code or `loom_workers.exs`.

## Sequence
1. Add installed-payload tests for five-label setup and Claim invariants.
2. Update forge-neutral skills and each forge reference until those tests pass.
3. Correct Codeberg mutations to resolve and send numeric label IDs.
4. Update orientation and workflow capability documentation.
