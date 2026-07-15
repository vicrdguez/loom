# Add the Pi Worker console

## Why
Loom's Board topology needs first-party scheduling, but the superseded Elixir console would add a
standalone runtime, executable, TUI, installer, and release matrix beside the Harness that already
owns those concerns. Pi can host the console directly while creating a fresh independent context for
every work unit.

## What
Ship Loom as a Git-installable Pi package containing all Loom skills and a Pi-specific Worker console
extension. The extension runs independent implementor and reviewer Role lanes, each assigning one
GitHub Board object to one fresh Pi SDK `AgentSession`, then discarding that context before polling
again.

This Change is blocked by `add-reviewer-wip-claims`; apply it only after symmetric reviewer Claims
have landed.

## Scope
- A root Pi package manifest installed with `pi install git:github.com/vicrdguez/loom`
- All Loom skills and one interactive Pi extension in the same package
- `/loom-workers` start, list, status, pause, resume, retry, and stop commands
- Independent implementor and reviewer lanes with one active Worker per Role
- GitHub Board discovery and observation through authenticated `gh`
- Exact Board-item assignment while Role skills retain all Claim and lifecycle mutations
- Fresh in-memory Pi SDK sessions with standard project resource discovery
- Pi-native model/thinking selectors, filtered Activity, status widgets, and TUI-only entries
- User-local per-project Role preferences and stale-recoverable per-project/per-Role locks
- Fixed polling, cooldown, retry, observation, and cancellation bounds
- Exact-assignment instructions for scheduler-invoked `loom-implement` and `loom-review`
- Pi-native installation documentation and documentation-only deprecation of `install.sh`

## Out of scope
- Reviewer Claim semantics themselves; they belong to the prerequisite Change
- GitLab or Codeberg polling
- A generic Harness, forge, scheduler, or orchestration library
- A standalone executable, terminal UI, runtime, session store, installer, or npm package
- `install.sh --tools pi`, installer runtime warnings, or removal of the legacy installer
- Headless operation in Pi print, JSON, or RPC modes
- Automatic startup, automatic project initialization, or persistence of active lanes and retry counts
- Coordinator mutation of labels, issues, PRs, repository files, branches, worktrees, or partial work
- OS-process isolation, detached Workers, automatic timeouts, or forced process termination
- The superseded console's custom inspectors, task/commit progress readers, command line, or Activity store
- Harness-native packages for Codex CLI or OpenCode

## Definition of Done
- Pi can load the repository as one package and discovers the Worker console extension plus every
  bundled `loom-*` skill without a build or install script.
- Worker loops start only through `/loom-workers` in a trusted, initialized, interactive GitHub
  project with `gh` available; failures are actionable and mutate nothing.
- The native start flow selects and remembers an available model and thinking level per project and
  Role, accepts matching Role models with a warning, and starts whichever requested Role locks are
  available.
- Implementor and reviewer lanes run concurrently and independently, while each lane owns at most one
  Worker and one local Role lock.
- Every work unit receives a newly created in-memory `AgentSession` with standard Pi resources, the
  package's bundled Role skill, one exact Board assignment, no parent or previous Worker messages,
  and guaranteed disposal.
- Assigned Workers never substitute another Board object; Role skills own additive Claims and all
  lifecycle transitions while the coordinator remains read-only toward Board and repository.
- Session settlement triggers Board reconciliation: leaving Role eligibility resolves the item,
  remaining eligible without `wip` consumes a bounded fresh-context retry, and lifecycle plus `wip`
  waits for explicit human requeue.
- A claimed object that disappears pauses its Role; ordinary empty queues are idle; Board failures
  degrade only the affected lane; one lane's failure never stops the other.
- Running lanes observe only their selected object, wait for the session to settle even if Board
  eligibility changes, and never launch a second Worker.
- Pause, resume, retry, stop, parent-session shutdown, and bounded cancellation preserve repository
  work, dispose Worker context, and release locks according to the agreed lifecycle.
- `list` shows every open lifecycle-labeled Board object and Claim, while `status` reports each lane's
  current Change, model, state, elapsed time, retries, and next poll.
- Pi-native widgets and TUI-only entries show filtered Activity and lifecycle failures without adding
  Worker narration, reasoning, commands, or tool output to the parent model context.
- Node's built-in test runner proves lane behavior, GitHub parsing, local state, command behavior,
  concurrent/fresh session isolation, disposal, and package loading; the existing shell suite stays green.
- README, project commands, capability docs, and installed instructions describe Pi-native
  installation, `/skill:loom-*` invocation, the Worker console, and the still-supported legacy
  installer without changing `install.sh` output.
