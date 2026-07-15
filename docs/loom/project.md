# Project

<!--
On-demand config for Loom skills (loom-explore reads conventions; loom-apply reads commands).
Loaded only when a skill needs it, so it stays out of every-session context. Run /loom-init to
have it synthesized from your existing AGENTS.md / README / manifests, or fill it in by hand.
-->

## Stack
Dependency-free TypeScript Pi extension, Node's built-in test runner, POSIX `sh` installer, and
Markdown documentation.

## Commands
- **Test:** `npm test`
- **Worker tests:** `node --test test/loom_workers.test.ts`
- **Installer tests:** `sh test/install_test.sh`
- **Build:** None; Pi and modern Node load TypeScript directly.
- **Lint/format:** None configured.

## Conventions
- Keep the Pi package free of runtime dependencies and lifecycle scripts; Pi core imports are peers.
- Keep `install.sh` POSIX `sh` with no language runtime dependency and no Pi-specific behavior.
- Use Node's built-in test runner for the Worker console and dependency-free shell tests for installer behavior.

## Forge
<!-- loom-submit reads this to open the PR. The token is an ENV VAR, never written here. -->
- **Host:** github
- **Repo:** vicrdguez/loom
- **PR token env var:** GH_TOKEN — set in your shell, not here.

## Constraints
- Remote install defaults to GitHub release archives and must not require Git.
- Codeberg is a mirror only; GitHub is the canonical host for releases and PRs.
