# Workflow
How Loom's skills move from architecture discovery to a proposed, tested, and submitted Change.

## Behaviors
- Architecture review is optional discovery before a Change is chosen: it scans read-only, writes any
  report to the OS temp directory, and sends the selected candidate into `/loom-explore`.
  -> `skills/loom-architecture/SKILL.md`, `skills/loom-architecture/reference/HTML-REPORT.md`,
  `test/install_test.sh::test_checkout_install_includes_architecture_review_skill` (added 2026-07-04)
- Exploration is the first required per-Change thinking step: it grills scope, sharpens domain
  language through `loom-domain`, and settles module shapes through `loom-design`.
  -> `skills/loom-explore/SKILL.md`
- `loom-domain` owns Durable domain language and ADR capture, while `loom-design` owns module,
  interface, seam, and dependency-category vocabulary.
  -> `skills/loom-domain/SKILL.md`, `skills/loom-design/SKILL.md`
- Once a Change is understood, `loom-propose`, `loom-apply`, and `loom-submit` turn it into a brief,
  test-first implementation, capability-doc update, acceptance notes, archive, and PR.
  -> `skills/loom-propose/SKILL.md`, `skills/loom-apply/SKILL.md`, `skills/loom-submit/SKILL.md`
- Publishing a Change selects the Board topology: implementor and reviewer Workers coordinate through
  the Board, every invocation uses a fresh context, and Model diversity remains optional.
  -> `test/loom/console_test.exs`, `test/loom/lane_test.exs` (added 2026-07-12)
- The optional first-party Worker console polls and displays Board-topology work while each Worker
  Role contract remains independently invokable through `loom-implement` and `loom-review`.
  -> `test/loom/cli_test.exs`, `test/loom/ui_test.exs` (added 2026-07-12)

## Decisions
- Architecture review is discovery, not a required loop phase; durable updates begin only after a
  candidate enters `/loom-explore`.
- Fresh Worker context, rather than different model identity, is the Board-topology trust invariant.
  - [ADR-0006](../adr/0006-board-topology-requires-independent-contexts.md)
- Loom owns Board polling and Worker supervision through its optional console.
  - [ADR-0004](../adr/0004-loom-ships-a-worker-console.md)

## Language
**Architecture review**, **Change**, **Board topology**, **Worker**, **Role**, **Verification**, and
**Acceptance** - see [CONTEXT.md](../../CONTEXT.md).
