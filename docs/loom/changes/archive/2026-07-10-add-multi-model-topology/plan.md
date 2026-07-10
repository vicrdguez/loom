# Plan — Add the multi-model topology (board-coordinated workers)

## Approach
Two new worker skills plus an on-demand publish tail on `loom-propose`, all built on the existing
pipeline. The "shared cores" from ADR-0003 materialize the Loom way — **by composition, not copying**:
`loom-implement` follows `loom-apply`'s TDD loop, and `loom-review` follows `loom-submit`'s verify +
archive, exactly as `loom-explore` composes `loom-domain`/`loom-design`. No core logic is duplicated
and no existing skill is rewritten. Forge work reuses `loom-submit`'s per-forge reference pattern.

## Module shapes & seams
<!-- The skills are the modules; their interface is the board contract they honor. -->
- **`loom-propose` publish tail**: interface `(proposed change on branch, explicit publish request) →
  pushed branch + open loom:ready issue`. Hides forge specifics behind per-forge references; reuses the
  `## Forge` config; ensures the four labels first (idempotent). Seam: forge (token via env). Invariant:
  no publish request ⇒ zero forge writes (single-model path byte-for-byte unchanged).
- **`loom-implement`** (implementor worker): interface `(loom:ready issue | loom:rework PR) → pushed PR
  labeled loom:review, issue closed`. Composes `loom-apply` for the build. Seam: forge. Invariant: it
  **never** verifies, archives, or applies `loom:done` — it only presents work.
- **`loom-review`** (reviewer, standing stage): interface `(loom:review PR) → loom:done (+archive) |
  loom:rework (+PR comments)`. Composes `loom-submit`'s verify + archive; adds adversarial
  test-strength review and the target project's quality skills. Seam: forge + the project's own review
  skills. Invariant: it **never edits code**; on fail it only comments + relabels.
- **Board protocol** (internal, shared vocabulary): four labels; the artifact type carries the phase
  (open issue = to-build, PR = in-review); exactly one active board object per change (issue XOR PR),
  the implementor closing the issue when it opens the PR. Invariant: the builder never blesses — review
  never runs in the context that built the change.

## Pinned decisions
<!-- Already decided in explore / ADR-0003; the implementer must not relitigate these. -->
- One pipeline, two topologies, built from **shared cores by composition, not parallel flows**. (ADR-0003)
- **Trust boundary**: the builder never verifies/archives/blesses; review never runs in the build
  context — a different *model* in multi-model, a fresh *context* of the same model in single-model.
  (ADR-0003)
- **No mode flag.** Topology is per-change and emergent; `loom-propose` publishes only on explicit
  request; publishing reuses the existing `## Forge` config — no new config in body or frontmatter.
- **Four labels**, `loom:ready/review/rework/done`; the implementor closes the change issue when it
  opens the PR (one active board object per change).
- **Reviewer**: guilty-until-proven; judges test strength (would it fail if the behavior broke?); uses
  the target project's own quality skills; feedback via PR comments; **never edits code**. Independent
  test re-derivation is an opt-in escalation, not the default.
- **Single-model review runs in a fresh context** — a separate `/loom-review` invocation or a spawned
  reviewer sub-agent.
- **Concurrency out of scope** — assume ≤1 worker per role; the forge board is a safe-enough queue only
  under that assumption. (ADR-0003)
- Forge specifics live in **per-forge reference files, token via env**, consistent with `loom-submit`.
- `AGENTS.md` is the workflow's **living summary**; no separate capability doc.
- `loom-apply` and `loom-submit` are **not edited** — the workers compose them; their single-model
  behavior is unchanged.

## Sequence
1. `loom-propose` publish tail + label bootstrap.
2. `loom-implement` (composing `loom-apply`) + per-forge board references.
3. `loom-review` (composing `loom-submit`) + fresh-context requirement.
4. `README.md` + `AGENTS.md` describe the topology.
