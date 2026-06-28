# Capability docs

`docs/capabilities/<name>.md` is the **living, high-altitude documentation** of what the system
does. It's durable (survives any change being archived, and survives Loom being uninstalled) and is
**edited in place** at the end of `loom-apply` — never delta-merged, never validated by tooling.

## What it is — and isn't

- **Is:** a readable summary a human or agent can skim to understand a capability without reading the
  code, so new changes can be discussed without rebuilding understanding from scratch.
- **Isn't:** the source of truth for behavior. **The tests are.** So the doc can be curated and
  slightly lossy — it links to the tests for the precise, executable version.

Keep it **higher altitude than Gherkin.** Full scenarios live in the (archived) change and in the
tests; the capability doc states the guarantees in prose and points at the tests.

## Format

```md
# {Capability}
{One line: what this capability is for.}

## Behaviors
- {A guarantee, in plain language.}  → `{test reference}`
- {Another guarantee.}               → `{test reference}`   (added {YYYY-MM-DD})

## Decisions
- {Short pointer to an ADR that shaped this capability.} — [ADR-NNNN](../adr/NNNN-slug.md)

## Language
{Key domain terms used here.} — see [CONTEXT.md](../../CONTEXT.md)
```

## Updating it at the end of a change

1. Find the capability the change touched (or create `docs/capabilities/<name>.md` if it's new).
2. Add or revise the **Behaviors** bullets to reflect the new/changed guarantees, each linking the
   test that enforces it. Date newly added lines.
3. Remove guarantees the change removed.
4. Add a **Decisions** pointer if this change produced an ADR.
5. Keep it tight — if a bullet needs a paragraph, the precise version belongs in the test, not here.

### Example

```md
# Orders
How customers place, track, and cancel orders.

## Behaviors
- Order lifecycle: placed → shipped → delivered.  → `test/order_lifecycle`
- A customer can cancel an order only before it ships; cancelling initiates a full refund.
  → `test/order_cancellation`  (added 2026-06-28)

## Decisions
- Orders use an explicit state machine — [ADR-0004](../adr/0004-order-state-machine.md)

## Language
**Order**, **Cancellation** — see [CONTEXT.md](../../CONTEXT.md)
```
