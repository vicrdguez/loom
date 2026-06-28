# Forge: Codeberg / Forgejo / Gitea

Codeberg runs Forgejo (a Gitea fork). CLI: [`tea`](https://gitea.com/gitea/tea). Token: env var named
in `project.md` (e.g. `FORGEJO_TOKEN`) — never read a token from `project.md`. For a self-hosted
instance, `project.md`'s host is the instance URL.

These forges call them **pull requests** but have **no native draft flag**. Draft is expressed with a
**`WIP:` title prefix** (Forgejo treats a `WIP:`-prefixed PR as not-mergeable). So:

- **red → draft**: title starts with `WIP: `
- **green → ready**: remove the `WIP: ` prefix

## Does a PR already exist for this branch?

```sh
tea pr list --fields index,title,head --output simple | grep "<slug>"
```

If one exists, **update** it instead of creating a new one.

## Create

```sh
# red → draft (WIP prefix)
tea pr create --head "<slug>" --base main --title "WIP: <title>" --description "$(cat body.md)"
# green → ready
tea pr create --head "<slug>" --base main --title "<title>"      --description "$(cat body.md)"
```

## Update an existing PR

`tea` is thin on PR edits; the reliable path is the Forgejo API with the token from the env var
(`$FORGEJO_TOKEN` below — substitute the var named in `project.md`):

```sh
# refresh body and flip WIP → ready by rewriting the title
curl -fsSL -X PATCH \
  -H "Authorization: token $FORGEJO_TOKEN" \
  -H "Content-Type: application/json" \
  "https://codeberg.org/api/v1/repos/<owner>/<repo>/pulls/<index>" \
  -d '{"title":"<title>","body":"<body>"}'
```

To send it back to draft after a regression, set the title back to `WIP: <title>`.
