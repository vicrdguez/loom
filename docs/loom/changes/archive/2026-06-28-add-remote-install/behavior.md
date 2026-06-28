# Behavior - Add remote install

Feature: Loom installation

  Rule: Existing local installs keep working

    Scenario: Install from a checkout using the bundled payload
      Given a Loom checkout with skills, templates, and the AGENTS template beside install.sh
      And an empty target project
      When the user runs "./install.sh --tools codex --project <target project>"
      Then the Codex Loom skills are copied into the target project
      And the Loom docs scaffold is created in the target project
      And the Loom block is written to the target project's AGENTS.md
      And no remote release metadata or archive is requested

  Rule: Remote installs use Codeberg release archives by default

    Scenario: Install the latest non-prerelease release
      Given the installer is started without a local Loom payload beside it
      And Codeberg release metadata lists a newer prerelease and an older non-prerelease release
      And the non-prerelease release archive contains a valid Loom payload
      And an empty target project
      When the user runs the remote installer with no ref override
      Then the non-prerelease release archive is selected
      And the selected archive's install.sh performs the install
      And the target project receives Loom skills, docs, and the AGENTS block

    Scenario Outline: Select an explicit ref for remote install
      Given the installer is started without a local Loom payload beside it
      And LOOM_REF is "<env ref>"
      And the command-line arguments are "<arguments>"
      And the archive for "<expected ref>" contains a valid Loom payload
      When the user runs the remote installer
      Then "<expected ref>" is selected for the archive download
      And latest release metadata is not requested
      And the selected archive's install.sh performs the install

      Examples:
        | env ref | arguments       | expected ref |
        | v0.1.0  |                 | v0.1.0       |
        | v0.1.0  | --ref main      | main         |

    Scenario: Fail when no stable release exists
      Given the installer is started without a local Loom payload beside it
      And no Codeberg release metadata entry is a non-prerelease release
      And an empty target project
      When the user runs the remote installer with no ref override
      Then the installer exits unsuccessfully with a clear no-stable-release message
      And the target project is unchanged
      And no user-level harness directories are created or changed

    Scenario: Reject an invalid remote payload
      Given the installer is started without a local Loom payload beside it
      And the selected archive is missing required Loom payload files
      And an empty target project
      When the user runs the remote installer
      Then the installer exits unsuccessfully with a clear invalid-payload message
      And the target project is unchanged
      And no user-level harness directories are created or changed

  Rule: Remote lifecycle flags mirror local installer behavior

    Scenario: Dry-run remote install makes no project or user install changes
      Given the installer is started without a local Loom payload beside it
      And the selected archive contains a valid Loom payload
      And an empty target project
      When the user runs the remote installer with "--dry-run --project <target project>"
      Then the output reports the install operations that would run
      But the target project is unchanged
      And no user-level harness directories are created or changed

    Scenario: Remote uninstall removes Loom artifacts and preserves durable docs
      Given the installer is started without a local Loom payload beside it
      And the selected archive contains a valid Loom payload
      And a target project with installed Codex Loom skills
      And the target project's AGENTS.md contains a Loom block
      And the target project contains docs, CONTEXT.md, and capability docs
      When the user runs the remote installer with "--uninstall --tools codex --project <target project>"
      Then the Codex Loom skills are removed from the target project
      And the Loom block is removed from AGENTS.md
      But docs, CONTEXT.md, and capability docs remain

  Rule: Remote bootstrap uses standard fetch tools

    Scenario Outline: Fetch the remote payload with an available downloader
      Given the installer is started without a local Loom payload beside it
      And the command PATH contains "<available downloader>"
      And the selected archive contains a valid Loom payload
      And an empty target project
      When the user runs the remote installer
      Then the remote payload is fetched with "<available downloader>"
      And the selected archive's install.sh performs the install

      Examples:
        | available downloader |
        | curl                 |
        | wget                 |

    Scenario: Fail clearly when no downloader is available
      Given the installer is started without a local Loom payload beside it
      And the command PATH contains neither curl nor wget
      And an empty target project
      When the user runs the remote installer
      Then the installer exits unsuccessfully with a message requiring curl, wget, or a local checkout
      And the target project is unchanged
      And no user-level harness directories are created or changed
