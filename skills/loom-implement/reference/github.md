# Board: GitHub

The **board** is the forge's issues, PRs, and five labels used as the asynchronous coordination
medium between workers. This reference holds every board operation the workers share —
`loom-propose` (publish), `loom-implement` (claim / present), and `loom-review` (bless / bounce) all
link here so the commands live in one place.

CLI: [`gh`](https://cli.github.com/). Token: the env var named in `project.md`'s `## Forge` section
(for this repo: `GH_TOKEN`) — `gh` reads `GH_TOKEN` / `GITHUB_TOKEN` automatically. **Never read a
token from `project.md`.** Use the repo from `project.md` in every command (`<owner>/<repo>`).

PR create / update / draft state live in [loom-submit's github reference](../../loom-submit/reference/github.md);
this file adds only the board layer (labels, issues, PR labels, comments) on top.

## The five labels

| Label | Rides on | Means → next role |
|---|---|---|
| `loom:ready` | issue | proposed change awaiting an **implementor** |
| `loom:wip` | issue or PR | additive marker: an **implementor is working** |
| `loom:review` | PR | built change awaiting a **reviewer** |
| `loom:rework` | PR | reviewer bounced it back to the **implementor** |
| `loom:done` | PR | passed review, awaiting the **human's merge** |

Exactly one board object is active per change: an open `loom:ready` issue **or** a PR — never both.
The implementor closes the issue when it opens the PR.

## Ensure the five labels exist (idempotent)

Run before the first publish. `gh label create` fails if the label already exists, so guard with
`--force` (which upserts) or ignore the error:

```sh
for spec in \
  "loom:ready|Proposed change awaiting an implementor|0e8a16" \
  "loom:wip|An implementor is actively working this change|fbca04" \
  "loom:review|Built change awaiting a reviewer|1d76db" \
  "loom:rework|Reviewer bounced it back to the implementor|d93f0b" \
  "loom:done|Passed review, awaiting the human merge|5319e7"; do
  name=${spec%%|*}; rest=${spec#*|}; desc=${rest%%|*}; color=${rest##*|}
  gh label create "$name" --repo "<owner>/<repo>" --description "$desc" --color "$color" --force
done
```

`--force` makes this safe to re-run: it creates the label if missing and updates it otherwise.

## Publish — open a `loom:ready` issue (loom-propose)

The issue is a **thin pointer** to the brief on the pushed branch, not a copy of it. Push the branch
first (`git push -u origin <slug>`), then:

```sh
gh issue create --repo "<owner>/<repo>" \
  --title "<slug>" \
  --label "loom:ready" \
  --body "Change proposed on branch \`<slug>\`. Brief: docs/loom/changes/<slug>/ (intent.md · behavior.md · plan.md? · tasks.md?).

Run \`/loom-implement\` to claim and build it."
```

## Claim work

**A ready issue (loom-implement):** the oldest open `loom:ready` issue without `loom:wip` is next.

```sh
gh issue list --repo "<owner>/<repo>" --label "loom:ready" --state open \
  --search "-label:loom:wip sort:created-asc" --limit 1 \
  --json number,title --jq '.[0]'
```

The issue title is the `<slug>`; check out its branch (`git fetch origin <slug> && git checkout <slug>`).

**A review PR (loom-review):** the oldest open `loom:review` PR is next.

```sh
gh pr list --repo "<owner>/<repo>" --label "loom:review" --state open \
  --json number,headRefName,title --jq 'sort_by(.number) | .[0]'
```

**A rework PR (loom-implement):** the oldest `loom:rework` PR without `loom:wip` is a bounce to pick back up.

```sh
gh pr list --repo "<owner>/<repo>" --label "loom:rework" --state open \
  --search "-label:loom:wip sort:created-asc" --limit 1 \
  --json number,headRefName,title --jq '.[0]'
```

## Claim and requeue implementor work

Add `loom:wip` without removing the lifecycle label. Do not fetch or touch the Change unless the
command succeeds:

```sh
gh issue edit <issue-number> --repo "<owner>/<repo>" --add-label "loom:wip" # ready issue
gh pr edit <pr-number> --repo "<owner>/<repo>" --add-label "loom:wip"       # rework PR
```

Failed or interrupted work stays claimed. A human requeues it by removing only `loom:wip`:

```sh
gh issue edit <issue-number> --repo "<owner>/<repo>" --remove-label "loom:wip"
gh pr edit <pr-number> --repo "<owner>/<repo>" --remove-label "loom:wip"
```

## Open the review PR and close the issue (loom-implement)

Open the review PR, close the ready issue, and only then remove its Claim so exactly one board object
stays active:

```sh
gh pr create --repo "<owner>/<repo>" --label "loom:review" \
  --title "<title>" --body-file body.md --base main --head "<slug>"
gh issue close <issue-number> --repo "<owner>/<repo>" \
  --comment "Built and opened for review in #<pr-number>."
gh issue edit <issue-number> --repo "<owner>/<repo>" --remove-label "loom:wip"
```

## Swap labels (loom-implement rework + wip → review; loom-review pass/fail)

A PR carries exactly one lifecycle label at a time. Remove the old, add the new:

```sh
# reviewer bounces:  review → rework
gh pr edit <pr-number> --repo "<owner>/<repo>" --remove-label "loom:review" --add-label "loom:rework"
# implementor re-presents after rework:  rework + wip → review
gh pr edit <pr-number> --repo "<owner>/<repo>" \
  --remove-label "loom:rework,loom:wip" --add-label "loom:review"
# reviewer passes:  review → done
gh pr edit <pr-number> --repo "<owner>/<repo>" --remove-label "loom:review" --add-label "loom:done"
```

## Feedback as PR comments (loom-review)

The reviewer edits **no code**; findings go on the PR as comments. Inline comments anchor to a line;
a summary comment carries the verdict.

```sh
# summary verdict comment
gh pr comment <pr-number> --repo "<owner>/<repo>" --body-file findings.md
# inline, anchored to a file+line (review API)
gh api "repos/<owner>/<repo>/pulls/<pr-number>/comments" \
  -f body="<finding>" -f commit_id="<head-sha>" -f path="<file>" -F line=<n> -f side=RIGHT
```

The implementor reads the bounce feedback with:

```sh
gh pr view <pr-number> --repo "<owner>/<repo>" --comments
```
