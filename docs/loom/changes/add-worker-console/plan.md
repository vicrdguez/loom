# Plan — Add the Worker console

## Approach
Add a root Mix/OTP application whose public executable is `loom`. The application discovers the
current initialized project, owns one persistent `Lane` process per Worker Role, and renders their
snapshots through ExRatatui. Lanes depend only on normalized `Harness` events and `Progress`
snapshots; Codex CLI details, GitHub queries, filesystem persistence, command grammar, and rendering
remain behind their own seams.

The existing POSIX installer stays the skills installer and gains an opt-in `--cli` path that
downloads a platform-specific standard Mix release from the same GitHub release tag. GitHub Actions
build and smoke-test the four supported artifacts. The console itself never writes Board or
repository state; only the Workers it launches perform the existing Role contracts.

## Module shapes & seams
- **`Loom.CLI`**: interface `main(argv) -> exit status`; discovers the git/project root, validates an
  initialized Loom project and required capabilities, acquires project ownership through `Store`,
  performs first-run setup, and starts the Console/UI. Hides argument parsing and release boot.
  Seam: in-process → direct tests with temporary projects and fake executable discovery.
- **`Lane`**: interface `start_link(role, spec, deps)`, `subscribe(lane)`, `snapshot(lane)`, and
  `command(lane, action)`. Owns the complete idle/running/cooldown/backoff/paused/degraded state
  machine, current Board item, retry budget, and exactly one transient Worker handle. Invariants:
  at most one active Worker; Board transition is success; three consecutive no-progress exits pause;
  Board errors do not spend Worker retries; silence never kills; `stop` terminates then pauses.
  Seam: true-external dependencies accepted as `Harness` and `Board` adapters → fake adapters in
  deterministic state-machine tests.
- **`Harness`**: interface `start(spec, owner) -> {:ok, handle} | {:error, reason}` and
  `stop(handle, mode)`. Emits normalized Activity/lifecycle/failure events to the owning `Lane` and
  hides executable arguments, OS process ownership, streaming, cancellation, and authentication
  delegation. Seam: true external (Codex) → fake Harness in Lane tests; production adapter
  `Harness.Codex`.
- **`Harness.Codex.Event`** (critical internal module): interface `decode(json_line) -> normalized_event
  | :ignore | {:error, reason}`. Invariants: completed agent messages are Activity; lifecycle/errors
  are normalized; mechanics and unknown types are ignored; malformed required fields fail clearly.
  Tested at its own seam with captured JSONL fixtures. The adapter capability-probes required Codex
  flags rather than pinning a CLI version.
- **`Board`**: read-only interface `claimable(role) -> item | :none | error` and
  `state(item) -> board_state | error`; production adapter `Board.GitHub` hides `gh` commands and JSON.
  Invariants: implementor prefers rework over ready; reviewer reads review; Console performs no Board
  mutation. Seam: true external → fake Board in Lane/Progress tests.
- **`Progress`**: interface `snapshot(project, board_item) -> progress`; joins Board state with
  repository evidence and returns Board stage, task counts or explicit absence, scenario count,
  slice commits, and timestamps as separate facts. It never returns a completion percentage or trusts
  Activity narration. Seam: Board adapter plus local-substitutable repository/filesystem → fake Board
  and temporary git repositories.
- **`Progress.Repo`** (critical internal module): interface `snapshot(root, change) -> repo_evidence`;
  hides active/archive Change lookup, `tasks.md` parsing, Gherkin scenario counting, and slice-commit
  selection. Tested at its own seam with temporary repositories and representative briefs.
- **`Store`**: interface `acquire(project)`, `load(project)`, `save(project, state)`, and
  `append(project, role, event)`. Hides the per-user state directory, atomic snapshot writes, stale
  ownership recovery, and bounded filtered history. Persists specifications, preferences, manual
  pauses, per-item failures, and filtered Activity/lifecycle events—never a live PID claim or raw
  Codex JSON. Seam: local-substitutable filesystem → temporary directory tests.
- **`Command`**: interface `parse(text) -> query | lane_action | config_action | error` and
  `run(query, snapshot) -> inline_result | inspector_result`. Hides grammar and formatting choices.
  Invariants: deterministic/local interpretation; no arbitrary shell or workflow mutation. Seam:
  in-process → table-driven parser and result tests.
