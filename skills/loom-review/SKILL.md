---
name: loom-review
description: The reviewer stage in Loom — claim a loom:review PR, re-run the mechanical verify independently (never trusting the implementor's green suite), then run a guilty-until-proven code review grounded in test strength and the target project's own quality skills. Pass → land (archive in branch + finalize) and label loom:done; fail → label loom:rework with findings as PR comments, editing no code. A standing model stage in both topologies; single-model runs it in a fresh context. Use when the user says review, or when running Loom's review stage before the human acceptance gate.
---

# loom-review

The **review stage** — a *standing model stage in both topologies*. Review is not
mechanical verification alone: it is an adversarial, guilty-until-proven code review that earns its
place before the human even when one model did everything. It sits between build and the human's
merge: a **model** reviews; the **human** accepts.

Its land core **is `loom-submit`** — this skill does not reimplement verify + archive + finalize, it
composes it, adding the adversarial code-read on top and the rework bounce when the change isn't ready.
Change the land core once and both the standalone land stage and this reviewer update.

**The trust boundary (non-negotiable):** review **never runs in the context that built the change**.
In the multi-model topology that is automatic — a different *model* reviews. In the single-model
topology it must be enforced: run `loom-review` in a **fresh context** — a separate `/loom-review`
invocation or a spawned reviewer sub-agent — so the model never blesses work in the same context that
wrote it. And the reviewer **edits no code**: on a pass it lands; on a fail it comments and bounces.

## Board operations

Label swaps and PR comments come from the per-forge board reference, keyed off `docs/loom/project.md`'s
`## Forge` host (token via env var, never from `project.md`):

- GitHub → [../loom-implement/reference/github.md](../loom-implement/reference/github.md)
- Codeberg / Forgejo / Gitea → [../loom-implement/reference/codeberg.md](../loom-implement/reference/codeberg.md)
- GitLab → [../loom-implement/reference/gitlab.md](../loom-implement/reference/gitlab.md)

## Claim exactly one review

Claim the oldest open `loom:review` PR without `loom:wip`; the Board reference filters Claims before
age ordering and one-item selection. After selecting one eligible PR, add `loom:wip` **without removing** `loom:review`.
The Claim exists only after that forge operation succeeds. If it fails or its outcome is ambiguous,
report the forge failure and exit without fetching, checking out, or inspecting the Change.
Only then check out its branch in the change worktree and read the brief (`docs/loom/changes/<slug>/`).
If a claimed review fails or is interrupted, leave `loom:wip` in place; workers never auto-expire or silently release a Claim.
A human explicitly requeues it by removing only `loom:wip` through the Board reference. Process **one** PR,
then exit — re-firing with a fresh context is the scheduler's job.

## Verify independently — never on trust

**Re-run the mechanical verification yourself.** Do not accept the implementor's green suite as
sufficient — a foreign or cheaper implementor is exactly why this stage exists. Run the three
mechanical checks from `loom-submit`, using the project's own commands:

1. Every `intent.md` "Done" line is demonstrably met.
2. Every `behavior.md` scenario has a materialized test (or, for a prose change, is encoded).
3. The full suite is green — run it, from `docs/loom/project.md`'s commands, in your own checkout.

A green suite you did not run yourself does not count.

## Review guilty-until-proven — behavior, style, hygiene

Assume the implementation is **wrong until it proves otherwise**. A passing suite is necessary, not
sufficient — weak tests pass too.

- **Judge test *strength*, not presence.** For each materialized test, ask: *would this test fail if
  the behavior broke?* Mentally (or actually) break the behavior and check the test catches it. A test
  that asserts nothing meaningful — tautological, over-mocked so it exercises the mock, asserting a
  constant — is a **finding**, even though it is green.
- **Ground style and hygiene in the target project's own quality skills** — its linters, formatters,
  style guides, and framework-convention skills installed in *that* repo — **not the model's priors**.
  If the project ships a `code-review`/quality skill, run it; if it has lint/format commands in
  `project.md`, they are the standard, not your taste.
- Read the diff for the ordinary defects too: correctness, edge cases, missed scenarios, mocking the
  code under test, plan drift against `plan.md`.
- Apply the principles from `loom/design` and `loom/domain`

If the change is high-stakes or considered critical you can do an **Independent test re-implementation**, writing the
tests yourself from `behavior.md` and diffing intent. However,  is an **opt-in escalation**  that should be requested
by the user explicitly, not the default. The standing default is this adversarial test-strength read.

## Pass → land and mark done

When verification passes **and** the review finds no blocking issue, **land the change** by composing
`loom-submit`'s land core: archive the change **inside the branch**
(`docs/loom/changes/<slug>/` → `docs/loom/changes/archive/<YYYY-MM-DD>-<slug>/`), commit, and finalize
the PR body as the human acceptance checklist. Then **label the PR `loom:done`** (swap off
`loom:review`). Push the archive commit to the PR branch.

The change now awaits the **human's merge** — merging a `loom:done` PR *is* the acceptance, and it
lands the archive on `main`. The reviewer does not merge.

## Fail → bounce to rework, edit no code

When verification fails **or** the review surfaces a blocking issue:

1. **Leave findings as PR comments** — a summary verdict comment plus inline comments anchored to the
   offending lines. Be specific: which check failed and where, which test is weak and why it wouldn't
   catch a regression, which quality-skill rule tripped.
2. **Label the PR `loom:rework`** (swap off `loom:review`) to hand it back to the implementor.
3. **Modify no code.** Fixing is the implementor's job (`loom-implement` composing `loom-apply`);
   collapsing that boundary is exactly what this stage exists to prevent. Do not archive, do not mark
   `loom:done`.

## Single-model: run in a fresh context

Review is a standing stage even when one model did everything — but only if it runs **independently of
the build context**. Enforce it: a separate `/loom-review` invocation, or spawn a dedicated reviewer
sub-agent that reads the PR/branch fresh. Never review a change in the same context that wrote it.

## Hand-off

- **Pass:** report the PR URL labeled `loom:done`, awaiting the human's merge (the acceptance gate).
- **Fail:** report the PR URL labeled `loom:rework` with the findings summary. An implementor worker
  picks it up on its next firing, or run `/loom-implement` to rework it.
