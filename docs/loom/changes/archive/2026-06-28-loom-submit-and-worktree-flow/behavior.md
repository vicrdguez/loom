# Behavior — Ship changes via a worktree and PR (loom-submit)

<!--
Gherkin is notation here, not a runtime. NOTE (per the change's meta-nature): this is a prose change
to skill files — these scenarios materialize into SKILL.md instructions, not into automated tests.
They are observable through filesystem / git / forge state. Keep them as the precise contract for the
prose each skill must encode.
-->

Feature: Propose isolates each change on its own branch

  Background:
    Given a project on `main` with the Loom skills installed

  Scenario: Commit durable-doc stragglers before branching
    Given uncommitted CONTEXT.md or ADR edits in the main working tree
    When loom-propose runs for a new change
    Then those durable-doc edits are committed to `main`
    And only then is the change branch created

  Scenario: Create the change worktree
    When loom-propose creates the change `<slug>`
    Then a change branch is checked out in `.loom-worktrees/<slug>/`
    And `.loom-worktrees/` is gitignored

  Scenario: GC a merged change's worktree
    Given a previous change whose archive dir exists on `main`
    When loom-propose runs for a new change
    Then the previous change's worktree is removed before the new branch is created

  Scenario: Leave an unmerged change's worktree intact
    Given a previous change with no archive dir on `main`
    When loom-propose runs for a new change
    Then the previous change's worktree is left untouched

Feature: Apply builds without finalizing

  Background:
    Given a change branch checked out in its worktree

  Scenario: Commit per TDD slice
    When loom-apply completes a red-green-refactor slice
    Then it makes one logical commit for that slice

  Scenario: Apply never touches main, archive, or remote
    When loom-apply runs to completion
    Then `main` is unchanged
    And the change is not archived
    And nothing is pushed to a git remote
    And no PR is opened

  Scenario: Write acceptance.md after implementation
    When loom-apply finishes implementing the change
    Then it writes `acceptance.md` with the human-checkable residue learned during implementation
    And it does not modify `intent.md`

  Scenario: Rework edits in place, sticky after first green
    Given a change already archived on its branch from a prior green submit
    When loom-apply reworks it
    Then it edits the change at its `archive/<date>-<slug>/` location
    And it does not move the change back to `changes/`

Feature: Submit publishes the change for human review

  Background:
    Given a built change on its branch

  Rule: The PR is the acceptance gate; only a green change is mergeable and archived

    Scenario: Green change opens a ready PR and archives
      Given verification's three mechanical checks all pass
      When loom-submit runs
      Then the change is archived in the branch
      And the branch is pushed
      And a ready PR is opened whose body contains acceptance.md

    Scenario: Red change opens a draft PR and does not archive
      Given a mechanical check fails
      When loom-submit runs
      Then the change is not archived
      And the branch is pushed
      And a draft PR is opened whose body reports which check failed and where

    Scenario: Plan-drift is a warning, not a block
      Given the three mechanical checks pass but the implementation diverges from plan.md
      When loom-submit runs
      Then the PR body includes a drift warning
      But the PR is opened as ready, not draft

  Scenario: Re-submit updates the existing PR
    Given a draft PR already open for the change branch
    When the change is reworked green and loom-submit runs again
    Then the existing PR is updated rather than a new one created
    And the PR is flipped from draft to ready

  Scenario: Submit never auto-fixes
    Given a mechanical check fails
    When loom-submit runs
    Then it does not modify any code

  Scenario: Forge selected from project config
    Given project.md names the forge and repo
    When loom-submit opens the PR
    Then it follows that forge's reference file
    And it authenticates using an env-var token, never a token from project.md
