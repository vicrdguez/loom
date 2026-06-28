# Add remote install

## Why
Users currently have to clone the Loom repository before they can run `./install.sh`. That makes the
first install heavier than it needs to be and makes the README's primary path less copy-pasteable.

## What
Add a remote install path that lets users pipe the hosted installer into `sh`, while preserving the
existing local checkout installer behavior.

## Scope
- Document Codeberg as the primary host for the copy-paste remote install command.
- Make `install.sh` bootstrap a hosted payload when it is run without the Loom payload files beside
  it.
- Resolve the latest non-prerelease Codeberg release by default.
- Support explicit tag or branch selection through `--ref REF` and `LOOM_REF`, with `--ref` taking
  precedence.
- Keep local checkout installs working from `./install.sh`.
- Keep `--dry-run` and `--uninstall` working through the remote install path.
- Add dependency-free POSIX shell tests for installer behavior.
- Update README, installer usage text, project test command, and the installation capability doc.

## Out of scope
- Requiring users to have Git installed.
- Automatically falling back to `main`, prereleases, or a GitHub mirror.
- Checksum or signature verification for release archives.
- Persistent download caches.
- Adding a shell test framework dependency.
- Changing the supported harnesses or the meaning of project/global installs.

## Done
- The README leads with `curl -fsSL https://codeberg.org/vicrodriguez/loom/raw/branch/main/install.sh | sh`.
- Running `./install.sh` from a checkout still installs from the bundled local payload.
- Running the remote installer without `--ref` or `LOOM_REF` installs the latest non-prerelease
  Codeberg release archive.
- Running the remote installer with `LOOM_REF` installs the requested tag or branch instead of
  resolving the latest release.
- Running the remote installer with `--ref REF` installs `REF`, even when `LOOM_REF` is also set.
- If no non-prerelease release exists, the remote installer fails clearly before modifying project or
  user install files.
- If the downloaded archive is missing required Loom payload files, the remote installer fails
  clearly before modifying project or user install files.
- Remote `--dry-run` may fetch metadata and a temporary archive, but it does not modify project or
  user install files.
- Remote `--uninstall` removes Loom skills and the AGENTS block while preserving docs, glossary, and
  capability files.
- Remote bootstrap works with `curl` or `wget`, and fails clearly when neither is available.
- Installer tests run offline through a dependency-free POSIX shell test command.
- `docs/capabilities/installation.md` summarizes the installation guarantees with test references.
