# Behavior — Add the multi-model topology (board-coordinated workers)

<!--
Gherkin is notation here, not a runtime. This is a prose change to skill files: these scenarios
materialize into SKILL.md instructions (and README/AGENTS prose), not into automated tests. They are
observable through git / forge / filesystem state and through what each skill's prose instructs. Keep
them as the precise contract for the prose each skill must encode.
-->

Feature: Propose publishes a change to the board on demand

  Background:
    Given a proposed change with its brief committed on the change branch
    And a `## Forge` section configured in docs/loom/project.md

  Scenario: Publish opens a ready issue pointing to the branch
    When loom-propose is asked to publish the change
    Then the change branch is pushed to the forge
    And an issue is opened labeled `loom:ready`
    And the issue body points to the brief on the branch rather than duplicating it

  Scenario: Publish ensures the four labels exist first
    Given the forge does not yet have the Loom labels
    When loom-propose publishes a change for the first time
    Then it creates `loom:ready`, `loom:review`, `loom:rework`, and `loom:done` if missing
    And creating labels is idempotent when they already exist

  Scenario: Without a publish request, propose stays local
    When loom-propose runs without being asked to publish
    Then nothing is pushed to the forge
    And no issue is opened
    And the change exists only in its local worktree, exactly as in the single-model flow

Feature: Implement builds the change and presents it for review

  Background:
    Given a `loom:ready` issue on the board pointing to a change branch

  Scenario: Claim a ready issue and build test-first
    When loom-implement runs
    Then it claims the `loom:ready` issue and checks out its branch
    And it builds the change test-first by composing loom-apply's TDD loop

  Scenario: Open the PR and hand off for review
    When loom-implement finishes building
    Then it pushes the branch
    And it opens a PR labeled `loom:review`
    And it closes the change issue on first PR open

  Scenario: Implement never blesses its own work
    When loom-implement runs to completion
    Then it does not run the verification gate
    And it does not archive the change
    And it never applies the `loom:done` label

  Scenario: Pick up a rework bounce and push to the same PR
    Given a PR labeled `loom:rework` with reviewer feedback as comments
    When loom-implement runs
    Then it reworks the change on the same PR branch
    And it pushes additional commits to that PR
    And it flips the label back to `loom:review`

Feature: Review blesses a green change or bounces it back

  Background:
    Given a PR labeled `loom:review`

  Scenario: Verify independently, not on trust
    When loom-review runs
    Then it re-runs the mechanical verification itself
    And it does not accept the implementor's green suite as sufficient

  Rule: The reviewer is guilty-until-proven on behavior, style, and hygiene

    Scenario: Judge test strength, not mere presence
      When loom-review reads a materialized test against its behavior.md scenario
      Then it assesses whether the test would fail if the behavior broke
      And a test that asserts nothing meaningful is treated as a finding

    Scenario: Ground quality judgment in the project's own skills
      When loom-review assesses style and hygiene
      Then it uses the target project's own quality skills rather than the model's priors

  Scenario: Pass lands the change and marks it done
    Given verification passes and the review finds no blocking issues
    When loom-review finishes
    Then it lands the change by archiving it in the branch and finalizing
    And it labels the PR `loom:done`

  Scenario: Fail bounces with feedback and edits no code
    Given verification or the review surfaces a blocking issue
    When loom-review finishes
    Then it leaves its findings as PR comments
    And it labels the PR `loom:rework`
    And it modifies no code

Feature: Review is a standing model stage in both topologies

  Scenario: Single-model review runs in a fresh context
    Given a single model built the change
    When the review stage runs
    Then loom-review runs in a fresh context — a separate invocation or a spawned reviewer sub-agent
    And the model does not review in the same context that built the change

  Scenario: The human is the final acceptance gate
    Given a PR labeled `loom:done`
    When the human merges it
    Then merging is the acceptance
    And it lands the archive on `main`
