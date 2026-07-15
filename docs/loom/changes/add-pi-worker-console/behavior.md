# Behavior — Add the Pi Worker console

Gherkin is notation here, not a runtime. Public extension behavior becomes `node:test` coverage;
installer and installed-instruction behavior remains in the dependency-free shell suite.

## Feature: Load Loom as a Pi package

  ### Scenario: Discover the extension and every Loom skill
  - Given the repository is installed as a local or Git Pi package
  - When Pi discovers the package manifest
  - Then it loads the `loom-workers` extension
  - And it discovers every bundled `loom-*` skill
  - And no build step, lifecycle install script, or npm-published artifact is required

  ### Scenario: Leave projects unchanged on package installation
  - Given Loom is installed as a Pi package
  - When Pi loads it in a project that has not run `loom-init`
  - Then no project file is created or modified
  - And `/skill:loom-init` remains the explicit initialization path

  ### Scenario: Prefer Harness-native installation without changing the legacy installer
  - Given Loom's installation documentation and `install.sh`
  - When the Pi package is introduced
  - Then Claude Code's plugin and Pi's Git package are documented as preferred Harness-native installs
  - And `install.sh` is documented as a deprecated compatibility path for Codex CLI and OpenCode
  - But `install.sh` gains no Pi option, runtime warning, or behavior change

## Feature: Gate Worker-console startup

  ### Scenario Outline: Refuse unsafe or unsupported startup
  - Given <condition>
  - When the operator runs `/loom-workers start implementor`
  - Then no Role lock or Worker is created
  - And the command reports <remedy>

  Examples:
  | condition                                      | remedy                                      |
  | Pi is not in interactive TUI mode              | that the Worker console is interactive only |
  | Pi has not trusted the project                 | to run `/trust` and restart Pi               |
  | no ancestor contains `docs/loom/project.md`    | to run `/skill:loom-init`                    |
  | the configured forge is not GitHub             | that only GitHub is currently supported      |
  | authenticated `gh` is unavailable              | how to install or authenticate `gh`          |
  | no model is available for the requested Role   | how to configure a Pi model                  |

## Feature: Configure and own Role lanes

  ### Scenario: Select and remember a Role model natively
  - Given available Pi models and no running implementor lane
  - And a previously saved implementor choice may exist for this project
  - When the operator runs `/loom-workers start implementor`
  - Then Pi-native selectors show available model and thinking choices with the last valid choice first
  - And the selected choice is saved user-locally only after the lane starts
  - And later parent `/model` changes do not alter that lane's choice

  ### Scenario: Allow matching Role models with a warning
  - Given the operator selects the same model for implementor and reviewer
  - When both Role lanes start
  - Then the extension warns that Model diversity is absent
  - But both lanes run with independent fresh contexts

  ### Scenario: Start available Roles independently
  - Given `/loom-workers start both` is requested
  - And the reviewer Role lock is already owned by another local Pi process
  - When startup completes
  - Then the implementor lane starts
  - And the reviewer lane does not start
  - And the owning reviewer process and lock are reported

  ### Scenario: Recover a stale Role lock
  - Given a project-and-Role lock whose owning process no longer exists
  - When that Role starts
  - Then the stale lock is replaced atomically
  - And exactly one local lane owns the replacement lock

  ### Scenario: Refuse a second live Role owner
  - Given a live implementor lane owns this project's implementor lock
  - When another local Pi process starts an implementor lane
  - Then the second lane is refused
  - And the first lane remains unchanged

## Feature: Inspect GitHub Board work

  ### Scenario: List all open Board Changes
  - Given open GitHub Board objects carrying lifecycle labels
  - When the operator runs `/loom-workers list`
  - Then the result groups `loom:ready`, `loom:review`, `loom:rework`, and `loom:done` objects
  - And it includes number, title, URL, and `loom:wip` Claim state
  - And closed or unlabeled objects are absent

  ### Scenario: Report current Role status
  - Given Role lanes in any lifecycle state
  - When the operator runs `/loom-workers status`
  - Then each Role reports its current Change and Board object when present
  - And it reports model, state, elapsed time, retry state, last outcome, and next poll

## Feature: Select one exact Board assignment

  ### Scenario: Prefer eligible rework over ready work
  - Given unclaimed `loom:rework` and `loom:ready` objects
  - When the implementor lane selects work
  - Then it selects the oldest rework PR

  ### Scenario Outline: Exclude Claims before oldest-item selection
  - Given an older <lifecycle> object carrying `loom:wip`
  - And a later <lifecycle> object without `loom:wip`
  - When the <role> lane selects work
  - Then the claimed object is excluded before ordering and limiting
  - And the later object becomes the exact assignment

  Examples:
  | role        | lifecycle     |
  | implementor | `loom:ready`  |
  | implementor | `loom:rework` |
  | reviewer    | `loom:review` |

  ### Scenario: Remain idle with no eligible work
  - Given a started Role lane and no eligible unclaimed Board object
  - When the lane polls immediately and at the idle interval
  - Then it launches no Worker
  - And it remains visible as idle with its next poll time

  ### Scenario: Never substitute an ineligible assignment
  - Given the coordinator assigned one exact Board object
  - And that object becomes ineligible before the Role skill Claims it
  - When the Worker verifies its assignment
  - Then it exits without touching that Change
  - And it does not select or Claim another Board object

