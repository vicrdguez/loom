# Forge: GitHub

CLI: [`gh`](https://cli.github.com/). Token: the env var named in `project.md` (for this repo:
`GH_TOKEN`) — `gh` reads `GH_TOKEN` / `GITHUB_TOKEN` automatically. Never read a token from
`project.md`.

GitHub calls them **pull requests** and supports native **draft** state.

## Prerequisites

Run from the change worktree after the change branch has been pushed to GitHub. Use the repo from
`project.md` in every command:

```sh
gh auth status -h github.com
```

If `gh` is not authenticated, the human should run `gh auth login` or export the token env var named
in `project.md`.

## Does a PR already exist for this branch?

```sh
gh pr list --repo "<owner>/<repo>" --head "<slug>" --state open --json number,isDraft,url
```

If one exists, **update** it (below) instead of creating a new one.

## Create

Write the body to a file first (it comes from `acceptance.md` on green, or the verify-failure report
on red).

```sh
# red → draft
gh pr create --repo "<owner>/<repo>" --draft --title "<title>" --body-file body.md --base main --head "<slug>"
# green → ready
gh pr create --repo "<owner>/<repo>"         --title "<title>" --body-file body.md --base main --head "<slug>"
```

## Update an existing PR

```sh
gh pr edit  <number> --repo "<owner>/<repo>" --body-file body.md      # refresh the body
gh pr ready <number> --repo "<owner>/<repo>"                          # flip draft -> ready once green
gh pr ready <number> --repo "<owner>/<repo>" --undo                   # flip ready -> draft on red
```

If GitHub rejects `--undo` because draft PR conversion is not supported for that host or plan, leave
the PR body updated with the red verification report and mention the failed draft conversion in the
handoff. Do not open a second PR.
