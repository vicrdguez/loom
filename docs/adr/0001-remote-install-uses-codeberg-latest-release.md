# Remote Install Uses Codeberg Latest Release

Loom's primary copy-paste install command reads `install.sh` from the Codeberg `main` branch, but
the default remote install resolves and installs the latest non-prerelease Codeberg release archive.
This keeps the public command stable across releases while preserving release artifacts as the
default install payload; users who need reproducibility or development builds must set `LOOM_REF`
or `--ref` explicitly.

## Consequences

The default remote install is convenient but not pinned. The installer must fail clearly when no
non-prerelease release exists, and it must not silently fall back to `main` or to a GitHub mirror.
