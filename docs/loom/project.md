# Project

<!--
On-demand config for Loom skills (loom-explore reads conventions; loom-apply reads commands).
Loaded only when a skill needs it, so it stays out of every-session context. Run /loom-init to
have it synthesized from your existing AGENTS.md / README / manifests, or fill it in by hand.
-->

## Stack
POSIX `sh` installer and Markdown documentation.

## Commands
- **Test:** `sh test/install_test.sh`
- **Build:** None.
- **Lint/format:** None configured.

## Conventions
- Keep `install.sh` POSIX `sh` with no language runtime dependency.
- Use dependency-free shell tests for installer behavior.

## Forge
<!-- loom-submit reads this to open the PR. The token is an ENV VAR, never written here. -->
- **Host:** github
- **Repo:** vicrodriguez/loom
- **PR token env var:** GH_TOKEN — set in your shell, not here.

## Constraints
- Remote install defaults to GitHub release archives and must not require Git.
- Codeberg is a mirror only; GitHub is the canonical host for releases and PRs.
