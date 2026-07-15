# Behavior — Add additive WIP Claims

Feature: Install the five-label Board model

  Scenario Outline: Provision the WIP label on every supported forge
    Given Loom is installed with the <forge> Board reference
    When a planner follows `/loom-propose` to publish a Change
    Then the idempotent label setup includes `loom:wip`
    And the reference describes five Board labels

    Examples:
      | forge    |
      | GitHub   |
      | GitLab   |
      | Codeberg |

Feature: Select unclaimed implementation work

  Scenario: Filter Claims before selecting one item
    Given an older implementation object has its lifecycle label and `loom:wip`
    And a later implementation object has only its lifecycle label
    When an implementor follows the Board selection instructions
    Then the claimed object is excluded before preference, age ordering, and the one-item limit
    And the later eligible object remains discoverable

  Scenario: Prefer eligible rework over eligible ready work
    Given an unclaimed `loom:rework` PR and an unclaimed `loom:ready` issue
    When an implementor selects Board work
    Then the rework PR is selected first

Feature: Claim implementation work before local access

  Scenario Outline: Add an advisory Claim without replacing lifecycle
    Given an unclaimed object carrying <lifecycle>
    When the implementor successfully Claims it
    Then the object carries <lifecycle> and `loom:wip`
    And only then may the implementor fetch, check out, or modify the Change

    Examples:
      | lifecycle     |
      | `loom:ready`  |
      | `loom:rework` |

  Scenario: Fail closed when Claim outcome is unsuccessful or ambiguous
    Given adding `loom:wip` fails or times out
    When the implementor cannot prove a successful Claim
    Then it exits without fetching, checking out, or modifying the Change
    And it reports the forge failure for human inspection

Feature: Preserve and release Claims deliberately

  Scenario: Retain an interrupted Claim
    Given implementation failed or was interrupted after a successful Claim
    When no successful review handoff occurred
    Then `loom:wip` remains on the lifecycle-labeled object
    And no Worker automatically expires or removes it

  Scenario: Human requeues interrupted implementation
    Given an interrupted object still carries its lifecycle label and `loom:wip`
    When a human requeues the object
    Then only `loom:wip` is removed
    And the lifecycle label remains

  Scenario: Release a ready-issue Claim after opening review
    Given implementation of a `loom:ready + loom:wip` issue is complete
    When the implementor presents the Change
    Then it first opens a PR carrying `loom:review`
    And it closes the ready issue with a reference to that PR
    And only then removes `loom:wip` from the closed issue

  Scenario: Release a rework Claim by handing the PR to review
    Given rework of a `loom:rework + loom:wip` PR is complete
    When the implementor re-presents the Change
    Then the PR loses `loom:rework` and `loom:wip`
    And the PR gains `loom:review`

  Scenario: Report a partial handoff as incomplete
    Given one or more review-handoff operations fail
    When the observable Board state does not show reviewer eligibility with Claim cleanup complete
    Then the implementor reports the exact incomplete Board state
    And it does not present the run as successful or select another Change

Feature: Use valid Forgejo label operations

  Scenario: Resolve Codeberg label names to numeric IDs
    Given Forgejo label mutation endpoints require numeric label IDs
    When the Codeberg reference adds, replaces, or removes Board labels
    Then it resolves the required label names from the repository label list
    And it sends numeric IDs to the Forgejo API

Feature: Document advisory Claim semantics

  Scenario: Explain the remaining simultaneous-selection race
    Given two implementors select the same unclaimed object before either Claim is visible
    When both attempt to add the same additive marker
    Then Loom does not promise atomic ownership or claimant identity
    And the installed instructions describe `loom:wip` as an advisory Claim rather than a lock
