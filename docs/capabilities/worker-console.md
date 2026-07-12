# Worker Console
How Loom supervises and presents fresh Board-topology Workers without becoming a workflow actor.

## Behaviors
- Bare `loom` preflights the initialized project, Codex, and GitHub CLI, then restores or collects
  Harness-neutral implementor and reviewer Worker specifications.
  -> `test/loom/cli_test.exs`, `test/loom/console_test.exs` (added 2026-07-12)
- A project has one live console owner; stale ownership is recoverable, and restart restores operator
  intent and bounded filtered history without trusting a stale Worker claim.
  -> `test/loom/store_test.exs`, `test/loom/console_test.exs` (added 2026-07-12)
- Each Role lane owns at most one Worker, prefers rework, treats only the expected Board transition as
  success, and pauses after three consecutive failures without charging Board outages as retries.
  -> `test/loom/lane_test.exs` (added 2026-07-12)
- Silence remains observable but never terminates a Worker; pause, resume, retry, stop, and confirmed
  quit provide explicit lifecycle control.
  -> `test/loom/lane_test.exs`, `test/loom/console_test.exs` (added 2026-07-12)
- Codex runs in a fresh ephemeral context with explicit model, reasoning, sandbox, prompt, and root;
  only completed agent messages and normalized lifecycle/failure events cross the Harness seam.
  -> `test/loom/harness/codex_test.exs`, `test/loom/harness/codex/event_test.exs`
  (added 2026-07-12)
- Progress reports Board stage, tasks or their explicit absence, scenarios, and slice commits as
  separate evidence and never invents a completion percentage.
  -> `test/loom/progress_test.exs`, `test/loom/progress/repo_test.exs` (added 2026-07-12)
- Wide terminals show both Role lanes; narrow terminals show the focused lane. Status, evidence,
  Markdown Activity, inspectors, and the fixed command line remain visually separate.
  -> `test/loom/ui_test.exs` (added 2026-07-12)
- Console commands are deterministic and local: inspection, focus, configuration, and lane controls
  are supported while shell and workflow mutations are rejected.
  -> `test/loom/command_test.exs`, `test/loom/console_test.exs` (added 2026-07-12)

## Decisions
- Loom owns Worker scheduling and supervision. - [ADR-0004](../adr/0004-loom-ships-a-worker-console.md)
- The console uses Elixir/OTP and ExRatatui. - [ADR-0005](../adr/0005-worker-console-uses-elixir-and-ex-ratatui.md)
- Fresh contexts are mandatory; Model diversity is optional.
  - [ADR-0006](../adr/0006-board-topology-requires-independent-contexts.md)

## Language
**Worker console**, **Role lane**, **Worker specification**, **Progress evidence**, **Activity
message**, and **Console command** - see [CONTEXT.md](../../CONTEXT.md).
