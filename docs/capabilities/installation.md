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

## Decisions
- Remote install uses GitHub latest stable releases by default, with explicit refs for pinned or
  development installs. - [ADR-0001](../adr/0001-remote-install-uses-github-latest-release.md)

## Language
**Harness**, **Project install**, **Global install**, **Remote install**, and **Release archive** -
see [CONTEXT.md](../../CONTEXT.md).
