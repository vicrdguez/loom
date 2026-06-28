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

## Example Dialogue

Dev: "Can I run a remote install in my app repo?"

Domain expert: "Yes. Run the release script from the target project root for a project install, or
pass the global flag for a global install."

Dev: "Does that clone Loom?"

Domain expert: "No. A remote install uses a release archive for the requested Loom version."
