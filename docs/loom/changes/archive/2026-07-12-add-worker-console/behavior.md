# Behavior — Add the Worker console

Gherkin is notation here, not a runtime. Each scenario becomes an idiomatic ExUnit or shell test at
the named module seam; release and documentation scenarios are encoded in workflow/installer tests.

## 1. CLI bootstrap and local ownership

Feature: Start a project Worker console

  Scenario: Configure Worker specifications on first launch
    Given an initialized Loom project with Codex and GitHub available
    And no saved Worker-console state for that project
    When the operator runs `loom`
    Then first-run setup requests a model and reasoning effort for implementor and reviewer
    And it saves Harness-neutral Worker specifications in per-project local state
    And it opens persistent implementor and reviewer Role lanes

  Scenario: Allow matching models with a Model diversity warning
    Given the operator selects the same model for implementor and reviewer
    When first-run setup validates the Worker specifications
    Then it warns that Model diversity is absent
    But it accepts the configuration
    And every Worker invocation is still configured with a fresh context

  Scenario Outline: Enforce exclusive ownership without trapping stale locks
    Given a project ownership record whose owner is <owner_state>
    When another `loom` process starts for that project
    Then startup <outcome>

    Examples:
      | owner_state | outcome                                                   |
      | live        | is refused with the owning process and state location     |
      | stale       | recovers the ownership record and opens the console       |

  Scenario Outline: Fail preflight with an actionable diagnostic
    Given <requirement> is unavailable
    When the operator runs `loom`
    Then no Worker is launched
    And startup explains <remedy>

    Examples:
      | requirement               | remedy                                      |
      | an initialized project    | that `/loom-init` must run first            |
      | the Codex executable      | how to install or expose Codex              |
      | the GitHub CLI executable | how to install or expose `gh`               |
      | required Codex exec flags | that the installed Codex lacks a capability |

## 2. Role-lane scheduling and recovery

Feature: Supervise one Worker per Role lane

  Scenario Outline: Launch a fresh Worker for claimable Board work
    Given the <role> Role lane is active and idle
    And the oldest preferred Board item is labeled <label>
    When the lane polls the Board
    Then it launches one fresh <role> Worker for exactly one Change
    And further polls launch no second Worker while that invocation is active

    Examples:
      | role        | label         |
      | implementor | `loom:rework` |
      | implementor | `loom:ready`  |
      | reviewer    | `loom:review` |

  Scenario: Remain visible and idle without claimable work
    Given a Role lane is active
    And the Board has no claimable item for that Role
    When the lane polls the Board
    Then it launches no Worker
    And it remains visible as idle with its last outcome and next poll time

  Scenario: Prefer rework before new implementation
    Given both a `loom:rework` PR and a `loom:ready` issue are claimable
    When the implementor lane polls the Board
    Then it presents the rework PR as the current Change
    And it launches the implementor for rework before the ready issue

  Scenario Outline: Reconcile Worker exit against Board truth
    Given a Worker invocation exits
    And the Board lookup is <board_result>
    When the lane reconciles the invocation
    Then the lane enters <lane_result>
    And the retry budget is <budget_result>

    Examples:
      | board_result                         | lane_result                  | budget_result |
      | the expected Role handoff occurred   | cooldown before polling       | reset         |
      | the same item remains claimable      | retry backoff                 | consumed      |
      | temporarily unavailable              | degraded Board state          | unchanged     |

  Scenario Outline: Pause after three consecutive Worker failures
    Given the same Board item has had three consecutive <failure>
    When the third failure is reconciled
    Then the Role lane pauses with the item and failure reasons visible
    And it launches nothing until the operator runs `retry` or `resume`

    Examples:
      | failure                                         |
      | Harness launch failures                         |
      | Worker exits without the expected Board handoff |

  Scenario: Recover automatically when the Board returns
    Given a Role lane is degraded because GitHub was unavailable
    When a later Board read succeeds
    Then the lane reconciles current Board truth
    And it resumes normal scheduling without spending a Worker retry

  Scenario: Do not terminate a silent Worker automatically
    Given a Worker remains alive without emitting a Codex event
    When its silence exceeds the UI warning threshold
    Then the lane shows elapsed runtime and time since the last event
    But it does not terminate or retry the Worker

  Scenario Outline: Apply deterministic lane-control commands
    Given the <role> lane has <starting_state>
    When the operator runs `<command> <role>`
    Then the lane <outcome>

    Examples:
      | role        | starting_state | command | outcome                                              |
      | implementor | idle           | pause   | prevents new Workers while remaining inspectable    |
      | reviewer    | paused         | resume  | clears the manual pause and polls again              |
      | implementor | failed         | retry   | clears failure pause and retries in a fresh context  |
      | reviewer    | running        | stop    | stops the Worker gracefully and remains paused       |

  Scenario: Quit safely while a Worker is active
    Given at least one Role lane has an active Worker
    When the operator runs `quit`
    Then the console requests confirmation
    And on confirmation it gracefully stops active Workers before exiting
    And if graceful termination does not finish it offers an explicit force termination
    But it never leaves a detached Worker behind

