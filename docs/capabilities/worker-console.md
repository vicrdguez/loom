# Worker console
How Pi schedules independent implementor and reviewer Workers over Loom's GitHub Board.

## Behaviors
- `/loom-workers` starts only in a trusted, initialized interactive GitHub project with authenticated
  `gh` and an available Pi model. → `test/loom_workers.test.ts::refuse unsafe or unsupported startup`
  (added 2026-07-15)
- Implementor and reviewer Role lanes choose and remember Pi-native model/thinking settings, may use
  the same model with a warning, and acquire independent stale-recoverable local locks.
  → `test/loom_workers.test.ts::select and remember a Role model natively`,
  `test/loom_workers.test.ts::allow matching Role models with a warning`,
  `test/loom_workers.test.ts::recover a stale Role lock atomically under contention` (added 2026-07-15)
- GitHub Board listing and assignment include open lifecycle objects and Claims, exclude `loom:wip`
  before oldest selection, prefer implementor rework, and surface observation transport failures.
  → `test/loom_workers.test.ts::list all open Board Changes`,
  `test/loom_workers.test.ts::degrade when GitHub Board listing fails`,
  `test/loom_workers.test.ts::degrade when exact Board observation has a transport failure`,
  `test/loom_workers.test.ts::exclude Claims before oldest-item selection`,
  `test/loom_workers.test.ts::prefer eligible rework over ready work` (added 2026-07-15)
- Every exact assignment runs in a fresh in-memory Pi SDK session with standard project resources,
  including extension-registered models, and the bundled Role contract; Pi extension startup,
  resource-discovery, and shutdown hooks run before context disposal without cleaning repository work.
  → `test/loom_workers.test.ts::load standard project policy around the bundled Role contract`,
  `test/loom_workers.test.ts::discard context between consecutive work units`,
  `test/loom_workers.test.ts::dispose context without cleaning repository work` (added 2026-07-15)
- Role lanes reconcile from Board truth, preserve the exact assignment across pause/resume, retry
  pre-Claim failures with fresh context, await explicit requeue after a Claim, and pause on exhausted
  retries or orphaned Claims.
  → `test/loom_workers.test.ts::classify Board state after session settlement`,
  `test/loom_workers.test.ts::resume retries the exact assignment after a reconciliation Board failure`,
  `test/loom_workers.test.ts::pause after three pre-Claim failures`,
  `test/loom_workers.test.ts::retry automatically after human requeue`,
  `test/loom_workers.test.ts::pause when an observed Claim becomes orphaned` (added 2026-07-15)
- Pause, resume, retry, stop, and parent-session shutdown preserve Role isolation while disposing
  Worker context, in-flight startup, timers, and locks within the cancellation bound.
  → `test/loom_workers.test.ts::apply deterministic lane controls`,
  `test/loom_workers.test.ts::stop does not launch after Board selection settles`,
  `test/loom_workers.test.ts::stop cancels Worker startup before session creation finishes`,
  `test/loom_workers.test.ts::parent shutdown cancels an in-flight coordinator start`,
  `test/loom_workers.test.ts::stop extension resources on parent session shutdown`,
  `test/loom_workers.test.ts::keep the other Role operational after failure` (added 2026-07-15)
- Pi shows compact native status and display-width-safe completed assistant summaries or lifecycle
  failures as TUI-only Activity; Worker reasoning and tool mechanics never enter parent model context.
  → `test/loom_workers.test.ts::report current Role status`,
  `test/loom_workers.test.ts::keep Worker narration out of parent model context` (added 2026-07-15)

## Decisions
- Board trust requires fresh contexts, not different model IDs —
  [ADR-0006](../adr/0006-board-topology-requires-independent-contexts.md).
- The Worker console runs as a Pi extension and Git package —
  [ADR-0008](../adr/0008-worker-console-runs-as-pi-extension.md).

## Language
**Worker console**, **Role lane**, **Worker**, **Activity message**, **Progress evidence**, **Board**,
and **Claim** — see [CONTEXT.md](../../CONTEXT.md).
