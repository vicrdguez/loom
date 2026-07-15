# Board: Codeberg / Forgejo / Gitea

The **board** is issues, PRs, and five labels used to coordinate workers asynchronously. All three
workers link here for the board operations. PR create / update / `WIP:` draft state live in
[loom-submit's codeberg reference](../../loom-submit/reference/codeberg.md); this file adds the board
layer.

CLI: [`tea`](https://gitea.com/gitea/tea). Token: the env var named in `project.md`'s `## Forge`
section (e.g. `FORGEJO_TOKEN`) — **never read a token from `project.md`**. `tea` is thin on labels
and issue edits, so several board operations use the Forgejo API with the token from the env var
(`$FORGEJO_TOKEN` below — substitute the var named in `project.md`). For a self-hosted instance,
`project.md`'s host is the instance URL; replace `codeberg.org` below.

## The five labels

`loom:ready` (issue → implementor) · `loom:wip` (additive implementor claim) · `loom:review` (PR → reviewer) · `loom:rework` (PR →
implementor) · `loom:done` (PR → human merges). One active board object per change (issue XOR PR);
the implementor closes the issue when it opens the PR.

## Ensure the five labels exist (idempotent)

List first, create only the missing ones (Forgejo has no upsert):

```sh
existing=$(curl -fsSL -H "Authorization: token $FORGEJO_TOKEN" \
  "https://codeberg.org/api/v1/repos/<owner>/<repo>/labels" | grep -o '"name":"[^"]*"')
for name in loom:ready loom:wip loom:review loom:rework loom:done; do
  printf '%s' "$existing" | grep -q "\"name\":\"$name\"" && continue
  color="0e8a16"; [ "$name" = "loom:wip" ] && color="fbca04"
  curl -fsSL -X POST -H "Authorization: token $FORGEJO_TOKEN" -H "Content-Type: application/json" \
    "https://codeberg.org/api/v1/repos/<owner>/<repo>/labels" \
    -d "{\"name\":\"$name\",\"color\":\"$color\"}"
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
tea issue list --labels "loom:ready" --state open --fields index,title,labels --output simple
tea pr    list --labels "loom:review" --state open --fields index,title,head --output simple  # reviewer
tea pr    list --labels "loom:rework" --state open --fields index,title,head,labels --output simple
```

For reviewer and implementor lists, first discard every row whose labels contain `loom:wip`, then choose the
lowest remaining index. Filtering must happen before selection so a claimed older object cannot hide
a later eligible item. An issue title is its `<slug>`; check out the PR's head branch to rework.

## Claim and requeue implementor work

Forgejo mutations require numeric repository label IDs. Resolve names from the label list once:

```sh
labels=$(curl -fsSL -H "Authorization: token $FORGEJO_TOKEN" \
  "https://codeberg.org/api/v1/repos/<owner>/<repo>/labels")
resolve_label_id() {
  printf '%s' "$labels" | jq -er --arg name "$1" '.[] | select(.name == $name) | .id'
}
wip_id=$(resolve_label_id loom:wip)
review_id=$(resolve_label_id loom:review)
```

Add `loom:wip` without removing the lifecycle label. Do not fetch or touch the Change unless this
succeeds:

```sh
curl -fsSL -X POST -H "Authorization: token $FORGEJO_TOKEN" -H "Content-Type: application/json" \
  "https://codeberg.org/api/v1/repos/<owner>/<repo>/issues/<issue-or-pr-index>/labels" \
  -d "{\"labels\":[$wip_id]}"
```

Failed or interrupted work stays claimed. A human requeues it by removing only `loom:wip`:

```sh
curl -fsSL -X DELETE -H "Authorization: token $FORGEJO_TOKEN" \
  "https://codeberg.org/api/v1/repos/<owner>/<repo>/issues/<issue-or-pr-index>/labels/$wip_id"
```

## Open the review PR and close the issue (loom-implement)

Create the PR (loom-submit's codeberg reference), then label it and close the issue:

```sh
tea pr create --head "<slug>" --base main --title "<title>" --description "$(cat body.md)"
tea issue edit <index> --add-labels "loom:review"        # if the PR create didn't take labels
tea issue close <issue-index>
curl -fsSL -X DELETE -H "Authorization: token $FORGEJO_TOKEN" \
  "https://codeberg.org/api/v1/repos/<owner>/<repo>/issues/<issue-index>/labels/$wip_id"
```

## Swap labels (rework + wip → review; review → rework/done)

Replace the PR labels with the numeric target label ID. For implementor re-presentation this removes
`loom:rework + loom:wip` and adds `loom:review` in one operation:

```sh
curl -fsSL -X PUT -H "Authorization: token $FORGEJO_TOKEN" -H "Content-Type: application/json" \
  "https://codeberg.org/api/v1/repos/<owner>/<repo>/issues/<pr-index>/labels" \
  -d "{\"labels\":[$review_id]}"
```

Resolve and send the numeric `loom:rework` or `loom:done` ID for reviewer transitions. Forgejo PRs
share the issue label endpoint; the PR index is its issue index.

## Feedback as PR comments (loom-review)

The reviewer edits no code; findings are comments.

```sh
curl -fsSL -X POST -H "Authorization: token $FORGEJO_TOKEN" -H "Content-Type: application/json" \
  "https://codeberg.org/api/v1/repos/<owner>/<repo>/issues/<pr-index>/comments" \
  -d "{\"body\":\"$(cat findings.md)\"}"
```

The implementor reads the bounce with `tea pr <index>` or the issue-comments API endpoint above (GET).
