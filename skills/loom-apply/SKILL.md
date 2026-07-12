---
name: loom-apply
description: Implement a Loom change test-first — materialize each Gherkin scenario into an idiomatic test, drive it red-green-refactor (testing internal modules at their own seams too), commit per slice, update the capability doc in place, and record acceptance steps for /loom-submit to ship. Use when the user says apply, implement, build, or start coding an explored/proposed Loom change.
---

# loom-apply

The execution stage. The decisions were pinned in `plan.md`, so this stage makes no important new
ones — it materializes behavior into tests and code. It's the part you can hand to a cheaper model.

## Read the change

`docs/loom/changes/<slug>/`: `intent.md`, `behavior.md`, `plan.md` (if present), `tasks.md` (if
present). Treat each Gherkin `Scenario` as one test to write. Use the test/build/lint commands from
`docs/loom/project.md`.

Apply runs **inside the change's worktree** (`.loom-worktrees/<slug>/`). Work the change wherever it
currently lives — `docs/loom/changes/<slug>/`, or `docs/loom/changes/archive/<date>-<slug>/` if a
prior submit already archived it (rework); **never move it back**. Apply only ever writes to the
change branch: **never touch `main`, the archive layout, or git remotes** — that is `/loom-submit`.

## The TDD loop — vertical slices, one behavior at a time

See [tdd.md](./reference/tdd.md). Never write all tests first then all code (horizontal slicing) —
that tests imagined behavior. One test → one implementation → repeat.

1. **Red** — write ONE idiomatic test that encodes the behavior, exercised through the relevant
   module's interface ([tests.md](./reference/tests.md)). Watch it fail for the right reason.
2. **Green** — the minimal code to pass. Nothing speculative.
3. **Refactor** — only once green: remove duplication and deepen modules
   ([refactoring.md](./reference/refactoring.md); deepening method lives in the `loom-design` skill's
   DEEPENING reference). Tests stay green.
4. **Commit** — one logical commit for the slice, with a tight message. Per-slice commits are cheap
   and reworkable (they live on the change branch, not `main`) and they make the eventual PR readable.

Check the task off as each behavior lands.

## Test at every level, not just the public API

The top-level Gherkin scenarios capture the change's **externally observable** contract. But depth is
recursive: a change usually decomposes into modules, and **critical internal modules are tested at
their own interfaces** — not every test maps to a top-level scenario. For a complex engine, the
slippage model / accountant / matcher each get their own tests at their own seam. Use `loom-design`
to decide what's a real internal module (test it) vs incidental plumbing (don't pin it).

## Mocking discipline

Inject dependencies; mock only at real external seams. The dependency category chosen in
`plan.md`/explore IS the mocking decision — see [mocking.md](./reference/mocking.md). Never mock the
code under test or internal collaborators.

## Materialize Gherkin → idiomatic tests

`Given` → arrange · `When` → act · `Then`/`And` → assert. Name the test after the scenario so
traceability survives without any tooling. No `.feature` files.

## Implementation discipline
You are a lazy senior developer. Lazy means efficient, not careless. The best code is the code never written. Before writing any code, stop at the first rung that holds:

1. Does this need to be built at all? (YAGNI)
2. Does it already exist in this codebase? Reuse the helper, util, or pattern that's already here, don't re-write it.
3. Does the standard library already do this? Use it.
4. Does a native platform feature cover it? Use it.
5. Does an already-installed dependency solve it? Use it.
7. Can it be expressed directly without a new abstraction?
8. Can this be one line? Make it one line.
9. Only then: write the minimum code that works.

The ladder runs after you understand the problem, not instead of it: read the task and the code it touches,
trace the real flow end to end, then climb.

Prefer deletion over addition and boring over clever. Add no speculative abstractions, dependencies,
boilerplate, or configuration. Never trade away understanding, scenario tests, validation, security,
accessibility, data-loss protection, required error handling, or explicitly pinned module seams.


## Finish the change

1. Full suite green; every `intent.md` "Done" line demonstrably met.
2. **Update `docs/capabilities/<name>.md` in place** — a high-altitude, readable summary of the new
   behavior, linking the tests that enforce it ([capability-doc.md](./reference/capability-doc.md)).
   Direct editing, not a merge. Commit it.
3. **Write `acceptance.md`** in the change dir — the human-checkable residue tests can't cover
   (visual, UX, "does it render"), learned during implementation. If nothing needs human eyes, say so
   explicitly. Do **not** edit `intent.md` — it is frozen after propose
   ([acceptance.md](./reference/acceptance.md)). Commit it.
4. Confirm every slice is committed on the change branch. Do **not** archive, push, or open a PR — and
   never touch `main`. That is `/loom-submit`.
5. Report what shipped and which capability docs changed. Suggest `/loom-submit`.
