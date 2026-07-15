---
name: loom-propose
description: Materialize an explored change into a Loom change brief under docs/loom/changes/<slug>/ — intent.md and behavior.md (Gherkin) always, plus plan.md and tasks.md when warranted. Use when the user is ready to write up a change after exploring, says propose, draft a change, spec it out, or plan the work, or has a small change clear enough to skip grilling.
---

# loom-propose

Transcribe a grilled understanding into the change files that drive implementation. The hard
thinking happened in `/loom-explore`; this stage is precise materialization. (For a trivial,
crystal-clear change you may run this without exploring first.)

## Pick a change id

A short, verb-led kebab slug: `add-order-cancellation`.

## Set up the change branch

Each change is built in isolation on its own branch, so several can run in parallel and each ships as
one PR. From the `main` checkout, before writing the brief:

1. **Commit durable-doc stragglers.** Any `CONTEXT.md` / ADR edits left in the working tree from
   `/loom-explore` are durable — commit them to `main` now, so they land independently of this change.
2. **GC merged worktrees.** Remove any `.loom-worktrees/<other>` whose change has already merged (its
   `docs/loom/changes/archive/<date>-<other>/` is present on `main`), then delete its branch. Running
   from `main`, you are never inside the worktree you remove.
3. **Ensure `.loom-worktrees/` is gitignored** — add the line if it's missing.
4. **Create the worktree:** `git worktree add .loom-worktrees/<slug> -b <slug>` off up-to-date
   `main`. Do the rest of propose — and all of apply and submit — **inside that worktree**.

Then create `docs/loom/changes/<slug>/` inside the worktree.

## Read first

`docs/loom/project.md`, the relevant `docs/capabilities/*`, `CONTEXT.md`, and any ADRs the change
depends on — so the brief uses canonical language and respects pinned decisions.

## Write the files (scale to the change size)

Always:
- **`intent.md`** — why / what / scope / out-of-scope / done. Tight, leaving the least room for
  interpretation. Template: [reference/intent.md](./reference/intent.md).
- **`behavior.md`** — the exact behavior as **Gherkin** (`Feature` / `Scenario` /
  `Given`·`When`·`Then`). Each scenario must be observable through a public interface and will become
  one test. Template: [reference/behavior.md](./reference/behavior.md).

When warranted:
- **`plan.md`** — *only when there are real decisions to pin*: the approach, the module shapes and
  seams chosen in explore (**public and critical internal modules, with their invariants**), and any
  decision — interface *or* internal algorithm — the implementer must NOT make on its own. Reference
  the ADRs. Template: [reference/plan.md](./reference/plan.md).
- **`tasks.md`** — *when there is more than a couple of scenarios or any non-behavioral chores*: a
  checklist with stable ids, one task per scenario plus chores (migrations, wiring) and the
  capability-doc update. It is the coordination ledger for multi-agent apply. Template:
  [reference/tasks.md](./reference/tasks.md).

A one-scenario fix is two short files. A large change is four.

## Use Gherkin as notation, not tooling

Write `Given/When/Then` to specify behavior precisely. Do **not** create `.feature` files or assume
a Cucumber runtime — `loom-apply` materializes each scenario into an idiomatic test in this
project's own framework.

## Validate (by reading, not tooling)

- Every scenario traces to a line in `intent.md`'s "Done".
- Scenarios describe behavior through a public interface, not internal state.
- `plan.md` pins exactly the decisions you don't want made at code time — no more, no less.

## Publish to the board (only when asked)

By default propose is **local**: it writes the brief on the change branch and stops. Nothing is
pushed and no issue is opened — the single-model flow is byte-for-byte unchanged, so `/loom-apply`
picks the change up from the worktree exactly as before.

**Publish only on an explicit request** ("publish it", "put it on the board", "hand it to an
implementor"). Publishing is what makes a change's build stage multi-model: it hands the change to an
implementor worker through the forge board. There is **no mode flag** — topology is per change and
emergent from whether you publish. Publishing reuses the existing `## Forge` section
of `docs/loom/project.md` — it needs **no new config** in the body or frontmatter.

When asked to publish, after the brief is committed on the branch:

1. **Ensure the five labels exist** on the forge (`loom:ready`, `loom:wip`, `loom:review`,
   `loom:rework`, `loom:done`) — idempotent, a no-op when they already exist.
2. **Push the change branch** to the forge.
3. **Open a `loom:ready` issue** whose body **points to the brief on the branch** (path under
   `docs/loom/changes/<slug>/`) rather than duplicating it — a thin pointer an implementor worker
   claims with `/loom-implement`.

Every forge command comes from the per-forge board reference, keyed off the `## Forge` host (token via
env var, never from `project.md`):

- GitHub → [loom-implement/reference/github.md](../loom-implement/reference/github.md)
- Codeberg / Forgejo / Gitea → [loom-implement/reference/codeberg.md](../loom-implement/reference/codeberg.md)
- GitLab → [loom-implement/reference/gitlab.md](../loom-implement/reference/gitlab.md)

(These install alongside `loom-propose` — the whole `loom-*` set installs together — so the shared
board commands live in one place.)

## Hand-off

- **Local (default):** "Review the brief, then run `/loom-apply`."
- **Published:** report the issue URL and its `loom:ready` label. An implementor worker claims it on
  its next firing, or run `/loom-implement` to build it.
