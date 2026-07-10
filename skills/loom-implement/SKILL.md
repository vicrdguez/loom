---
name: loom-implement
description: The implementor worker in Loom's multi-model topology — claim a loom:ready issue (or a loom:rework PR) off the forge board, set up the branch, build the change test-first by composing loom-apply, push, and open (or update) a PR labeled loom:review, closing the issue on first PR open. It only presents work; it never verifies, archives, or blesses. Use when running Loom's build stage as a board worker, or when the user says implement/claim/pick up a ready change from the board.
---

# loom-implement

The **implementor worker** in the multi-model topology. It fills the *build* role by
processing exactly one change per invocation off the **forge board**, then exiting — the harness's
own scheduler re-fires it with a fresh context for the next change. Loom ships no runtime; this skill
defines only the worker's behavior.

Its build core **is `loom-apply`** — this skill does not reimplement the TDD loop, it composes it,
exactly as `loom-explore` composes `loom-domain`/`loom-design`. What `loom-implement` adds around the
build is the board handshake: claim, branch, push, present.

**The trust boundary (non-negotiable):** the implementor **only presents work**. It never runs the
verification gate, never archives, and never applies `loom:done`. Blessing a change is `loom-review`'s
job, in a different context — that separation is what makes a foreign or cheaper implementor safe to
trust. If you catch yourself wanting to "just verify it's green and mark it done," stop: that is the
reviewer's role.

## Board operations

Every forge command — claiming, labels, opening the PR, closing the issue — comes from the per-forge
board reference, keyed off `docs/loom/project.md`'s `## Forge` host (token via env var, never from
`project.md`):

- GitHub → [reference/github.md](./reference/github.md)
- Codeberg / Forgejo / Gitea → [reference/codeberg.md](./reference/codeberg.md)
- GitLab → [reference/gitlab.md](./reference/gitlab.md)

## Claim exactly one unit of work

Two kinds of board object are claimable. Prefer a `loom:rework` bounce (finish what's in flight)
before starting a fresh `loom:ready` issue.

- **A `loom:ready` issue** — a newly published change to build from scratch. Its title is the
  `<slug>`. Claim the oldest open one; fetch and check out its change branch. The brief lives on that
  branch under `docs/loom/changes/<slug>/`.
- **A `loom:rework` PR** — a change you (or another implementor) already built, bounced back by the
  reviewer with feedback as PR comments. Check out its head branch and read the comments first.

Process **one** change, then exit. Do not loop over the board yourself — re-firing with a fresh
context is the scheduler's job, and it is what keeps each change on a clean context boundary.

## Set up the branch

`loom-implement` runs in the change's worktree, like the rest of apply/submit. If the worktree is
absent (a foreign worker, fresh clone), create it from the pushed branch:
`git worktree add .loom-worktrees/<slug> <slug>` after fetching. Then work inside it.

## Build test-first — compose loom-apply

Hand the build to **`loom-apply`**: read the brief, then run its TDD loop — one Gherkin scenario at a
time, red → green → refactor, a commit per slice, internal modules tested at their own seams. Update
the capability doc in place and write `acceptance.md`, exactly as `loom-apply` prescribes. Nothing
about the build changes because a board sits around it; the single-model build core is reused whole.

`loom-apply` stops short of verifying, archiving, pushing, or opening a PR — which is precisely the
line the implementor must also not cross. Let it finish through `acceptance.md`, then take over for
the presentation.

## Present the work — open (or update) the review PR

Once the build is committed on the branch:

1. **Push** the change branch to the forge.
2. **Open a PR labeled `loom:review`** — the PR body is `acceptance.md` (the human-checkable residue),
   the same body `loom-submit` would use. Use loom-submit's per-forge reference for the raw PR-create
   command; add the `loom:review` label from the board reference.
3. **Close the change issue on first PR open**, so exactly one board object stays active per change
   (the open PR). Reference the PR from the close comment.

You are **presenting**, not blessing: open the PR as a normal (ready) PR for the reviewer to judge —
do not run verify, do not archive, do not mark it `loom:done`.

## Pick up a rework bounce

When you claimed a `loom:rework` PR instead of a fresh issue:

1. Read the reviewer's findings from the PR comments.
2. Rework the change **on the same branch** by composing `loom-apply` again (its rework path works the
   change wherever it currently lives — including an already-archived dir — and never moves it back).
3. Push **additional commits to the same PR** — never open a second PR for the same change.
4. **Flip the label `loom:rework` → `loom:review`** to hand it back to the reviewer.

## What this skill never does

- It never runs the verification gate (that is `loom-review`, re-run independently).
- It never archives the change.
- It never applies `loom:done`.
- It never touches `main`.

## Hand-off

Report the PR URL and that it is labeled `loom:review`, awaiting a reviewer. In the multi-model
topology the reviewer worker picks it up on its next firing; in a single-model run, the human (or the
scheduler) triggers `/loom-review` in a fresh context.
