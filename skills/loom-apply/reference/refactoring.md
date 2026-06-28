# Refactor candidates

Run only with the bar green (never refactor while red). After a TDD cycle, look for:

- **Duplication** → extract a function/module.
- **Long methods** → break into private helpers (keep tests on the public interface).
- **Shallow modules** → combine or deepen. A pass-through that fails the deletion test should be
  merged into its caller.
- **Feature envy** → move logic to where the data lives.
- **Primitive obsession** → introduce value objects (`Money`, `Email`) when a primitive carries
  invariants.
- **Existing code** the new code reveals as problematic.

## Deepening

The method for safely deepening a cluster of modules — dependency categories, seam discipline, and
"replace, don't layer" — lives in the **`loom-design`** skill's `DEEPENING.md`. The short version:

- When you deepen shallow **pass-through** modules into one deep module, delete their now-redundant
  unit tests; the deepened module's interface is the new test surface.
- Keep (and write) tests for **substantial internal modules** at their own seam — those aren't
  pass-throughs, they carry real invariants. Depth is recursive.
- A deep module may have **internal seams** used by its own tests; don't expose them through the
  external interface just because tests use them.

Don't gold-plate. Refactoring serves the next change, not abstraction for its own sake.