## 3. Harness translation and Codex events

Feature: Run Codex through a Harness-neutral interface

  Scenario: Translate a Worker specification without a Codex profile
    Given a Worker specification with Role, model, reasoning effort, project root, and fixed policy
    When `Harness.Codex` starts the Worker
    Then it invokes non-interactive Codex with explicit model, reasoning, sandbox, prompt, and root
    And it requests ephemeral JSONL output
    And it delegates authentication and credentials to Codex
    But it does not require or name a Codex profile

  Scenario Outline: Normalize only useful Codex JSONL events
    Given `Harness.Codex.Event` receives <event>
    When it decodes the JSONL line
    Then its result is <result>

    Examples:
      | event                                  | result                                  |
      | completed agent message                | a Markdown Activity message             |
      | thread or turn lifecycle               | a normalized lifecycle event            |
      | Codex error                            | a normalized failure event              |
      | reasoning item                         | ignored                                 |
      | command execution item                 | ignored                                 |
      | file change item                       | ignored                                 |
      | tool, search, or plan item             | ignored                                 |
      | unknown event type                     | ignored                                 |
      | malformed required lifecycle fields    | an adapter error                        |

## 4. Trustworthy progress and restart state

Feature: Report progress from durable evidence

  Scenario Outline: Describe progress without inventing completion
    Given the current Change <task_state>
    When `Progress.snapshot/2` reads its Board and repository state
    Then it reports Board stage, scenario count, and slice commits separately
    And it <task_result>
    And it contains no inferred completion percentage

    Examples:
      | task_state                              | task_result                                      |
      | has a tasks ledger with checked entries | reports the checked and total task counts        |
      | has no tasks ledger                     | explicitly reports that no task ledger exists    |

Feature: Restore local console intent without trusting stale runtime state

  Scenario: Reconstruct lanes after restart
    Given `Store` contains Worker specifications, preferences, pauses, per-item failures, and history
    And its last snapshot says a Worker was running
    When the console restarts
    Then it restores operator intent and retry protection
    But it does not restore the running claim as truth
    And each lane reconstructs current state through `Progress`

  Scenario: Retain only bounded filtered Activity history
    Given a Role lane receives Activity messages and raw ignored Codex events beyond its retention limit
    When `Store` persists and reloads its history
    Then only the bounded recent Activity and lifecycle records are available
    And no reasoning, tool output, command output, code change, or raw JSONL is persisted

## 5. Console presentation and commands

Feature: Present stable Role lanes

  Scenario Outline: Adapt the lane layout to terminal width
    Given the console terminal is <size>
    When `UI` renders the dashboard
    Then it shows <layout>
    And the Console command line remains fixed at the bottom

    Examples:
      | size   | layout                                                      |
      | wide   | implementor and reviewer lanes side by side                  |
      | narrow | one full-width focused lane with a Role switcher              |

  Scenario: Separate status, evidence, and Activity in each lane
    Given a Role lane has current state, Progress evidence, and Activity messages
    When `UI` renders it
    Then its header shows Role, state, model, Change, elapsed time, and last event
    And its evidence area shows Board, tasks, scenarios, commits, and retry state
    And its body shows scrollable Markdown Activity and lifecycle errors

