# Plan - Add architecture review skill

## Approach
Add `skills/loom-architecture/` as the source of truth for the new skill, with a focused
`SKILL.md` and a report-format reference adapted from Matt Pocock's
`improve-codebase-architecture` guidance. Keep the existing installer shape: source skills under
`skills/loom-*` are copied into each Harness, while payload validation explicitly requires the new
first-class skill.

Update user-facing docs so `/loom-architecture` is an optional discovery step before the normal Loom
loop, not a new required phase. Add a workflow Capability doc because this change is about Loom's
skill workflow rather than installation alone.

## Module Shapes & Seams
- Architecture skill source: interface `/loom-architecture`; hides subagent scan orchestration,
  candidate filtering, report rendering, and selected-candidate continuation. Seam: Markdown skill
  contract consumed by coding Harnesses; behavior is documented in the skill text and workflow docs.
- HTML report reference: interface `skills/loom-architecture/reference/HTML-REPORT.md`; hides report
  layout details from the main skill instructions. Seam: internal skill reference read only when the
  report must be rendered.
- Installer payload validation: interface `payload_available(dir)`; hides required release-payload
  file checks. Seam: in-process POSIX shell - test through `test/install_test.sh`.
- Installer skill copy/removal: interface `install.sh --tools ...` and `install.sh --uninstall`;
  hides the `skills/loom-*` copy/remove loops. Seam: filesystem side effects under project Harness
  directories - test through `test/install_test.sh`.

## Pinned Decisions
- Name the command `/loom-architecture`; keep the domain term **Architecture review** for the
  workflow concept.
- Install `loom-architecture` as a first-class Loom skill for Claude Code, Codex CLI, and OpenCode.
- Use Matt Pocock's report style guidance directly: temp HTML, Tailwind CDN, Mermaid CDN where
  diagrams fit, before/after visuals, concise candidate cards, and a top recommendation.
- Include every credible candidate found; do not impose a top-five cap or pad the report with
  theoretical refactors.
- During the scan, read `CONTEXT.md` and ADRs but do not edit Durable docs. Durable doc changes
  start only after candidate selection in `/loom-explore`.
- Do not propose final interfaces in the report. Final interface design belongs in `/loom-explore`
  using `loom-design`.
- After selection, fork the conversation for the selected candidate when possible; otherwise continue
  in the same conversation.
- Add installer-level tests only; do not test the Markdown workflow behavior with shell tests.

## Sequence
1. Add `skills/loom-architecture/` and its report reference.
2. Update installer payload validation and installer tests for install, remote payload validation,
   remote install, and uninstall.
3. Update README and AGENTS guidance.
4. Add `docs/capabilities/workflow.md`.
