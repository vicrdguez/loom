# TDD — red-green-refactor in vertical slices

## Philosophy

Tests verify **behaviour through interfaces**, not implementation details. Code can change entirely;
tests shouldn't. Good tests are integration-style: they exercise real code paths through a module's
public interface and read like a specification ("user can checkout with valid cart"). They survive
refactors because they don't care about internal structure.

Bad tests are coupled to implementation — they mock internal collaborators, test private methods, or
verify through external means (querying the DB directly instead of using the interface). Warning
sign: the test breaks when you refactor but behaviour hasn't changed.

## Anti-pattern: horizontal slices

**Do NOT write all tests first, then all implementation.** Tests written in bulk test *imagined*
behaviour — the shape of data structures and signatures — not actual behaviour. They pass when
behaviour breaks and fail when it's fine.

```
WRONG (horizontal):  RED: test1..test5   then  GREEN: impl1..impl5
RIGHT (vertical):    test1→impl1, test2→impl2, test3→impl3, ...
```

Each test responds to what you learned from the previous cycle.

## Workflow

### 1. Plan
- Confirm the interface(s) from `plan.md` (it was decided in explore).
- Pick the behaviours that matter most — you can't test everything; focus on critical paths and
  complex logic.
- Identify deep-module opportunities up front (use the `loom-design` skill) so you test the right
  surface — including which **internal** modules deserve their own tests.
- Order the scenarios so each builds on the last (`tasks.md` order is usually right).

### 2. Tracer bullet
Write ONE test that confirms ONE thing end-to-end. Red → minimal code → Green. Proves the path works.

### 3. Incremental loop
For each remaining behaviour: Red (next test fails) → Green (minimal code) → repeat. One test at a
time; only enough code to pass it; don't anticipate future tests.

### 4. Refactor (never while red)
With the bar green, look for [refactor candidates](./refactoring.md): duplication, shallow modules to
deepen, feature envy, primitive obsession. Run tests after each step.

## Levels

"Through the interface" is **recursive**. The top-level scenarios test the public contract; critical
internal modules are tested at *their* interfaces too. Not every test traces to a top-level Gherkin
scenario — internal correctness is first-class. (See the recursion note in the `loom-design` skill.)

## Per-cycle checklist

- [ ] Test describes **behaviour**, not implementation
- [ ] Test uses a **public interface** (the relevant module's) only
- [ ] Test would **survive an internal refactor** that preserves behaviour
- [ ] Code is **minimal** for this test
- [ ] **No speculative** features added