Feature: Inspect and control the console through deterministic commands

  Scenario Outline: Navigate and inspect local and durable state
    Given the <role> lane is focused
    When the operator runs `<command>`
    Then `Command` returns <result>

    Examples:
      | role        | command    | result                                      |
      | implementor | status     | the lane and Progress summary               |
      | implementor | tasks      | the Change task ledger                      |
      | implementor | log        | recent slice commits                        |
      | implementor | diff       | a read-only formatted git diff              |
      | reviewer    | board      | the current read-only Board state           |
      | reviewer    | activity   | retained filtered Activity                  |
      | reviewer    | refresh    | a newly derived Progress snapshot           |
      | implementor | focus review | the reviewer lane becomes focused           |
      | reviewer    | help         | the supported command reference             |

  Scenario: Configure model policy locally
    Given the operator runs `config implement` or `config review`
    When a new model or reasoning effort is accepted
    Then the relevant Worker specification is saved locally
    And the fixed Role prompt and capability policy remain unchanged

  Scenario: Reject shell and workflow mutation commands
    Given a command requests shell execution or a code, git, issue, PR, or label mutation
    When `Command` parses it
    Then it returns an unsupported-command diagnostic
    And it performs no external mutation

  Scenario: Open long results in the inspector
    Given an inspection command returns content longer than the inline result area
    When `UI` presents the result
    Then it opens a scrollable Markdown or code-formatted inspector over the lanes
    And `Esc` returns to the unchanged dashboard

## 6. CLI installation and release artifacts

Feature: Install the optional Loom CLI

  Scenario Outline: Resolve the CLI artifact for supported hosts
    Given `install.sh --cli` resolved Loom release <version>
    And the host is <os> on <arch>
    When installation runs
    Then it downloads the matching `loom` artifact from release <version>
    And it exposes one user-level `loom` launcher without requiring Elixir or Erlang on the host

    Examples:
      | version | os      | arch    |
      | v1.2.3  | macOS   | arm64   |
      | v1.2.3  | macOS   | x86_64  |
      | v1.2.3  | Linux   | arm64   |
      | v1.2.3  | Linux   | x86_64  |

  Scenario: Leave the CLI untouched without the opt-in flag
    Given the CLI is not already installed
    When the existing installer runs without `--cli`
    Then it installs Loom skills as before
    And it does not download or write a CLI artifact

  Scenario Outline: Preserve installer lifecycle semantics for the CLI
    Given the installer is run with `--cli` and <operation>
    When it reports the planned CLI action
    Then the CLI filesystem result is <result>

    Examples:
      | operation     | result                                  |
      | `--dry-run`   | unchanged                               |
      | `--uninstall` | the installed user-level CLI is removed |

  Scenario: Reject an unsupported host clearly
    Given `install.sh --cli` runs on Windows or an unsupported architecture
    When it resolves the platform artifact
    Then it fails before writing the CLI
    And it names the unsupported operating system and architecture

  Scenario Outline: Reject CLI installation without a versioned release artifact
    Given `install.sh --cli` runs from <source>
    And no matching published CLI artifact can be identified
    When installation resolves the CLI version
    Then it fails before writing the CLI
    And it explains that prebuilt CLI installation requires a published Loom release tag

    Examples:
      | source                             |
      | an unversioned local checkout      |
      | an explicit development branch ref |

Feature: Publish a coherent Loom release

  Scenario: Release workflows publish and smoke-test every CLI artifact
    Given a Loom release tag is published
    When the release workflows complete
    Then the source archive and all four supported `loom` artifacts share that tag
    And every artifact was built as a standard Mix release containing ERTS
    And each artifact passed a platform smoke test for `loom --version`

## 7. Canonical Board-topology documentation

Feature: Describe the topology Loom now ships

  Scenario: Replace superseded workflow language
    Given Loom's README, AGENTS orientation, templates, project config, installed Worker skills, and
    capability docs
    When the Worker-console Change is complete
    Then they call board-coordinated operation the Board topology
    And they make fresh Worker context the invariant while Model diversity remains optional
    And they describe the first-party Worker console instead of saying Loom ships no runtime
    And the project config lists Mix and installer verification commands
