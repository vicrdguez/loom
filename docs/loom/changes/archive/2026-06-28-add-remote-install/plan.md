# Plan - Add remote install

## Approach
Keep `install.sh` as the single public installer. At startup it should decide whether it is running
with a local Loom payload beside it. If the payload is present, continue through the existing local
installer path. If the payload is absent, treat the run as a remote bootstrap: resolve the effective
ref, download and validate the Codeberg archive into a temporary directory, then invoke the
archive's own `install.sh` with the original user options.

The selected archive's installer performs the real install so install behavior stays tied to the
release payload being installed. The bootstrap process cleans up temporary files after the handoff
returns.

## Module shapes & seams
- Installer CLI: interface `install.sh [options]` plus `LOOM_REF` and `HOME`; hides option parsing,
  payload selection, skill installation, docs scaffolding, and uninstall behavior. Seam:
  local-substitutable filesystem/process -> test by running the script with temporary project/home
  directories and a controlled `PATH`.
- Payload detector: interface `payload_available DIR`; hides the required-file checks. Invariant:
  a payload is valid only when `install.sh`, `AGENTS.tmpl.md`, `templates/project.md`, and the
  `loom-explore`, `loom-propose`, and `loom-apply` skill files are present. Seam: in-process shell
  function -> covered through CLI scenarios with valid and invalid payload fixtures.
- Ref resolver: interface `effective_ref CLI_REF ENV_REF`; hides precedence rules. Invariants:
  `--ref` wins over `LOOM_REF`; an explicit ref skips latest-release lookup; an unset ref resolves
  the latest non-prerelease Codeberg release. Seam: in-process shell function with true-external
  Codeberg metadata behind the download function -> tests use fake `curl`/`wget` fixtures.
- Archive fetcher: interface `fetch_archive REF DEST`; hides Codeberg archive URLs, downloader
  selection, and extraction. Invariants: use Codeberg only; support `curl` and `wget`; require no
  Git, jq, Python, Ruby, or Node. Seam: true-external network -> tests replace fetch tools on `PATH`
  and serve local fixture metadata and tarballs.
- Remote handoff: interface `run_payload_install PAYLOAD_DIR ARGS...`; hides invocation and cleanup.
  Invariants: pass the user's install options through unchanged, run the selected archive's own
  installer, preserve the selected install exit status, and remove temporary payload files.
- Installer tests: interface `sh test/install_test.sh`; hides temp project/home setup, fake
  downloader setup, and fixture archive creation. Seam: local process/filesystem -> normal test runs
  are offline and dependency-free.

## Pinned decisions
- Codeberg is the primary source. Do not silently fall back to GitHub or any other host.
- The documented remote command reads `install.sh` from Codeberg `main`, but default installation
  uses the latest non-prerelease Codeberg release archive. See ADR-0001.
- If no non-prerelease release exists, fail clearly. Do not silently install `main`.
- `--ref REF` and `LOOM_REF` may name a tag or branch. `--ref` takes precedence.
- Use `sh` in documentation and keep the installer POSIX shell.
- Do not require Git for remote install.
- Do not add checksum or signature verification in this change.
- Do not add a persistent cache; use temporary directories only.
- Validate the selected payload before creating or modifying project or user install files.
- Remote `--dry-run` may perform bootstrap network/temp work, but must not create or modify project
  or user install files.
- The README's primary install path is the remote command; local `./install.sh` remains documented as
  the checkout/contributor path.

## Sequence
1. Add the POSIX shell installer test harness and fixtures.
2. Cover the existing local checkout install path.
3. Add remote bootstrap ref resolution and archive fetching behind fake downloader tests.
4. Add payload validation and no-write failure behavior.
5. Wire remote handoff, dry-run, and uninstall behavior.
6. Update README, usage text, `docs/loom/project.md`, and `docs/capabilities/installation.md`.