- **`UI`**: interface `run(console)` and `render(state, dimensions) -> frame`; owns ExRatatui widgets,
  focus, Markdown Activity, responsive lanes, command input, inline results, confirmations, and the
  long-form inspector. It subscribes to snapshots and sends commands but never schedules Workers.
  Seam: ExRatatui headless backend → frame/event tests at wide and narrow dimensions.

## Pinned decisions
- Loom now ships the optional first-party Worker console; ADR-0004 supersedes ADR-0003's no-runtime
  scheduling decision.
- Use Elixir/OTP + ExRatatui and standard target-specific Mix releases containing ERTS; publish a
  dedicated `loom` artifact per platform, separate from the skills source archive. Bare `loom` opens
  the console. Do not use Burrito. See ADR-0005.
- Build and test with Elixir 1.19 / OTP 28 and pin ExRatatui to the compatible `~> 0.11` line so the
  release matrix uses available precompiled native artifacts.
- Call board-coordinated operation the **Board topology**. Fresh, independent Worker context is
  mandatory; matching model IDs warn but remain valid. See ADR-0006.
- V1 implements Codex and GitHub adapters only, but neither their CLI arguments nor event schemas may
  leak across the `Harness`/`Board` seams.
- Worker specifications belong to Loom, not Codex profiles. Operators configure only model and
  reasoning effort; Loom fixes Role prompt, one-Change/fresh-context behavior, project root, and
  capability policy. Harnesses retain authentication and credential ownership.
- `Harness.Codex` uses non-interactive ephemeral JSONL and displays only completed agent messages plus
  lifecycle/errors. Unknown event types are ignored; malformed required events fail the adapter.
- Keep one `Lane` per Role and one active Worker per lane. Default timing is injectable in tests;
  production uses a 60-second idle poll, 5-second success cooldown, and failure backoffs of 5 seconds,
  30 seconds, and 2 minutes before pausing.
- No automatic runtime/silence timeout, daemon, detach, second console, natural-language fallback,
  workflow mutation, progress percentage, or raw transcript persistence.
- The Console is read-only toward git and the Board. `pause` lets an active Worker finish but blocks
  the next launch; `stop` gracefully terminates the active Worker and leaves the lane paused.
- Persist local operator intent and bounded filtered history in an inspectable snapshot/append-log
  format under the per-user state directory keyed by canonical project root. On restart, always
  reconstruct live truth through `Progress`.
- `install.sh --cli` is opt-in and user-level. Without it, all existing skill installation behavior
  is unchanged. Dry-run and uninstall remain symmetric; unsupported platforms fail before writes.
- Release tags version skills and CLI together. GitHub Actions build macOS arm64/x86_64 and Linux
  arm64/x86_64 artifacts named `loom-<version>-<os>-<arch>.tar.gz` and run `loom --version` smoke
  tests. Prebuilt CLI installation requires a published tag; development refs and unversioned
  checkouts fail clearly instead of silently installing a mismatched CLI.
- Automated tests never invoke live Codex or GitHub work. Use fakes, captured JSONL fixtures,
  temporary repositories, ExRatatui's headless backend, installer fixtures, and release smoke tests;
  the real Codex/GitHub flow belongs in `acceptance.md`.
- Update the living docs rather than preserving a stale sibling: create a Worker-console capability
  doc; update installation and workflow capabilities, README, AGENTS/AGENTS template/Claude
  orientation, project commands, and every installed skill that still teaches superseded
  multi-model/no-runtime language.

## Sequence
1. Scaffold the Mix application, Store/Command primitives, fake adapters, and test support.
2. Build `Harness.Codex.Event`, `Progress.Repo`, and `Progress` at their own seams.
3. Drive the `Lane` state machine through fake Harness/Board adapters, then add production adapters.
4. Build the ExRatatui UI and first-run/config/inspector flows against headless snapshots.
5. Integrate `loom` boot, graceful shutdown, project ownership, and end-to-end hermetic scenarios.
6. Extend `install.sh`, add release workflows/artifacts, and update project/capability/workflow docs.
