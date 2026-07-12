# Installation
How Loom installs and removes its skills, docs scaffold, and agent instructions.

## Behaviors
- A checkout install uses the payload beside `install.sh` and does not request remote release data.
  -> `test/install_test.sh::test_checkout_install_includes_architecture_review_skill`
  (updated 2026-07-04)
- Remote install resolves the latest non-prerelease GitHub release by default, then hands off to
  that release archive's own installer.
  -> `test/install_test.sh::test_install_latest_non_prerelease_release` (added 2026-06-28)
- `LOOM_REF` selects an explicit remote tag or branch, and `--ref REF` takes precedence over
  `LOOM_REF`.
  -> `test/install_test.sh::test_select_explicit_ref_for_remote_install` (added 2026-06-28)
- Remote install fails before project or user install writes when no stable release exists, when the
  selected archive is missing required payload files, or when neither `curl` nor `wget` is
  available.
  -> `test/install_test.sh::test_fail_when_no_stable_release_exists`,
  `test/install_test.sh::test_reject_invalid_remote_payload`,
  `test/install_test.sh::test_fail_clearly_when_no_downloader_is_available` (added 2026-06-28)
- Remote payload validation is structural: a release archive is accepted when it carries the
  installer, templates, and at least one `loom-*` skill. The selected archive's own installer owns
  the exact skill roster.
  -> `test/install_test.sh::test_accept_remote_payload_with_unfamiliar_skill_roster`
  (added 2026-07-08)
- Remote install includes the required first-class Loom skills, including `loom-architecture`, and
  the normal Loom docs scaffold.
  -> `test/install_test.sh::test_remote_install_includes_architecture_review_skill`
  (added 2026-07-04)
- Remote `--dry-run` may fetch temporary release data but does not change project or user install
  files.
  -> `test/install_test.sh::test_dry_run_remote_install_makes_no_project_or_user_install_changes`
  (added 2026-06-28)
- Remote `--uninstall` removes Loom skills and the AGENTS block while preserving docs, glossary, and
  capability files.
  -> `test/install_test.sh::test_remote_uninstall_removes_loom_artifacts_and_preserves_durable_docs`
  (updated 2026-07-04)
- Remote bootstrap can fetch archives with either `curl` or `wget`.
  -> `test/install_test.sh::test_fetch_remote_payload_with_available_downloader` (added 2026-06-28)
- Without `--cli`, installation leaves any Worker-console files untouched and preserves the existing
  skills-only lifecycle.
  -> `test/install_test.sh::test_cli_is_untouched_without_opt_in` (added 2026-07-12)
- `--cli` installs a version-matched user-level console release for macOS/Linux on arm64/x86_64;
  dry-run and uninstall remain symmetric.
  -> `test/install_test.sh::test_install_cli_artifact_for_supported_hosts`,
  `test/install_test.sh::test_cli_dry_run_and_uninstall_are_symmetric` (added 2026-07-12)
- CLI installation rejects unsupported hosts and refs without a published versioned artifact before
  writing the executable.
  -> `test/install_test.sh::test_reject_unsupported_cli_host_before_writing`,
  `test/install_test.sh::test_reject_cli_without_versioned_release` (added 2026-07-12)
- Each release builds and smoke-tests four ERTS-containing CLI assets with the same tag as the source
  release.
  -> `test/install_test.sh::test_release_workflow_builds_and_smokes_all_cli_assets`
  (added 2026-07-12)

## Decisions
- Remote install uses GitHub latest stable releases by default, with explicit refs for pinned or
  development installs. - [ADR-0001](../adr/0001-remote-install-uses-github-latest-release.md)
- Worker-console artifacts are standard target-specific Mix releases containing ERTS.
  - [ADR-0005](../adr/0005-worker-console-uses-elixir-and-ex-ratatui.md)

## Language
**Harness**, **Project install**, **Global install**, **Remote install**, **Release archive**, and
**Worker console** - see [CONTEXT.md](../../CONTEXT.md).
