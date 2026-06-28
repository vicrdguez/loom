---
name: loom-design
description: Shared vocabulary and principles for designing deep modules — small interface, deep implementation, placed at a clean seam, testable through that interface (recursively, for internal modules too). Use standalone to review or improve a module's interface and find deepening opportunities, or when loom-explore (design) or loom-apply (refactor) needs the deep-module vocabulary. Decide where seams go and whether each module earns its keep.
---

# loom-design

Design **deep modules**: a lot of behaviour behind a small interface, placed at a clean seam,
testable through that interface. Use this language and these principles wherever code is being
designed or restructured. The aim is leverage for callers, locality for maintainers, and
testability for everyone.

Run it **standalone** to review an existing module ("is this deep or a pass-through? where's the
seam?") — useful for grounding a brownfield codebase. `loom-explore` uses it to decide module shapes
while grilling; `loom-apply` uses it during the refactor phase (see
[DEEPENING.md](./reference/DEEPENING.md)).

## Glossary

Use these terms exactly — don't substitute "component," "service," "API," or "boundary." Consistent
language is the whole point.

- **Module** — anything with an interface and an implementation. **Deliberately scale-agnostic: a
  function, class, package, or tier-spanning slice.** _Avoid_: unit, component, service.
- **Interface** — everything a caller must know to use the module correctly: the type signature, but
  also invariants, ordering constraints, error modes, required configuration, and performance
  characteristics. _Avoid_: API, signature (too narrow).
- **Implementation** — what's inside a module, its body of code.
- **Depth** — leverage at the interface: behaviour a caller (or test) can exercise per unit of
  interface they must learn. **Deep** = much behaviour behind a small interface; **shallow** = the
  interface is nearly as complex as the implementation.
- **Seam** _(Feathers)_ — a place where you can alter behaviour without editing in that place; the
  location at which a module's interface lives. _Avoid_: boundary (overloaded with DDD).
- **Adapter** — a concrete thing that satisfies an interface at a seam (a Postgres repo, an
  in-memory fake). Describes *role*, not substance.
- **Leverage** — what callers get from depth: more capability per unit of interface learned.
- **Locality** — what maintainers get from depth: change, bugs, knowledge, and verification
  concentrate in one place. Fix once, fixed everywhere.

## Deep vs shallow

**Deep** = small interface + lots of implementation. **Shallow** = large interface + thin
implementation (avoid). When designing an interface, ask: can I reduce the number of methods? Can I
simplify the parameters? Can I hide more complexity inside?

## Principles

- **Depth is a property of the interface, not the implementation.** A deep module can be internally
  composed of small, mockable, swappable parts — they just aren't part of the interface. A module
  can have **internal seams** (private to its implementation, used by its own tests) as well as the
  **external seam** at its interface.
- **The deletion test.** Imagine deleting the module. If complexity vanishes, it was a pass-through.
  If complexity reappears across N callers, it was earning its keep.
- **The interface is the test surface.** Callers and tests cross the same seam. If you want to test
  *past* the interface, the module is probably the wrong shape.
- **One adapter means a hypothetical seam. Two adapters means a real one.** Don't introduce a seam
  unless something actually varies across it.

### Depth is recursive — internal correctness is not optional

Because **module** is scale-agnostic, "the interface is the test surface" applies **at every level**,
not only the topmost public API. A deep module (say, a backtesting engine behind
`run_backtest(strategy, data)`) is *internally composed of its own deep modules* — a fill simulator,
a slippage model, a portfolio accountant — each with its own interface, its own invariants, and **its
own tests at its own seam**. Internal implementation correctness is frequently the whole point; it is
*critical*, and it is tested.

"Test through the interface, not internals" does **not** mean "don't test internals." It means: test
each module through **its own** interface, and don't couple tests to *incidental* private structure
(a pass-through wrapper, a private helper that's pure plumbing). Substantial internals are modules —
give them interfaces and test them there. The judgment call is "is this internal thing a real module
with invariants, or incidental plumbing?" — test the former, don't pin the latter.

## Designing for testability

1. **Accept dependencies, don't create them.** `processOrder(order, paymentGateway)` is testable;
   `new StripeGateway()` inside is not.
2. **Return results, don't produce side effects.** `calculateDiscount(cart): Discount` over
   `applyDiscount(cart): void`.
3. **Small surface area.** Fewer methods = fewer tests; fewer params = simpler setup.

## Rejected framings

- **Depth as ratio of implementation-lines to interface-lines** (Ousterhout) — rewards padding the
  implementation. Use depth-as-leverage instead.
- **"Interface" as just the TS `interface` keyword / public methods** — too narrow; interface
  includes every fact a caller must know.
- **"Boundary"** — overloaded with DDD's bounded context. Say **seam** or **interface**.

## Going deeper

- **Deepening a cluster given its dependencies** — [DEEPENING.md](./reference/DEEPENING.md):
  dependency categories, seam discipline, replace-don't-layer testing. This taxonomy also drives the
  mocking decision in `loom-apply`.
- **Exploring alternative interfaces** — [DESIGN-IT-TWICE.md](./reference/DESIGN-IT-TWICE.md): spawn
  parallel sub-agents to design the interface several radically different ways, then compare on
  depth, locality, and seam placement.
