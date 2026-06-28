# Tasks — loom-submit-and-worktree-flow

<!--
NOTE: this is a prose change. "Behavioral" tasks below each materialize into SKILL.md instructions
(not red-green tests). Their ids still trace to behavior.md scenarios for coordination.
-->

## Behavioral  (one per scenario → encoded as skill instructions)
- [x] B1  Propose commits durable-doc stragglers before branching   → behavior.md §Propose/1
- [x] B2  Propose creates the change worktree (`.loom-worktrees/`)   → behavior.md §Propose/2
- [x] B3  Propose GCs a merged change's worktree                     → behavior.md §Propose/3
- [x] B4  Propose leaves an unmerged change's worktree intact        → behavior.md §Propose/4
- [x] B5  Apply commits per TDD slice                                → behavior.md §Apply/1
- [x] B6  Apply never touches main, archive, or remote               → behavior.md §Apply/2
- [x] B7  Apply writes acceptance.md, leaves intent.md frozen        → behavior.md §Apply/3
- [x] B8  Apply reworks in place, sticky after first green           → behavior.md §Apply/4
- [x] B9  Submit green → archive + ready PR (body = acceptance.md)   → behavior.md §Submit/1
- [x] B10 Submit red → draft PR, no archive, failure report in body  → behavior.md §Submit/2
- [x] B11 Submit plan-drift → warning, stays ready                   → behavior.md §Submit/3
- [x] B12 Re-submit updates existing PR, flips draft→ready           → behavior.md §Submit/4
- [x] B13 Submit never auto-fixes                                    → behavior.md §Submit/5
- [x] B14 Submit selects forge from project.md, token from env       → behavior.md §Submit/6

## Chores  (non-behavioral work)
- [x] C1  Author the new `loom-submit` SKILL.md (+ per-forge reference files: github/codeberg/gitlab)
- [x] C2  Edit `loom-apply` SKILL.md: remove archive step; per-slice commits; acceptance.md;
          edit-in-place; forge/main/remote prohibition
- [x] C3  Edit `loom-propose` SKILL.md: durable-doc stragglers → worktree creation → merged-worktree GC
- [x] C4  Add forge-config section to `docs/loom/project.md` + `templates/project.md`
- [x] C5  Add `acceptance.md` template to the loom-apply reference set
- [x] C6  Ensure `.loom-worktrees/` is gitignored (repo `.gitignore` + loom-propose step)

## Docs
- [x] D1  Update `AGENTS.md` + `AGENTS.tmpl.md`: loop gains `submit`; "where things live" gains
          `acceptance.md` + `.loom-worktrees/`; PR-as-acceptance-gate
- [x] D2  Update `README.md`: "The loop" table (fix apply row, add submit row) + executor paragraph +
          intro touch (lands as a PR)
<!-- No capability-doc task: AGENTS.md is the workflow's living summary (see plan.md). CONTEXT.md
terms and ADR 0002 were already written during explore. -->
