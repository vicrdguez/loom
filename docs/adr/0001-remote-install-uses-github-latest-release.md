# Remote Install Uses GitHub Latest Release

Loom's primary copy-paste install command reads `install.sh` from the GitHub `main` branch, and the
default remote install resolves and installs the latest non-prerelease GitHub release archive. GitHub
is the canonical host for releases and PRs; Codeberg is only a mirror.

## Consequences

The default remote install is convenient but not pinned. The installer must fail clearly when no
non-prerelease GitHub release exists, and it must not silently fall back to `main` or to the Codeberg
mirror.
