# {Change title}

<!--
Capture intent so precisely that an implementer needs no further clarification.
Keep each line tight. Delete this comment in the real file.
-->

## Why
{The problem or motivation in 1–3 sentences. What hurts today?}

## What
{What this change introduces, 1-5 sentences.}

## Scope
- {Bullet the things this change DOES.}

## Out of scope
- {Bullet the things it deliberately does NOT do — these prevent scope creep and over-building.}

## Definition of Done
{Observable, testable acceptance — the conditions that mean this change is complete. Every Gherkin
scenario in behavior.md should trace back to a line here.}

---

### Example

```md
# Add order cancellation

## Why
Customers can't cancel an order after placing it, which drives avoidable support load.

## What
Let a customer cancel an order before it ships; refund the full amount automatically.

## Scope
- Customer-initiated cancellation of unshipped orders
- Automatic full refund on cancellation

## Out of scope
- Partial cancellation
- Admin-initiated cancellation
- Post-shipment returns

## Done
- A customer can cancel an order while it is unshipped, and the order becomes "cancelled".
- Cancelling an unshipped order initiates a full refund.
- Cancelling a shipped order is rejected and leaves the order unchanged.
```
