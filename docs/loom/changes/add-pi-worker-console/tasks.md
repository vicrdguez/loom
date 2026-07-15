# Tasks — add-pi-worker-console

## Behavioral
- [x] B1   Discover the extension and every Loom skill                    → behavior.md §1/1
- [x] B2   Leave projects unchanged on package installation              → behavior.md §1/2
- [x] B3   Prefer native installs without changing legacy installer      → behavior.md §1/3
- [x] B4   Refuse unsafe or unsupported startup                          → behavior.md §2/1
- [x] B5   Select and remember a Role model natively                     → behavior.md §3/1
- [x] B6   Allow matching Role models with a warning                     → behavior.md §3/2
- [x] B7   Start available Roles independently                           → behavior.md §3/3
- [x] B8   Recover a stale Role lock                                     → behavior.md §3/4
- [x] B9   Refuse a second live Role owner                               → behavior.md §3/5
- [x] B10  List all open Board Changes                                   → behavior.md §4/1
- [x] B11  Report current Role status                                    → behavior.md §4/2
- [x] B12  Prefer eligible rework over ready work                        → behavior.md §5/1
- [x] B13  Exclude Claims before oldest-item selection                   → behavior.md §5/2
- [x] B14  Remain idle with no eligible work                             → behavior.md §5/3
- [x] B15  Never substitute an ineligible assignment                     → behavior.md §5/4
- [x] B16  Run implementor and reviewer concurrently                     → behavior.md §6/1
- [x] B17  Discard context between consecutive work units                → behavior.md §6/2
- [x] B18  Load project policy around the bundled Role contract          → behavior.md §6/3
- [x] B19  Dispose context without cleaning repository work              → behavior.md §6/4
- [x] B20  Classify Board state after session settlement                 → behavior.md §7/1
- [x] B21  Let Board truth override session failure                      → behavior.md §7/2
- [x] B22  Pause after three pre-Claim failures                          → behavior.md §7/3
- [x] B23  Retry automatically after human requeue                       → behavior.md §7/4
- [x] B24  Pause when an observed Claim becomes orphaned                 → behavior.md §7/5
- [x] B25  Observe only the active assignment while running              → behavior.md §7/6
- [x] B26  Wait for settlement after eligibility changes                → behavior.md §7/7
- [x] B27  Keep the other Role operational after failure                 → behavior.md §7/8
- [x] B28  Apply deterministic lane controls                             → behavior.md §8/1
- [x] B29  Stop extension resources on parent session shutdown           → behavior.md §8/2
- [x] B30  Keep Worker narration out of parent model context             → behavior.md §9/1

## Chores
- [x] C1  Rebase after `add-reviewer-wip-claims` lands and verify symmetric Claims are present
- [x] C2  Add root Pi package metadata, peer dependencies, and Node test command
- [x] C3  Add TypeScript extension modules without a build or runtime dependency
- [x] C4  Add exact-assignment support to `loom-implement` and `loom-review`
- [x] C5  Preserve all existing POSIX installer tests and behavior
- [ ] C6  Record live Pi/GitHub and local Git-package acceptance checks

## Docs
- [ ] D1  Update `docs/loom/project.md`, README, and installed orientation for Pi-native usage
- [ ] D2  Create `docs/capabilities/worker-console.md`
- [ ] D3  Update `docs/capabilities/workflow.md`
- [ ] D4  Update `docs/capabilities/installation.md`
