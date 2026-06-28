# Project

<!--
On-demand config for Loom skills (loom-explore reads conventions; loom-apply reads commands).
Loaded only when a skill needs it, so it stays out of every-session context. Run /loom-init to
have it synthesized from your existing AGENTS.md / README / manifests, or fill it in by hand.
-->

## Stack
{Languages, frameworks, and versions. e.g. Elixir 1.17 / Phoenix 1.7 / Postgres 16.}

## Commands
- **Test:** `{e.g. mix test}`
- **Build:** `{e.g. mix compile}`
- **Lint/format:** `{e.g. mix format && mix credo}`

## Conventions
- {Code style, naming, directory layout, anything an implementer should follow.}

## Forge
<!-- loom-submit reads this to open the PR/MR. The token is an ENV VAR, never written here. -->
- **Host:** {github | codeberg | gitlab | a self-hosted Forgejo/Gitea/GitLab URL}
- **Repo:** {owner/name}
- **PR token env var:** {e.g. GH_TOKEN, FORGEJO_TOKEN, GITLAB_TOKEN — set in your shell, not here}

## Constraints
- {Performance, compliance, or integration constraints not obvious from the code.}
