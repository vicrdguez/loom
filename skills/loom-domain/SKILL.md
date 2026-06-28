---
name: loom-domain
description: Actively build and sharpen a project's domain model — challenge terms, invent edge-case scenarios, and write the CONTEXT.md glossary and ADRs the moment decisions crystallise. Use standalone to ground a brownfield project's language before adopting Loom, or when loom-explore needs to model the domain. Not for merely reading CONTEXT.md — that's a one-line habit; this is for when you're changing the model.
---

# loom-domain

Actively build and sharpen the project's domain model as you design. This is the *active*
discipline — challenging terms, inventing edge-case scenarios, and writing the glossary and
decisions down the moment they crystallise. Merely *reading* `CONTEXT.md` for vocabulary is not this
skill; that's a habit any skill can do. This skill is for when you're **changing** the model.

Run it **standalone** to ground a brownfield codebase (sweep the code and conversations to seed
`CONTEXT.md` and capture the decisions already baked in), or let **`loom-explore`** invoke it while
grilling a change.

## File structure

Most repos have a single context:

```
/
├── CONTEXT.md
├── docs/
│   └── adr/
│       ├── 0001-event-sourced-orders.md
│       └── 0002-postgres-for-write-model.md
└── src/
```

If a `CONTEXT-MAP.md` exists at the root, the repo has multiple contexts; the map points to where
each one lives (per-context `CONTEXT.md` and `docs/adr/`). Single context is the default.

Create files lazily — only when you have something to write. If no `CONTEXT.md` exists, create one
when the first term is resolved. If no `docs/adr/` exists, create it when the first ADR is needed.

## During the session

### Challenge against the glossary
When the user uses a term that conflicts with the existing language in `CONTEXT.md`, call it out
immediately. "Your glossary defines 'cancellation' as X, but you seem to mean Y — which is it?"

### Sharpen fuzzy language
When the user uses vague or overloaded terms, propose a precise canonical term. "You're saying
'account' — do you mean the Customer or the User? Those are different things."

### Discuss concrete scenarios
Stress-test domain relationships with specific scenarios that probe edge cases and force precision
about the boundaries between concepts.

### Cross-reference with code
When the user states how something works, check whether the code agrees. Surface contradictions:
"Your code cancels entire Orders, but you just said partial cancellation is possible — which is
right?"

### Update CONTEXT.md inline
When a term is resolved, update `CONTEXT.md` right there — don't batch. Format:
[CONTEXT-FORMAT.md](./reference/CONTEXT-FORMAT.md). `CONTEXT.md` is **totally devoid of
implementation details** — a glossary and nothing else, not a spec or scratchpad.

### Offer ADRs sparingly
Only when all three hold: **hard to reverse**, **surprising without context**, and **the result of
a real trade-off**. If any is missing, skip it. Format:
[ADR-FORMAT.md](./reference/ADR-FORMAT.md).
