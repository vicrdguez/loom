# Plan — {change title}

<!--
Write this file ONLY when there are real decisions to pin. Its purpose is to keep the implementer
from making important architectural decisions at code time — including INTERNAL ones. If there's
nothing to pin, skip it. Reference ADRs rather than restating them. Delete this comment.
-->

## Approach
{The implementation strategy in a few sentences. How the pieces fit together.}

## Module shapes & seams
<!--
The deep-module / seam decisions from loom-explore + loom-design. Module is scale-agnostic: capture
the PUBLIC module AND its critical INTERNAL modules. For each, state the interface, what's hidden,
the seam/dependency category, and the invariants it must uphold. Internal correctness is often the
whole point — pin it.
-->
- {Public module}: interface `{...}`; hides `{...}`. Seam: {in-process | local-substitutable |
  remote-but-owned port | true-external} → {test strategy}.
- {Internal module}: interface `{...}`; invariants `{...}`. Tested at its own seam.

## Pinned decisions
<!-- Decisions the implementer must NOT relitigate — interface shape AND internal algorithm/data
choices. The "no"s matter as much as the "yes"es. Link ADRs. -->
- {Decision and the one-line reason.}

## Sequence
1. {Ordered high-level steps, if order matters.}

---

### Example

```md
# Plan — Add order cancellation

## Approach
Add `cancel/1` to the Order aggregate, guarded by the state machine. Cancellation emits
`OrderCancelled`; a handler issues the refund through the payment port.

## Module shapes & seams
- Order aggregate: interface `cancel(order)`; hides the state-machine guard. Seam: in-process — test
  directly.
- State-machine guard (internal): interface `transition(state, event)`; invariant: only
  `placed → cancelled` is legal, every other transition is rejected. Tested at its own seam.
- Refunds: via the existing `PaymentGateway.refund/1` port. Seam: true-external (Stripe) → mock
  adapter in tests.

## Pinned decisions
- Refunds are full-only, no proration. (Keeps this change small.)
- Cancellation legality lives in the state-machine guard, not scattered across callers. See ADR-0004.
- Never call Stripe directly from the aggregate — always via the PaymentGateway port.

## Sequence
1. Guard transition → 2. emit OrderCancelled → 3. refund handler reacts.
```
