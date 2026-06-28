---
name: loom-explore
description: Relentlessly interview the user one question at a time to turn a change into clear, shared understanding before any code is written — grilling the plan, then composing loom-domain (sharpen language, record ADRs) and loom-design (deep, testable module shapes). Use at the start of a Loom change, or when the user says explore, grill, scope, stress-test, or challenge a design or its assumptions.
---

# loom-explore

The thinking stage of Loom. This is where the expensive cognition happens: you challenge the
design until you and the user share a precise understanding, and the durable documentation
(glossary + ADRs) falls out as a byproduct. By the end, `loom-propose` is just transcription.

## What to do

Interview the user relentlessly about every aspect of this change until you reach shared
understanding. Walk down each branch of the decision tree, resolving dependencies between
decisions one at a time. **For each question, provide your recommended answer.** Ask the questions
**one at a time**, waiting for feedback before continuing.

If a question can be answered by reading the codebase, read the codebase instead of asking.

## Read first

Before grilling, load what's already known so you can surface contradictions instead of
re-deriving:

- `docs/loom/project.md` — stack, conventions, test/build commands
- `CONTEXT.md` (or `CONTEXT-MAP.md`) — the domain glossary
- `docs/adr/*` — decisions already made
- `docs/capabilities/*` — what the system already does in the area you're touching

When the user states something that contradicts these or the code, call it out immediately.

## Three lenses (apply throughout)

1. **Grill the plan.** Resolve intent, scope, and edge cases. Invent concrete scenarios that force
   precision. Separate what's in scope from what's explicitly not.

2. **Model the domain — invoke `loom-domain`.** Challenge fuzzy terms, pick one canonical word, and
   write it to `CONTEXT.md` the moment it resolves. Offer an ADR only when a decision is
   hard-to-reverse AND surprising AND a real trade-off. A glossary holds no implementation detail.

3. **Design the code — invoke `loom-design`.** Decide where the seams go and whether each module is
   deep enough to earn its keep (the deletion test, the one-adapter rule, "the interface is the test
   surface"). Remember depth is **recursive**: critical internals are themselves modules with their
   own interfaces and their own tests — pin those too, not just the public surface. When an interface
   is genuinely uncertain, design it twice. The dependency category you choose per seam becomes the
   mocking decision in `loom-apply`.

(For a brownfield project with no glossary or unclear module shapes, run `loom-domain` and
`loom-design` standalone first to ground the basics, then come back to grill the change.)

## Capture durable docs inline & lazily

`loom-domain` writes `CONTEXT.md` and ADRs as terms and decisions crystallise — don't batch. These
live at the project root / `docs/`, never in `docs/loom/`; they outlive the change.

## Exit criteria

Shared understanding reached: intent and scope are crisp, the language is sharp, the module shapes
and seams (including critical internal ones) are decided, and any hard decisions are recorded as
ADRs.

## Hand-off

Summarize the agreed scope, the capability/capabilities affected, and the chosen module shapes, then:
**"Run `/loom-propose` to capture this as a change."**
