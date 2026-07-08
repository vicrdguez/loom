# Board: Codeberg / Forgejo / Gitea

The **board** is issues, PRs, and four labels used to coordinate workers asynchronously. All three
workers link here for the board operations. PR create / update / `WIP:` draft state live in
[loom-submit's codeberg reference](../../loom-submit/reference/codeberg.md); this file adds the board
layer.

CLI: [`tea`](https://gitea.com/gitea/tea). Token: the env var named in `project.md`'s `## Forge`
section (e.g. `FORGEJO_TOKEN`) — **never read a token from `project.md`**. `tea` is thin on labels
and issue edits, so several board operations use the Forgejo API with the token from the env var
(`$FORGEJO_TOKEN` below — substitute the var named in `project.md`). For a self-hosted instance,
`project.md`'s host is the instance URL; replace `codeberg.org` below.

## The four labels

`loom:ready` (issue → implementor) · `loom:review` (PR → reviewer) · `loom:rework` (PR →
implementor) · `loom:done` (PR → human merges). One active board object per change (issue XOR PR);
the implementor closes the issue when it opens the PR.

## Ensure the four labels exist (idempotent)

List first, create only the missing ones (Forgejo has no upsert):

```sh
existing=$(curl -fsSL -H "Authorization: token $FORGEJO_TOKEN" \
  "https://codeberg.org/api/v1/repos/<owner>/<repo>/labels" | grep -o '"name":"[^"]*"')
for name in loom:ready loom:review loom:rework loom:done; do
  printf '%s' "$existing" | grep -q "\"name\":\"$name\"" && continue
  curl -fsSL -X POST -H "Authorization: token $FORGEJO_TOKEN" -H "Content-Type: application/json" \
    "https://codeberg.org/api/v1/repos/<owner>/<repo>/labels" \
    -d "{\"name\":\"$name\",\"color\":\"#0e8a16\"}"
done
```

## Publish — open a `loom:ready` issue (loom-propose)

Push the branch first (`git push -u origin <slug>`), then open a thin pointer issue:

```sh
tea issue create --title "<slug>" --labels "loom:ready" \
  --description "Change on branch \`<slug>\`. Brief: docs/loom/changes/<slug>/. Run /loom-implement."
```

## Claim work

```sh
tea issue list --labels "loom:ready" --state open --fields index,title --output simple   # implementor
tea pr    list --labels "loom:review" --state open --fields index,title,head --output simple  # reviewer
tea pr    list --labels "loom:rework" --state open --fields index,title,head --output simple  # rework bounce
```

Lowest index is next. An issue title is its `<slug>`; check out the PR's head branch to rework.

## Open the review PR and close the issue (loom-implement)

Create the PR (loom-submit's codeberg reference), then label it and close the issue:

```sh
tea pr create --head "<slug>" --base main --title "<title>" --description "$(cat body.md)"
tea issue edit <index> --add-labels "loom:review"        # if the PR create didn't take labels
tea issue close <issue-index>
```

## Swap labels (rework ↔ review; review → done)

```sh
curl -fsSL -X PATCH -H "Authorization: token $FORGEJO_TOKEN" -H "Content-Type: application/json" \
  "https://codeberg.org/api/v1/repos/<owner>/<repo>/issues/<pr-index>/labels" \
  -d '{"labels":["loom:review"]}'   # replaces the PR's labels wholesale — set the single target label
```

Set `["loom:rework"]` to bounce, `["loom:done"]` to pass. (Forgejo PRs share the issue label
endpoint; the PR index is its issue index.)

## Feedback as PR comments (loom-review)

The reviewer edits no code; findings are comments.

```sh
curl -fsSL -X POST -H "Authorization: token $FORGEJO_TOKEN" -H "Content-Type: application/json" \
  "https://codeberg.org/api/v1/repos/<owner>/<repo>/issues/<pr-index>/comments" \
  -d "{\"body\":\"$(cat findings.md)\"}"
```

The implementor reads the bounce with `tea pr <index>` or the issue-comments API endpoint above (GET).
