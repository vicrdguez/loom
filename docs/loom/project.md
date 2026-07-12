# Project

<!--
On-demand config for Loom skills (loom-explore reads conventions; loom-apply reads commands).
Loaded only when a skill needs it, so it stays out of every-session context. Run /loom-init to
have it synthesized from your existing AGENTS.md / README / manifests, or fill it in by hand.
-->

## Stack
Elixir 1.19 / OTP 28 application with ExRatatui 0.11, plus a POSIX `sh` installer and Markdown
documentation.

## Commands
- **Test:** `mix test && sh test/install_test.sh`
- **Build:** `mix compile`; production artifact: `MIX_ENV=prod mix release loom_console`
- **Lint/format:** `mix format --check-formatted`

## Conventions
- Keep `install.sh` POSIX `sh` with no language runtime dependency.
- Use dependency-free shell tests for installer behavior.
- Keep Worker lifecycle logic behind the `Lane`, `Harness`, `Board`, `Progress`, and `Store` seams.

## Forge
<!-- loom-submit reads this to open the PR. The token is an ENV VAR, never written here. -->
- **Host:** github
- **Repo:** vicrdguez/loom
- **PR token env var:** GH_TOKEN — set in your shell, not here.

## Constraints
- Remote install defaults to GitHub release archives and must not require Git.
- Codeberg is a mirror only; GitHub is the canonical host for releases and PRs.
- CLI releases include ERTS and target macOS/Linux on arm64/x86_64; Windows is out of scope.
