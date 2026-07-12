---
name: loom-explore
description: Relentlessly interview the user one question at a time to turn a change into clear, shared understanding before any code is written — grilling the plan, then composing loom-domain (sharpen language, record ADRs) and loom-design (deep, testable module shapes). Use at the start of a Loom change, or when the user says explore, grill, scope, stress-test, or challenge a design or its assumptions.
---

# loom-explore

The thinking stage of Loom. This is where the expensive cognition happens: you challenge the
design until you and the user share a precise understanding, and the durable documentation
(glossary + ADRs) falls out as a byproduct. By the end, `loom-propose` is just transcription.

## What to do

Interview me relentlessly about every aspect of this change/plan until you reach shared
understanding. Walk down each branch of the decision tree, resolving dependencies between
decisions one at a time. **For each question, provide your recommended answer.

**Ask the questions one at a time**, waiting for feedback before continuing. Asking multiple questions at once is bewildering

If a fact can be found by exploring the codebase, look it up rather than asking me. The _decisions_, though, are only mine -- put each one to me and wait for my answer

Do not enact on any plan, or confirm the explore session done until I explicitly confirm that we have reached a shared understanding.

## Read first

Before grilling, load what's already known so you can surface contradictions instead of
re-deriving:

- `docs/loom/project.md` — stack, conventions, test/build commands
- `CONTEXT.md` (or `CONTEXT-MAP.md`) — the domain glossary
- `docs/adr/*` — decisions already made
- `docs/capabilities/*` — what the system already does in the area you're touching

When the user states something that contradicts these or the code, call it out immediately.

## Question Format
Follow this format explicitly. Avoid using `AskUserQuestion` or `functions.request_user_input` or any similar
tool. 

```
Q<question number>: <question>

<question context (the "why the question is asked"), brief but clear>

<answer options>

<your recommendation from within the options>
```

## Three lenses (apply throughout)

1. **Grill the plan.** Resolve intent, scope, and edge cases. Invent concrete scenarios that force
   precision. Separate what's in scope from what's explicitly not.

2. **Model the domain — invoke `loom-domain`.** Challenge fuzzy terms, pick one canonical word, and
   write it to `CONTEXT.md` the moment it resolves. Offer an ADR only when a decision is
   hard-to-reverse AND surprising AND a real trade-off. A glossary holds no implementation detail.

3. **Design the code — invoke `loom-design`.** Decide where the seams go and whether each module is
   deep enough to earn its keep. When an interface is genuinely uncertain, design it twice. The dependency
   category you choose per seam becomes the mocking decision in `loom-apply`.

(For a brownfield project with no glossary or unclear module shapes, run `loom-domain` and
`loom-design` standalone first to ground the basics, then come back to grill the change.)

## Capture durable docs inline & lazily

`loom-domain` writes `CONTEXT.md` and ADRs as terms and decisions crystallise — don't batch. These
live at the project root / `docs/`, never in `docs/loom/`; they outlive the change.

## Exit criteria

Shared understanding reached: intent and scope are crisp, the language is sharp, the module shapes
and seams (including critical internal ones) are decided, and any hard decisions are recorded as
ADRs.

## Hand-off and how to deal with big changes

Summarize the agreed scope, the capability/capabilities affected, and the chosen module shapes, then:
**"Run `/loom-propose` to capture this as a change."**

If the explore session ends up with a change with a bigger-than-ideal scope, suggest me a sensible split of the scope resulting in multiple changes that can be proposed with `/loom-propose`.

