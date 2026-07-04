# Behavior - Add architecture review skill

Feature: Installing Loom's architecture review skill

  Scenario: Checkout install includes the architecture review skill
    Given a Loom checkout with a `skills/loom-architecture` source skill
    When the installer installs Loom into a project for the Codex Harness
    Then the project has `.codex/skills/loom-architecture/SKILL.md`
    And the existing core Loom skills are still installed

  Scenario: Remote release payload requires the architecture review skill
    Given a remote Loom release archive is missing `skills/loom-architecture/SKILL.md`
    When the remote installer validates the release archive
    Then the install is rejected as an invalid Loom release archive
    And no project or user install files are written

  Scenario: Remote install includes the architecture review skill
    Given a valid remote Loom release archive containing `skills/loom-architecture`
    When the remote installer installs Loom into a project for the Codex Harness
    Then the project has `.codex/skills/loom-architecture/SKILL.md`
    And the project has the normal Loom docs scaffold

  Scenario: Uninstall removes the architecture review skill
    Given Loom is installed into a project with `loom-architecture`
    And the project has Durable docs
    When the installer uninstalls Loom from the Codex Harness
    Then `.codex/skills/loom-architecture` is removed
    And the Durable docs remain
