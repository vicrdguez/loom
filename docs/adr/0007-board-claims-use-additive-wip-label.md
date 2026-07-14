# Board Claims Use an Additive WIP Label

An implementor Claims a `loom:ready` issue or `loom:rework` PR by adding `loom:wip` without replacing
its lifecycle label. Implementors exclude `wip` objects before selecting work, failed or interrupted
Claims remain visible until a human removes `wip` to requeue them, and successful handoff removes
`wip` only after implementor eligibility ends. This supersedes ADR 0003's single-worker concurrency
assumption: the marker reduces accidental duplicate pickup and preserves operator visibility without
introducing expiring leases or claimant identity, while deliberately remaining advisory rather than
an atomic ownership lock.
