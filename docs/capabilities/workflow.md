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
- Board reviewers claim only unclaimed `loom:review` PRs before accessing a Change. Failed or
  interrupted Claims stay visible until a human requeues them; completed review hands the Claim to
  `loom:done` or `loom:rework` without leaving `loom:wip` behind.
  -> `test/install_test.sh::test_filter_reviewer_claims_before_selecting_one_item`,
  `test/install_test.sh::test_claim_reviewer_before_local_access`,
  `test/install_test.sh::test_release_a_passing_reviewer_claim_through_done`,
  `test/install_test.sh::test_release_a_failing_reviewer_claim_through_rework` (added 2026-07-15)
- Pi's Worker console schedules independent implementor and reviewer Role lanes from exact Board
  assignments. Every work unit gets fresh context, while the injected Role skill retains Claims,
  lifecycle transitions, repository work, and the one-Change contract.
  -> `test/loom_workers.test.ts::run implementor and reviewer concurrently`,
  `test/loom_workers.test.ts::never substitute an ineligible assignment`,
  `test/loom_workers.test.ts::load standard project policy around the bundled Role contract`
  (added 2026-07-15)

## Decisions
- Architecture review is discovery, not a required loop phase; durable updates begin only after a
  candidate enters `/loom-explore`.
- Board Claims are durable, additive, and advisory rather than locks or leases —
  [ADR-0007](../adr/0007-board-claims-use-additive-wip-label.md).
- Board-topology trust comes from a fresh context per Worker; Model diversity is optional —
  [ADR-0006](../adr/0006-board-topology-requires-independent-contexts.md).
- Pi hosts Board scheduling without moving Board or repository mutation into the coordinator —
  [ADR-0008](../adr/0008-worker-console-runs-as-pi-extension.md).

## Language
**Architecture review**, **Change**, **Claim**, **Board**, **Worker**, **Role lane**, **Durable doc**,
**Capability doc**, **Verification**, and **Acceptance** - see [CONTEXT.md](../../CONTEXT.md).
