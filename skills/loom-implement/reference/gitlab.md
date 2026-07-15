# Board: GitLab

The **board** is issues, MRs, and five labels used to coordinate workers asynchronously. All three
workers link here. GitLab calls them **merge requests (MRs)**; everywhere Loom says "PR," read "MR."
MR create / update / draft state live in [loom-submit's gitlab reference](../../loom-submit/reference/gitlab.md);
this file adds the board layer.

CLI: [`glab`](https://gitlab.com/gitlab-org/cli). Token: the env var named in `project.md`'s
`## Forge` section (commonly `GITLAB_TOKEN`) — `glab` reads it automatically. **Never read a token
from `project.md`.**

## The five labels

`loom:ready` (issue → implementor) · `loom:wip` (additive implementor claim) · `loom:review` (MR → reviewer) · `loom:rework` (MR →
implementor) · `loom:done` (MR → human merges). One active board object per change (issue XOR MR);
the implementor closes the issue when it opens the MR.

## Ensure the five labels exist (idempotent)

`glab label create` errors if the label exists, so ignore that error to stay idempotent:

```sh
for name in loom:ready loom:wip loom:review loom:rework loom:done; do
  glab label create --name "$name" --color "#0e8a16" 2>/dev/null || true
done
```

## Publish — open a `loom:ready` issue (loom-propose)

Push the branch first (`git push -u origin <slug>`), then a thin pointer issue:

```sh
glab issue create --title "<slug>" --label "loom:ready" \
  --description "Change on branch \`<slug>\`. Brief: docs/loom/changes/<slug>/. Run /loom-implement."
```

## Claim work

```sh
glab issue list --label "loom:ready" --not-label "loom:wip" \
  --order created_at --sort asc --per-page 1 --output json
glab mr    list --label "loom:review" --not-label "loom:wip" \
  --order created_at --sort asc --per-page 1 --output json # reviewer
glab mr    list --label "loom:rework" --not-label "loom:wip" \
  --order created_at --sort asc --per-page 1 --output json
```

The forge excludes `loom:wip` before applying the one-item limit, so claimed older work cannot hide
a later eligible item.

## Claim and requeue implementor work

Add `loom:wip` without removing the lifecycle label. Do not fetch or touch the Change unless the
command succeeds:

```sh
glab issue update <issue-iid> --label "loom:wip"
glab mr update <mr-iid> --label "loom:wip"
```

Failed or interrupted work stays claimed. A human requeues it by removing only `loom:wip`:

```sh
glab issue update <issue-iid> --unlabel "loom:wip"
glab mr update <mr-iid> --unlabel "loom:wip"
```

## Open the review MR and close the issue (loom-implement)

Create the MR (loom-submit's gitlab reference), labeling it, then close the issue:

```sh
glab mr create --source-branch "<slug>" --target-branch main \
  --title "<title>" --description "$(cat body.md)" --label "loom:review"
glab issue close <issue-iid>
glab issue update <issue-iid> --unlabel "loom:wip"
```

## Swap labels (rework + wip → review; review → rework/done)

```sh
# reviewer bounces:  review → rework
glab mr update <iid> --unlabel "loom:review" --label "loom:rework"
# implementor re-presents:  rework + wip → review
glab mr update <iid> --unlabel "loom:rework,loom:wip" --label "loom:review"
# reviewer passes:  review → done
glab mr update <iid> --unlabel "loom:review" --label "loom:done"
```

## Feedback as MR comments (loom-review)

The reviewer edits no code; findings are notes on the MR.

```sh
glab mr note <iid> --message "$(cat findings.md)"
```

The implementor reads the bounce with `glab mr view <iid> --comments`.
