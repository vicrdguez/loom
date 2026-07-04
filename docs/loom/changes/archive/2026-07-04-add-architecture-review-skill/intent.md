# Add architecture review skill

## Why
Loom has clear skills for exploring a known Change, sharpening domain language, and designing deep
modules, but it has no first-class way to discover architecture-improvement candidates before a
specific Change is chosen. Users who want Matt Pocock's architecture-improvement workflow need that
workflow adapted into Loom without confusing it with code review, project health checks, or the
normal per-change loop.

## What
Add `/loom-architecture` as a standalone Architecture review skill that scans for architecture
friction, presents visual deepening candidates, and hands a selected candidate into `/loom-explore`.

## Scope
- Add a first-class `loom-architecture` skill source installed by every supported Harness.
- Adapt Matt Pocock's architecture review process to Loom's language: `loom-domain`,
  `loom-design`, `loom-explore`, Changes, Durable docs, and Capability docs.
- Render Architecture review candidates as an ephemeral Matt-style HTML report in the OS temp
  directory, using Tailwind CDN and Mermaid CDN where useful.
- Include every credible candidate found, each with recommendation strength and dependency category
  badges, plus one top recommendation.
- Keep the scan read-only with respect to Durable docs; durable updates begin only after candidate
  selection in `/loom-explore`.
- Document `/loom-architecture` as optional discovery before the normal Loom loop.
- Add a workflow Capability doc for Loom's skill workflow.
- Extend installer-level tests so the new first-class skill is installed, validated in release
  payloads, and removed on uninstall.

## Out of scope
- Do not make Architecture review a required stage in the per-change Loom loop.
- Do not create persistent report files under `docs/loom/`.
- Do not propose final module interfaces in the Architecture review report.
- Do not add shell tests for the Markdown workflow behavior of the skill itself.
- Do not change the behavior of `loom-domain`, `loom-design`, or `loom-explore` beyond documenting
  their relationship to `/loom-architecture`.

## Done
- `/loom-architecture` exists under `skills/` with clear instructions for scanning with subagents,
  producing the HTML report, and continuing into `/loom-explore` after selection.
- The Architecture review report guidance uses Matt Pocock's report style: temp HTML, Tailwind CDN,
  Mermaid CDN where useful, before/after visuals, recommendation badges, dependency category badges,
  ADR warnings, and a top recommendation.
- The installer treats `loom-architecture` as a first-class required skill in checkout and remote
  payload installs.
- Uninstall removes `loom-architecture` from installed Harness skill directories while preserving
  Durable docs.
- README and AGENTS guidance present `/loom-architecture` as optional discovery before the normal
  per-change loop.
- `docs/capabilities/workflow.md` summarizes Loom's workflow skills and the relationship between
  `/loom-architecture`, `/loom-explore`, `/loom-domain`, and `/loom-design`.
