<!-- LOOM:START -->
## Loom

Loom is a spec-light, test-first engineering workflow. It weaves a change from understanding →
behavior → tests → durable docs. **Tests are the behavior contract** (they run, so they can't
drift); the documents are how humans and agents stay oriented.

**Optional discovery** (before choosing a Change):
- `/loom-architecture` — scan read-only for architecture friction, render a temporary visual report,
  and hand the selected candidate into `/loom-explore`.

**Loop** (run `/loom-init` once per project, then per change):
- `/loom-explore` — grill the change into shared understanding; sharpen `CONTEXT.md`, record ADRs.
- `/loom-propose` — cut the change branch (worktree), write the brief: `intent.md`, `behavior.md`
  (always); `plan.md`, `tasks.md` (when warranted).
- `/loom-apply` — build it test-first from the Gherkin scenarios, commit per slice, update the
  capability doc, record `acceptance.md`.
- `/loom-submit` — verify, archive, and open the PR; the PR review is the human acceptance gate.

**Foundational skills** (composed by the loop, or run standalone — e.g. to ground a brownfield repo):
`/loom-domain` (sharpen the glossary + ADRs) and `/loom-design` (deep, testable module shapes).

**Where things live:**
- `.loom-worktrees/<slug>/` — the change branch's worktree (gitignored); apply and submit run here.
- `docs/loom/changes/<slug>/` — in-flight change (`intent` · `behavior` · `plan?` · `tasks?` ·
  `acceptance`).
- `docs/loom/changes/archive/<date>-<slug>/` — completed changes (history); lands on `main` when the
  PR merges.
- `docs/loom/project.md` — stack, conventions, test/build/lint commands, forge config.
- `docs/capabilities/<name>.md` — **living** documentation of what the system does. Durable.
- `docs/adr/NNNN-*.md` — architecture decisions. Durable.
- `CONTEXT.md` — domain glossary. Durable.

**Guardrails:**
- Behavior is written in **Gherkin** in `behavior.md` and **materialized into idiomatic tests** in
  this project's own framework — never `.feature` files.
- Capability docs are a **living summary, edited in place** — they are not a spec to merge or
  validate. The tests are the source of truth.
- `CONTEXT.md` is a glossary only (no implementation detail). Offer ADRs sparingly (hard-to-reverse
  AND surprising AND a real trade-off).
- Decisions are pinned in `plan.md` during propose, so implementation makes no important new ones.
- The **PR review is the acceptance gate**: `loom-submit` archives on green and opens the PR; merging
  it accepts the change and lands the archive on `main`. `loom-apply` never touches `main` or remotes.
- `intent.md` is frozen after propose; post-implementation human checks live in `acceptance.md`.

The `/loom-*` skills are directly invokable and carry the detailed formats.
<!-- LOOM:END -->
