# Behavior — Add reviewer WIP Claims

Gherkin is notation here, not a runtime. Each scenario becomes a dependency-free installed-payload
or forge-command-contract test in `test/install_test.sh`.

## Feature: Select unclaimed review work

  ### Scenario Outline: Filter reviewer Claims before selecting one PR
  - Given an older `loom:review + loom:wip` PR on <forge>
  - And a later PR carrying only `loom:review`
  - When a reviewer follows the installed Board discovery instructions
  - Then the claimed PR is excluded before age ordering and the one-item limit
  - And the later unclaimed PR is selected

  Examples:
  | forge    |
  | GitHub   |
  | GitLab   |
  | Codeberg |

## Feature: Claim review work before local access

  ### Scenario Outline: Add an advisory reviewer Claim without replacing lifecycle
  - Given an unclaimed `loom:review` PR on <forge>
  - When a reviewer successfully Claims it
  - Then the PR carries `loom:review + loom:wip`
  - And only then may the reviewer fetch, check out, or inspect the Change

  Examples:
  | forge    |
  | GitHub   |
  | GitLab   |
  | Codeberg |

  ### Scenario: Fail closed when a reviewer Claim is unsuccessful or ambiguous
  - Given adding `loom:wip` fails or its result cannot be proven
  - When the reviewer evaluates the Claim outcome
  - Then it exits without fetching, checking out, or inspecting the Change
  - And it reports the forge failure for human inspection

## Feature: Preserve and release reviewer Claims deliberately

  ### Scenario: Retain an interrupted reviewer Claim
  - Given a reviewer successfully added `loom:wip`
  - And review fails or is interrupted before a handoff
  - When the Worker invocation ends
  - Then the PR remains `loom:review + loom:wip`
  - And no Worker removes or expires the Claim automatically

  ### Scenario: Human requeues an interrupted review
  - Given an interrupted PR carries `loom:review + loom:wip`
  - When a human requeues the review using the installed forge instructions
  - Then only `loom:wip` is removed
  - And `loom:review` remains

  ### Scenario: Release a passing review Claim through done
  - Given a reviewer has completed verification and review on a `loom:review + loom:wip` PR
  - When the reviewer successfully lands and presents the Change
  - Then the PR loses `loom:review` and `loom:wip`
  - And the PR gains `loom:done`

  ### Scenario: Release a failing review Claim through rework
  - Given a reviewer finds a blocking issue on a `loom:review + loom:wip` PR
  - When it hands the Change back
  - Then it first publishes the review findings
  - And the PR loses `loom:review` and `loom:wip`
  - And the PR gains `loom:rework`
  - But the reviewer modifies no code

  ### Scenario: Report a partial reviewer handoff as incomplete
  - Given one or more review-handoff operations fail
  - When Board state does not show `loom:done` or `loom:rework` with `loom:wip` removed
  - Then the reviewer reports the exact incomplete Board state
  - And it does not present the review as successfully handed off

## Feature: Install the symmetric Claim protocol

  ### Scenario: Installed Loom documentation describes reviewer Claims
  - Given Loom is installed into a temporary project
  - When its Role skills, forge references, and orientation are inspected
  - Then reviewers and implementors both use additive `loom:wip` Claims
  - And interrupted Claims require explicit human requeue
  - And Claims remain advisory rather than atomic locks
