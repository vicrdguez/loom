# Forge: GitLab

CLI: [`glab`](https://gitlab.com/gitlab-org/cli). Token: env var named in `project.md` (commonly
`GITLAB_TOKEN`) — `glab` reads it automatically. Never read a token from `project.md`.

GitLab calls them **merge requests (MRs)**, and "draft" is a native state (historically a `Draft:`
title prefix; `glab` exposes flags for it). Everywhere Loom says "PR," read "MR" here.

## Does an MR already exist for this branch?

```sh
glab mr list --source-branch "<slug>" --output json
```

If one exists, **update** it instead of creating a new one.

## Create

```sh
# red → draft
glab mr create --draft --source-branch "<slug>" --target-branch main \
  --title "<title>" --description "$(cat body.md)"
# green → ready
glab mr create --source-branch "<slug>" --target-branch main \
  --title "<title>" --description "$(cat body.md)"
```

## Update an existing MR

```sh
glab mr update <id> --description "$(cat body.md)"   # refresh body
glab mr update <id> --ready                          # flip draft → ready once green
glab mr update <id> --draft                          # send back to draft after a regression
```
