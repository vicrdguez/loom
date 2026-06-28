# Importing an existing OpenSpec tree

Loom's change format is close to OpenSpec's, so import is mostly copy + rename. Do it only when
`openspec/` exists, and confirm before touching archived history.

## Mapping

| OpenSpec | Loom | Notes |
|---|---|---|
| `openspec/specs/<cap>/spec.md` | `docs/capabilities/<cap>.md` | Already capability-shaped. Trim to the living-summary altitude (link tests where known). |
| `openspec/changes/<slug>/proposal.md` | `docs/loom/changes/<slug>/intent.md` | Same why/what/scope role. |
| `openspec/changes/<slug>/design.md` | `docs/loom/changes/<slug>/plan.md` | Fold into plan; promote hard-to-reverse bits to ADRs. |
| `openspec/changes/<slug>/specs/*` (deltas) | `docs/loom/changes/<slug>/behavior.md` | Convert delta requirements/scenarios into Gherkin. |
| `openspec/changes/<slug>/tasks.md` | `docs/loom/changes/<slug>/tasks.md` | Keep as-is; normalize ids if needed. |
| `openspec/changes/archive/<slug>/` | `docs/loom/changes/archive/<YYYY-MM-DD>-<slug>/` | **Confirm first.** Use the original completion date if recorded, else today's. |

## Procedure

1. **Active changes** — import without prompting; they're in-flight work. Report each one imported.
2. **Specs → capabilities** — import each spec file, rewriting requirement/scenario blocks into the
   [capability-doc format](../../loom-apply/reference/capability-doc.md). Where you can identify the
   tests that cover a behavior, link them; otherwise leave the bullet unlinked.
3. **Archived changes** — list them with one-line summaries and ask: import all, some, or none. Only
   copy what the user selects. Remap the folder name to `<date>-<slug>`; on collision append `-2`.
4. **`project.md`** — merge any `openspec/project.md` / `config.yaml` content into
   `docs/loom/project.md` (do not leave two sources of project config).

## Don't

- Don't delete the `openspec/` tree — leave it for the user to remove once they've verified the
  import.
- Don't fabricate scenarios the deltas didn't contain.
- Don't import OpenSpec's tooling files (`AGENTS.md` openspec block, command wrappers) — Loom's
  installer manages its own `AGENTS.md` block.
