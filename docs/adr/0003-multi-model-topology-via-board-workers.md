# Multi-Model Changes Run as Board-Coordinated Workers

Loom's loop is **one pipeline of stages** — explore → propose → build → review → land — run under one
of two **topologies**. **Review is a standing model stage in both topologies**: `loom-review` is not
mechanical verification alone but an adversarial, guilty-until-proven code review, so it earns its
place before the human even when one model does everything. **Land** is a separate, always-human gate:
verify + archive + PR + the human's merge (acceptance). The two were once conflated ("the human
reviews"); they are distinct — a model reviews, the human accepts.

The **single-model** topology (the default) runs every stage with one model plus the human, handing
off sequentially. Its one non-negotiable is that **review runs in a fresh context** — a separate
`/loom-review` invocation or a spawned reviewer sub-agent — so the model does not bless its own work in
the context that wrote it. Same model, genuine independence. The **multi-model** topology distributes
the roles across distinct models — a planner (explore/propose), an implementor (build), and a reviewer
(review) — coordinated **asynchronously through the forge board**, with the human's merge as the final
gate. The review cognition is identical across topologies; only *what triggers it* differs (a human
step / a sub-agent / a foreign worker).

In the multi-model topology, each non-human role is a **worker**: a single-model agent that processes
exactly one change per invocation and then exits. The autonomy comes from the harness's own scheduler
(cron, a loop skill, a background agent) re-firing the worker with a **fresh context** — so switching
between changes always crosses a clean context boundary, and Loom itself ships **no runtime**. Loom
defines worker *behavior*; the harness supplies the *scheduling*.

Workers coordinate through the board — the forge's issues, PRs, and four labels:
`loom:ready` (issue → implementor), `loom:review` (PR → reviewer), `loom:rework` (PR → implementor),
`loom:done` (PR → human merges). `loom-propose` publishes a change issue; `loom-implement` claims a
`ready` issue, builds on the branch, pushes, and opens a PR marked `review`; `loom-review` verifies
independently, code-reviews, and either archives + marks `done` or bounces to `rework`.

The keystone is the **trust boundary**: *the model that built a change never verifies, archives, or
blesses it.* The implementor only **presents** work (opens the PR); the reviewer holds the entire
verify + archive + finalize gate and re-runs verification rather than accepting the implementor's green
suite. This is what makes a foreign or cheaper implementor safe to trust, and it is why review must
never happen in the same context that built the change — a different *model* in multi-model, and at
minimum a fresh, independent *context* of the same model in single-model.

The reviewer works from a **guilty-until-proven** stance: it assumes the implementation is wrong — on
behavior, style, and hygiene — until the change proves otherwise. It judges test *strength* ("would
this test fail if the behavior broke?") not mere presence, and it grounds its judgment in the **target
project's own quality skills** (linters, style guides, framework conventions installed in that repo)
rather than the model's priors.

To avoid a legacy sibling, the two topologies are built from **shared cognition cores, not parallel
flows**: a build core (`loom-apply`'s TDD loop) is reused by single-model apply and multi-model
implement; a land core (`loom-submit`'s verify + archive + finalize) is invoked both standalone (the
land stage) and by `loom-review` on a pass, which adds the adversarial code-read and the rework bounce
on top. Change a core once and both topologies update. The single-model topology is therefore not compatibility scaffolding — it is
the *collapsed case* of the same pipeline.

## Consequences

Single-model stays ceremony-free: no board, no polling, no roles — its wrapper is thin, not frozen.
The default path is unchanged. Multi-model is opt-in **per change, not per project**: there is no mode
flag. `loom-propose` always writes the brief locally; *publishing* a change to the board (push branch +
open the `loom:ready` issue) is an explicit per-change action, and running a worker skill is what makes
a stage multi-model. Publishing needs no new config — it reuses the existing `## Forge` section of
`docs/loom/project.md`. So the same repo can run some changes solo and hand others to the board.

Concurrency is deliberately out of scope for now: the design assumes at most one worker per role
looping at a time, so a forge issue board (which has no atomic claim) is a safe-enough queue. Adding a
second implementor would reintroduce a claim race that this design does not solve.

The multi-model topology breaks the old forge-ownership boundary (ADR 0002: apply never touches
remotes; submit owns all forge actions). That invariant is now recognized as a *single-model-topology*
property: propose publishes, implement pushes and opens the PR, and review finalizes — forge writes are
distributed across the workers by the trust boundary rather than concentrated in one skill.

Rejected alternatives: **Loom ships an orchestrator** that shells out to model CLIs or APIs (makes
Loom a runtime, adds credential/process surface, and removes the human checkpoints multi-model most
needs); **a purely human-driven baton** with no board (loses the autonomous pickup the user wants);
**two parallel flows** kept side by side (duplication and drift — the "stale sibling" smell); and **one
fully-parametrized pipeline engine** with single-model as `topology=solo` (taxes the simple 90% path
with an abstraction built for the 10% path, and destabilizes a working default).
