# Tasks - Add remote install

## Behavioral
- [x] B1  Install from a checkout using the bundled payload              -> behavior.md scenario 1
- [x] B2  Install the latest non-prerelease release                      -> behavior.md scenario 2
- [x] B3  Select an explicit ref for remote install                      -> behavior.md scenario 3
- [x] B4  Fail when no stable release exists                             -> behavior.md scenario 4
- [x] B5  Reject an invalid remote payload                               -> behavior.md scenario 5
- [x] B6  Dry-run remote install makes no project or user install changes -> behavior.md scenario 6
- [x] B7  Remote uninstall removes Loom artifacts and preserves docs      -> behavior.md scenario 7
- [x] B8  Fetch the remote payload with an available downloader           -> behavior.md scenario 8
- [x] B9  Fail clearly when no downloader is available                    -> behavior.md scenario 9

## Chores
- [x] C1  Add `test/install_test.sh` as a dependency-free POSIX shell test runner.
- [x] C2  Refactor `install.sh` into local-payload install and remote-bootstrap phases.
- [x] C3  Add `--ref REF` parsing, `LOOM_REF` handling, usage text, and precedence behavior.
- [x] C4  Add offline release metadata and archive fixtures for installer tests.
- [x] C5  Update `docs/loom/project.md` with the installer test command.
- [x] C6  Update README install instructions to lead with the Codeberg remote command.

## Docs
- [x] D1  Create `docs/capabilities/installation.md` with test references.
