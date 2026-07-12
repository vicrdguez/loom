# Tasks — add-worker-console

## Behavioral
- [x] B1  Configure Worker specifications on first launch                    → behavior.md §1/1
- [x] B2  Allow matching models with a Model diversity warning              → behavior.md §1/2
- [x] B3  Enforce exclusive ownership and recover stale locks               → behavior.md §1/3
- [x] B4  Fail capability preflight with an actionable diagnostic           → behavior.md §1/4
- [x] B5  Launch one fresh Worker for claimable Role work                    → behavior.md §2/1
- [x] B6  Remain visible and idle without claimable work                     → behavior.md §2/2
- [x] B7  Prefer implementor rework before ready work                        → behavior.md §2/3
- [x] B8  Reconcile Worker exit against Board truth                          → behavior.md §2/4
- [x] B9  Pause after three consecutive Worker failures                      → behavior.md §2/5
- [x] B10 Recover automatically when the Board returns                       → behavior.md §2/6
- [x] B11 Do not terminate a silent Worker automatically                     → behavior.md §2/7
- [x] B12 Apply deterministic lane-control commands                          → behavior.md §2/8
- [x] B13 Quit safely while a Worker is active                               → behavior.md §2/9
- [x] B14 Translate a Worker specification without a Codex profile           → behavior.md §3/1
- [x] B15 Normalize only useful Codex JSONL events                           → behavior.md §3/2
- [x] B16 Describe Progress without inventing completion                     → behavior.md §4/1
- [x] B17 Reconstruct lanes after restart                                    → behavior.md §4/2
- [x] B18 Retain only bounded filtered Activity history                      → behavior.md §4/3
- [x] B19 Adapt the lane layout to terminal width                            → behavior.md §5/1
- [x] B20 Separate status, evidence, and Activity in each lane                → behavior.md §5/2
- [x] B21 Navigate and inspect state through Console commands                 → behavior.md §5/3
- [x] B22 Configure model policy locally                                     → behavior.md §5/4
- [x] B23 Reject shell and workflow mutation commands                        → behavior.md §5/5
- [x] B24 Open long results in the inspector                                 → behavior.md §5/6
- [ ] B25 Resolve and install the CLI artifact for supported hosts           → behavior.md §6/1
- [ ] B26 Leave the CLI untouched without the opt-in flag                    → behavior.md §6/2
- [ ] B27 Preserve dry-run and uninstall semantics for the CLI               → behavior.md §6/3
- [ ] B28 Reject an unsupported CLI host clearly                             → behavior.md §6/4
- [ ] B29 Reject CLI install without a versioned release artifact            → behavior.md §6/5
- [ ] B30 Publish and smoke-test every version-matched CLI artifact          → behavior.md §6/6
- [ ] B31 Replace superseded workflow language with Board-topology terms     → behavior.md §7/1

## Chores
- [x] C1  Scaffold the root Mix/OTP application, ExRatatui dependency, formatter, and release entrypoint
- [x] C2  Add fake Harness/Board adapters, captured Codex JSONL fixtures, temporary-repo helpers, and
          ExRatatui headless test support
- [x] C3  Wire OTP supervision so UI exit stops lanes/Workers and no Worker can outlive the Console
- [ ] C4  Add platform release configuration and GitHub Actions build/smoke matrix for four CLI assets
- [ ] C5  Extend POSIX `install.sh` and dependency-free shell tests with opt-in user-level `--cli`
- [ ] C6  Update `docs/loom/project.md` with Mix test/build/format commands alongside installer tests

## Docs
- [ ] D1  Create `docs/capabilities/worker-console.md` with behavior-to-test links
- [ ] D2  Update `docs/capabilities/workflow.md` for Board topology and first-party scheduling
- [ ] D3  Update `docs/capabilities/installation.md` for optional CLI artifacts and lifecycle
- [ ] D4  Update README and AGENTS/AGENTS template/Claude orientation with canonical topology language
- [ ] D5  Update installed Loom skills and references that still say multi-model or “Loom ships no runtime”
- [ ] D6  Write `acceptance.md` for a real GitHub Board + Codex run and visual wide/narrow TUI checks
