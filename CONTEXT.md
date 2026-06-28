# Loom

Loom is a portable agent-skill workflow that installs the same change-management skills into
multiple coding harnesses.

## Language

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

## Example Dialogue

Dev: "Can I run a remote install in my app repo?"

Domain expert: "Yes. Run the release script from the target project root for a project install, or
pass the global flag for a global install."

Dev: "Does that clone Loom?"

Domain expert: "No. A remote install uses a release archive for the requested Loom version."
