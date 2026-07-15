# Plan — Add the Pi Worker console

## Approach
After `add-reviewer-wip-claims` lands, add a dependency-free TypeScript Pi extension and root Pi
package manifest. The interactive extension owns two optional background Role lanes. A concrete
GitHub reader selects and observes Board objects; a concrete Pi Worker creates one SDK
`AgentSession` per exact assignment; the Role skill inside that session performs every Claim and
workflow mutation. The extension reports typed events through Pi's native UI and never builds a
second console.

Use the Pi SDK directly rather than JSON/RPC subprocesses: every run receives a new
`SessionManager.inMemory(projectRoot)`, resource loader, and `AgentSession`; no messages are copied
from the parent or an earlier Worker; `dispose()` runs in `finally`. Prove concurrent and replacement
session isolation before building the full lane loop.

## Module shapes & seams
- Pi extension entry: interface `/loom-workers <start|list|status|pause|resume|retry|stop> ...` plus
  `session_shutdown`; hides argument parsing, native selectors, status widgets, entry rendering, and
  background command dispatch. Seam: Pi extension API — smoke-test command registration and test
  handlers with fake UI/context objects.
- Coordinator: interface `start(target, choices)`, `list()`, `status()`, lane controls, and
  `shutdown()`; owns requested-Role fan-out, partial startup, cross-lane snapshots, Activity routing,
  and parent-session cleanup. It does not interpret model prose or mutate Board/repository state.
  Seam: in-process — test with real Role lanes over injected fakes.
- Role lane (critical internal module): interface `start`, `pause`, `resume`, `retry`, `stop`, and
  `snapshot`; owns the idle/running/reconciling/cooldown/backoff/awaiting-requeue/paused/degraded state
  machine, one exact assignment, one Worker, timers, observed Claim state, and a three-attempt
  pre-Claim retry budget. Invariants: at most one active Worker; settlement triggers reconciliation;
  Board eligibility decides outcome; post-Claim retry requires human requeue; one lane never stops the
  other. Seam: in-process — deterministic tests with fake Board/Worker and injected timer functions.
- GitHub Board: interface `listOpen()`, `next(role)`, and `observe(item)`; hides `gh` invocation,
  `docs/loom/project.md` repository parsing, JSON normalization, lifecycle/Claim classification,
  rework preference, and oldest-first selection. It is concrete, not a generic forge port. Seam: true
  external — inject the command runner, use captured JSON fixtures, and leave authenticated GitHub to
  acceptance.
- Pi Worker: interface `run(role, item, modelChoice, signal, onEvent)` and `abort`; hides package Role
  skill loading, structured exact assignment, standard `DefaultResourceLoader`, model resolution,
  fresh in-memory `AgentSession`, typed event subscription, five-second cancellation, and disposal.
  Invariants: one assignment, one prompt, no fallback item, no inherited messages, no session reuse,
  no repository cleanup. Seam: true external model/provider behind the Pi SDK — inject a session
  factory for hermetic tests and exercise SDK session construction in a focused integration test.
- Local state helpers: interfaces `loadChoice/saveChoice(project, role)` and
  `acquireRole(project, role) -> release`; hide canonical-root hashing, user-local Pi agent paths,
  atomic writes, one file per Role, live-PID refusal, and stale-lock recovery. Seam:
  local-substitutable filesystem — test in temporary directories.

## Pinned decisions
- This Change is blocked by `add-reviewer-wip-claims`; do not duplicate or weaken symmetric Claim
  semantics here. See ADR-0007.
- Use a Pi extension and one Git Pi package containing the extension plus all `skills/`; no npm
  publication, standalone executable, custom TUI, bundled runtime, or separate installer. See
  ADR-0008.
- Pi package loading never initializes a project; users explicitly run `/skill:loom-init`.
- Support only interactive TUI mode, trusted initialized projects, GitHub, and authenticated `gh`.
  Do not introduce generic Harness or forge interfaces.
- The extension is read-only toward Board and repository. It selects one exact object and injects the
  package's own Role skill; the Worker verifies and Claims that object and must not substitute another.
- Load standard Pi project/global context, skills, extensions, settings, models, and tools around the
  bundled Role contract. Same-named project Loom skills cannot replace the injected contract.
- Create a new in-process SDK `AgentSession` with in-memory session state for every work unit. Fresh
  context—not an OS process—is the trust invariant; model diversity warns but remains optional. See
  ADR-0006.
- Model/thinking choice uses Pi-native selectors and persists user-locally per canonical project and
  Role. Active lanes snapshot their choice; parent model changes do not alter it. Only model choices
  persist—never active lanes, retry counts, raw Activity, or Worker sessions.
- Acquire one stale-recoverable local lock per canonical project and Role. `start both` is partial:
  start each available Role and report independent failures.
- Board selection excludes `wip` before ordering/limiting, prefers rework over ready for implementors,
  and chooses oldest within a lifecycle. `list` includes every open ready/review/rework/done object.
- Reconciliation is eligibility-based, not a bespoke workflow validator: leaving current Role
  eligibility resolves the item; current eligibility without `wip` retries; lifecycle plus `wip`
  waits for human requeue; a previously observed Claim whose object disappears pauses. Empty work is
  idle and Board read failure is degraded.
- A running lane observes only its exact item every 60 seconds and never launches another. Eligibility
  changes update status but do not abort; session settlement remains the lifecycle boundary.
- Timing is fixed but injected in tests: immediate first poll, 60-second idle/observation/Board-error
  polling, 5-second successful cooldown, pre-Claim backoffs of 5 seconds, 30 seconds, and 2 minutes,
  then pause. No silence/runtime timeout.
- `pause` lets an active Worker finish; `resume` clears only manual pause; `retry` resets a pre-Claim
  failure pause but cannot bypass `wip`; `stop` aborts, waits at most five seconds, disposes, stops the
  loop, and releases the Role lock.
- Parent session shutdown always stops all lanes and never restarts them automatically. Disposing or
  aborting a session never resets, stashes, deletes, or otherwise cleans Worker repository state.
- Present completed assistant messages and lifecycle failures as Role-tagged TUI-only entries, with
  compact native status; exclude reasoning, command/tool mechanics, raw JSON, and parent-context
  messages. Worker narration is Activity, never Progress evidence.
- Use Node's built-in `node:test`, TypeScript loaded directly by Pi/modern Node, injected fakes, and
  temporary directories. Add no test framework or runtime dependency; Pi core packages are peers.
- Keep `install.sh` behavior and output unchanged. Document it as the deprecated compatibility path
  while preferring Claude Code and Pi Harness-native installs. See ADR-0009.

## Sequence
1. Add the package manifest, Node test command, and a Pi resource-discovery smoke test.
2. Prove concurrent and consecutive SDK sessions have distinct empty contexts and deterministic disposal.
3. Build local model preferences and per-Role locking against temporary directories.
4. Build GitHub list/selection/observation from captured `gh` JSON.
5. Drive the Role-lane state machine red-green through fake Board, Worker, and timers.
6. Compose the Coordinator and extension command/UI entry point.
7. Update scheduler-assignment instructions in both Role skills without changing standalone discovery.
8. Update project commands, README, workflow/installation capabilities, and add the Worker-console capability.
9. Record real Pi/GitHub concurrency, model selection, requeue, cancellation, and package-install checks in `acceptance.md`.