## Feature: Run one fresh Pi Worker per work unit

  ### Scenario: Run implementor and reviewer concurrently
  - Given one eligible implementor object and one unrelated eligible reviewer object
  - When both Role lanes poll
  - Then each lane creates its own in-memory Pi `AgentSession`
  - And both sessions may run concurrently
  - And neither lane starts a second Worker while its session is active

  ### Scenario: Discard context between consecutive work units
  - Given one Worker invocation has settled
  - When the same Role later receives another work unit
  - Then the second invocation has a distinct session identity and an initially empty message history
  - And it contains no parent-session or previous-Worker conversation
  - And the first session was disposed before the second was created

  ### Scenario: Load standard project policy around the bundled Role contract
  - Given a trusted project with context files, skills, extensions, settings, and tools
  - When a Worker session is created
  - Then standard Pi resource discovery loads that project policy fresh
  - And the package's own `loom-implement` or `loom-review` content is injected directly
  - And the exact Board assignment follows the Role contract
  - And a same-named project skill cannot replace the injected contract

  ### Scenario: Dispose context without cleaning repository work
  - Given a Worker changed files or commits in its Change worktree
  - When its session settles, fails, is cancelled, or is disposed
  - Then those repository changes remain untouched
  - And only the Worker context and runtime resources are discarded

## Feature: Reconcile a Role lane from Board eligibility

  ### Scenario Outline: Classify Board state after session settlement
  - Given a Worker session has settled for an assigned <role> object
  - And observation reports <board_state>
  - When the lane reconciles the assignment
  - Then the lane enters <result>

  Examples:
  | role        | board_state                                      | result             |
  | implementor | the object left implementor eligibility          | cooldown           |
  | reviewer    | the object left reviewer eligibility             | cooldown           |
  | implementor | the object remains eligible without `loom:wip`   | retry backoff       |
  | reviewer    | the object remains eligible without `loom:wip`   | retry backoff       |
  | implementor | current lifecycle plus `loom:wip` remains        | awaiting-requeue    |
  | reviewer    | current lifecycle plus `loom:wip` remains        | awaiting-requeue    |
  | reviewer    | GitHub is temporarily unavailable                | degraded observation|

  ### Scenario: Let Board truth override session failure
  - Given a Worker session reports an error after its object leaves Role eligibility
  - When the lane reconciles after settlement
  - Then the work unit is resolved from Board truth
  - And the session error remains visible only as Activity

  ### Scenario: Pause after three pre-Claim failures
  - Given the same exact item remains eligible without `loom:wip`
  - When three fresh Worker sessions settle without a Claim or handoff
  - Then the Role lane pauses with all three failures visible
  - And no Worker starts until the operator runs `retry`

  ### Scenario: Retry automatically after human requeue
  - Given a Role lane is awaiting requeue on an object carrying lifecycle plus `loom:wip`
  - When a human removes only `loom:wip`
  - Then the lane detects eligibility while polling that exact object
  - And it starts a new Worker with fresh context without requiring a local resume command

  ### Scenario: Pause when an observed Claim becomes orphaned
  - Given the lane observed `loom:wip` on its assigned object
  - When that underlying Board object disappears or is removed without Claim cleanup
  - Then the Role lane pauses with the orphaned Claim visible
  - And it launches no other work

  ### Scenario: Observe only the active assignment while running
  - Given a lane has an active Worker
  - When its normal observation interval arrives
  - Then it rereads only the exact assigned Board object
  - And it records whether `loom:wip` appeared
  - But it never selects or launches another Worker

  ### Scenario: Wait for settlement after eligibility changes
  - Given a running Worker's object leaves Role eligibility
  - When the lane observes that intermediate Board state
  - Then it updates status without aborting the Worker
  - And it waits for session settlement before cooldown and disposal

  ### Scenario: Keep the other Role operational after failure
  - Given one Role lane is in retry backoff, awaiting requeue, paused, or degraded
  - When the other Role finds eligible work
  - Then the other Role may start and complete its own Worker normally

## Feature: Control and shut down Role lanes

  ### Scenario Outline: Apply deterministic lane controls
  - Given the <role> lane is in <starting_state>
  - When the operator runs `/loom-workers <command> <role>`
  - Then the lane <outcome>

  Examples:
  | role        | starting_state    | command | outcome                                                   |
  | implementor | running           | pause   | lets the Worker settle but prevents the next launch       |
  | reviewer    | manually paused   | resume  | resumes polling without resetting a failure budget        |
  | implementor | failure-paused    | retry   | resets the pre-Claim retry budget and polls again          |
  | reviewer    | awaiting-requeue  | retry   | refuses to bypass `loom:wip`                               |
  | implementor | running           | stop    | aborts and disposes the Worker, stops, and releases its lock|

  ### Scenario: Stop extension resources on parent session shutdown
  - Given either Role has an active Worker or timer
  - When the parent Pi session quits, reloads, resumes, forks, or switches to `/new`
  - Then every active Worker receives `abort`
  - And the extension waits no more than five seconds before disposal
  - And timers stop and Role locks are released
  - And no lane restarts automatically in the replacement session
  - But saved model choices remain available

## Feature: Present filtered Activity through Pi

  ### Scenario: Keep Worker narration out of parent model context
  - Given a Worker emits assistant messages, lifecycle events, reasoning, commands, and tool output
  - When the extension presents Worker Activity
  - Then completed assistant messages and lifecycle failures appear as Role-tagged TUI-only entries
  - And compact Role status appears in Pi's native widget or status area
  - But reasoning, commands, raw events, and tool output are not appended
  - And no Worker Activity enters the parent model's message context
