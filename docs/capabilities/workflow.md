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
- Board implementors claim only unclaimed `loom:ready` issues or `loom:rework` PRs by adding the
  additive `loom:wip` label before touching the Change. Interrupted Claims remain visible until a
  human requeues them; successful handoff removes the Claim only after implementor eligibility ends.
  -> `test/install_test.sh::test_filter_claims_before_selecting_one_item`,
  `test/install_test.sh::test_add_advisory_claim_without_replacing_lifecycle`,
  `test/install_test.sh::test_forge_command_contracts_preserve_wip_claims`,
  `test/install_test.sh::test_retain_an_interrupted_claim` (added 2026-07-15)

## Decisions
- Architecture review is discovery, not a required loop phase; durable updates begin only after a
  candidate enters `/loom-explore`.
- Board Claims are durable, additive, and advisory rather than locks or leases —
  [ADR-0007](../adr/0007-board-claims-use-additive-wip-label.md).

## Language
**Architecture review**, **Change**, **Claim**, **Durable doc**, **Capability doc**, **Verification**,
and **Acceptance** - see [CONTEXT.md](../../CONTEXT.md).
