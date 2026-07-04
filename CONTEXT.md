# Loom

Loom is a portable agent-skill workflow that installs the same change-management skills into
multiple coding harnesses.

## Language

### Distribution

**Harness**:
A coding agent environment that can load Loom skills. Claude Code, Codex CLI, and OpenCode are
the supported harnesses.
_Avoid_: Tool, client

**Project install**:
A Loom install scoped to one target project. The target project receives Loom skills under its
local harness directories and Loom orientation files in the project root.
_Avoid_: Local install

**Global install**:
A Loom install scoped to the current user. Loom skills are placed in user-level harness directories
instead of a target project's harness directories.
_Avoid_: User install

**Remote install**:
A copy-paste install started from a hosted installer script without requiring the user to clone Loom
first.
_Avoid_: Curl install, bash install

**Release archive**:
A versioned source snapshot used by a remote install. It is the payload that provides the skills,
templates, and installer files for a specific Loom release.
_Avoid_: Clone, checkout

### Workflow

**Change**:
A single unit of work taken through the Loom loop, owned by a directory under
`docs/loom/changes/<slug>/` and moved to `changes/archive/` when complete.
_Avoid_: Task, ticket, feature

**Architecture review**:
A Loom workflow pass that finds candidate Changes from architecture friction before a specific
Change is chosen. It is not a code review of an existing diff and not a general health check.
_Avoid_: Code review, health check, audit

**Durable doc**:
Documentation that outlives any single change — the `CONTEXT.md` glossary, ADRs, and capability
docs. Committed wherever it is authored. Contrast with a change's own briefs, which get archived.
_Avoid_: Permanent doc, spec

**Capability doc**:
A living, edited-in-place summary of what the system does, under `docs/capabilities/<name>.md`.
The tests are the source of truth; the doc is the human-readable map.
_Avoid_: Spec, design doc

**Verification**:
The automated check, run by the agent with no human in the loop, that a change is complete: every
intent "Done" line met, every behavior scenario has a test, the suite green, no drift from plan.
_Avoid_: Validation, testing

**Acceptance**:
The human-only judgment a change still needs after verification — visual, UX, and "does it feel
right" checks an agent cannot make. Recorded in `acceptance.md` and granted by merging the PR.
_Avoid_: Validation, QA, sign-off

**Change branch**:
The git branch a change is built on, checked out in its own worktree under a gitignored
`.loom-worktrees/`, created at propose; its commits become the change's PR (or MR). Isolating each
change on its own branch is what lets multiple changes proceed in parallel.
_Avoid_: Feature branch, topic branch

### Topology & roles

**Stage**:
One step of the Loom pipeline — explore, propose, build, review, land. Every stage exists in every
topology; what varies is which role fills it. Maps to the skills `loom-explore` / `loom-propose` /
`loom-apply` (build) / `loom-review` (review — a standing model stage in both topologies) /
`loom-submit` (land). Review is a model stage run in a fresh context; land is the human's acceptance
gate.
_Avoid_: Phase, step

**Topology**:
How the pipeline's roles are assigned and coordinated for a change. **Single-model** (the default):
every role collapses onto one model plus the human, handing off sequentially in one context.
**Multi-model**: planner, implementor, and reviewer are distinct models coordinated through the
board. Chosen **per change, not per project** — there is no mode flag; you publish a change to the
board and run workers to hand it off, or you don't. Topology is emergent from what you run.
_Avoid_: Mode, flow

**Role**:
The function a participant fills at a stage — planner (explore/propose), implementor (build),
reviewer (review), and the human (land). The **trust boundary**: the model that built a change never
verifies, archives, or blesses it — a different role does.
_Avoid_: Persona, agent

**Worker**:
A single-model agent that fills one role by processing exactly one change per invocation and then
exiting; the harness's own scheduler re-fires it with a fresh context. Exists only in the
multi-model topology.
_Avoid_: Daemon, bot, agent

**Board**:
The forge's issues, PRs, and labels used as the asynchronous coordination medium between workers in
the multi-model topology. Four labels carry a change's lifecycle: `loom:ready` (issue awaiting an
implementor), `loom:review` (PR awaiting a reviewer), `loom:rework` (PR bounced back), `loom:done`
(PR awaiting the human's merge).
_Avoid_: Queue, tracker

**Change issue**:
The forge issue that publishes a proposed change to the board so an implementor worker can claim it;
it carries or links the change brief. Created by `loom-propose` in the multi-model topology only.
_Avoid_: Ticket

## Example Dialogue

Dev: "Can I run a remote install in my app repo?"

Domain expert: "Yes. Run the release script from the target project root for a project install, or
pass the global flag for a global install."

Dev: "Does that clone Loom?"

Domain expert: "No. A remote install uses a release archive for the requested Loom version."
