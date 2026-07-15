# Plan — Add reviewer WIP Claims

## Approach
Extend the merged additive Claim protocol at its existing instruction seam. `loom-review` owns the
forge-neutral invariant—select one unclaimed review, Claim before local access, retain interruption,
and release only through handoff—while the three Board references provide concrete commands. Extend
the existing dependency-free installed-payload tests before changing instructions.

## Module shapes & seams
- `loom-review` skill: interface `select → claim → review → handoff`; hides forge command details
  behind linked Board references. Invariants: filter `wip` before selection, touch no Change before a
  proven Claim, retain interrupted Claims, and remove `wip` only after reviewer eligibility ends.
  Seam: installed agent instruction — test through installed skill content.
- Board reference per forge: interface comprising reviewer discovery, Claim, human requeue, and
  `done`/`rework` handoff commands; hides CLI/API differences. Seam: true external — verify command
  contracts hermetically and leave live forge execution as acceptance residue.
- Installer payload: interface `install(project)`; hides Harness-specific copy locations. Seam:
  local-substitutable filesystem — install into temporary projects and inspect the resulting public
  skill/reference text.

## Pinned decisions
- Use the existing additive `loom:wip` marker for `loom:review`; lifecycle disambiguates the active
  Role. See ADR-0007.
- Filter `wip` before oldest-first ordering and result limiting on every forge.
- Add `wip` without replacing `review`; unsuccessful or ambiguous Claims fail closed.
- Never expire or auto-release an interrupted review; a human requeues by removing only `wip`.
- Pass removes `review + wip` in the handoff to `done`; fail publishes findings before removing
  `review + wip` in the handoff to `rework`.
- A partial handoff remains incomplete and reports the exact Board state; never deliberately remove
  `wip` before the target lifecycle transition, and do not claim atomicity, leases, or claimant identity.
- Apply this protocol to GitHub, GitLab, and Codeberg even though the dependent Pi Worker console
  initially polls GitHub only.

## Sequence
1. Add failing installed-payload and forge-command-contract tests.
2. Update `loom-review` and all three Board references.
3. Update orientation and the workflow capability, then record live-forge acceptance steps.
