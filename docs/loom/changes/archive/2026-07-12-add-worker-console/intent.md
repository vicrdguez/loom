# Add the Worker console

## Why
Board-topology Workers currently depend on user-written scheduling glue. The prototype proves the
loop works, but mixed process output makes long-running implementor and reviewer work difficult to
understand, inspect, and safely control.

## What
Ship an optional first-party `loom` CLI that opens a terminal Worker console, supervises one fresh
Worker at a time for each Role, separates trustworthy Progress evidence from filtered Activity
messages, and provides deterministic inspection and lifecycle commands.

## Scope
- An Elixir/OTP application with an ExRatatui interface, launched by running bare `loom` in an
  initialized project.
- Persistent implementor and reviewer Role lanes, each owning polling, Worker lifecycle, retries,
  pauses, and current Change state.
- Harness-neutral Worker specifications owned by Loom; first-run and `config` flows select the model
  and reasoning effort per Role while Loom fixes each Role contract and execution capabilities.
- A Codex Harness adapter that launches fresh non-interactive Workers, consumes JSONL, and emits only
  normalized Activity, lifecycle, and failure events.
- A read-only GitHub Board adapter plus repository readers that derive Board stage, tasks, scenarios,
  and slice commits as separate Progress evidence.
- Markdown Activity feeds, responsive Role-lane layout, a local command line, and formatted inspectors
  for status, tasks, commits, diffs, Board state, and retained Activity.
- Exclusive per-project ownership, bounded filtered history, restart reconciliation, bounded retries,
  degraded Board handling, and graceful shutdown.
- Optional user-level CLI installation through `install.sh --cli`; four macOS/Linux release artifacts
  published beside the source archive under the same Loom release version.
- Replace superseded multi-model/no-runtime language with the Board-topology and Worker-console model
  across installed skills and workflow documentation.

## Out of scope
- More than one active Worker per Role or any atomic multi-worker claim protocol.
- Harness adapters other than Codex, Board adapters other than GitHub, or Windows releases.
- A background daemon, detached Workers, remote viewing, IPC, or reattachment.
- Natural-language Console commands, arbitrary shell execution, or Console commands that edit code,
  git history, Board labels, issues, or PRs.
- Model-reported percentages, inferred completion percentages, explicit Worker progress protocols, or
  persistence of raw Codex transcripts.
- Automatic silence/runtime timeouts; the operator can inspect elapsed silence and stop a Worker.
- Installing or authenticating Codex or GitHub, managing provider credentials, or relying on Codex
  profiles.
- Prebuilt CLI artifacts for development branches or unversioned checkouts; contributors build the
  Mix application locally while published tags carry installable artifacts.

## Done
- Running `loom` in an initialized project performs capability preflight, collects any missing Role
  model policy, acquires exclusive project ownership, and opens two persistent Role lanes.
- Each Role lane launches at most one fresh Worker when its Board work is claimable, remains visible
  while idle, and treats the expected Board transition—not process exit or commits—as success.
- Worker failures or no-progress exits retry three times with increasing backoff and then pause; Board
  unavailability degrades scheduling without spending that retry budget, and silence alone never
  terminates a Worker.
- Loom-owned Worker specifications are independent of Harness CLI profiles; matching implementor and
  reviewer model choices warn but remain valid because fresh contexts are mandatory.
- The Codex adapter renders completed agent messages as Markdown Activity messages, uses lifecycle and
  error events for lane state, and hides reasoning, commands, file changes, tool calls, searches, and
  plans.
- Progress reports Board stage, checked tasks when present, scenario count, and slice commits as
  separate evidence; absent task ledgers are explicit and no completion percentage is shown.
- `status`, `tasks`, `log`, `diff`, `board`, `activity`, `focus`, `refresh`, `config`, `pause`, `resume`,
  `retry`, `stop`, `help`, and `quit` work locally without granting workflow mutation or shell access.
- Long command results open a formatted inspector; wide terminals show both lanes and narrow terminals
  show one full-width focused lane without losing the fixed command line.
- Restart restores Worker specifications, operator pauses, per-item retry protection, preferences,
  and bounded filtered Activity history while reconstructing live truth from GitHub and the repository.
- A second live console for the same project is refused, stale ownership is recoverable, and quitting
  with an active Worker requires confirmation and graceful termination rather than detaching it.
- `install.sh --cli` installs, dry-runs, and uninstalls the user-level `loom` executable correctly;
  each supported platform receives a matching CLI artifact from the same release as the skills.
- The automated suite is hermetic across Lane, Progress, Harness decoding, Store, Command, UI, and
  installer behavior; release workflows smoke-test each artifact without invoking live Codex or
  GitHub work.
- README, AGENTS orientation, installed skills, project commands, and capability docs describe the
  Board topology, Worker console, CLI installation, and current v1 limits using canonical language.
