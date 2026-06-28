# Forge: GitHub

CLI: [`gh`](https://cli.github.com/). Token: env var named in `project.md` (commonly `GH_TOKEN` or
`GITHUB_TOKEN`) — `gh` reads it automatically. Never read a token from `project.md`.

GitHub calls them **pull requests** and supports native **draft** state.

## Does a PR already exist for this branch?

```sh
gh pr list --head "<slug>" --state open --json number,isDraft,url
```

If one exists, **update** it (below) instead of creating a new one.

## Create

Write the body to a file first (it comes from `acceptance.md` on green, or the verify-failure report
on red).

```sh
# red → draft
gh pr create --draft --title "<title>" --body-file body.md --base main --head "<slug>"
# green → ready
gh pr create        --title "<title>" --body-file body.md --base main --head "<slug>"
```

## Update an existing PR

```sh
gh pr edit  <number> --body-file body.md      # refresh the body (verify report / acceptance)
gh pr ready <number>                          # flip draft → ready once green
```

There is no "un-ready" via `gh`; a change that regresses to red keeps its existing PR with an updated
red body — do not open a second PR.
