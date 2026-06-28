# When to mock

Mock at **system boundaries** only:

- External APIs (payment, email, etc.)
- Databases (sometimes — prefer a test DB / local stand-in)
- Time / randomness
- File system (sometimes)

**Don't mock** your own classes/modules, internal collaborators, or anything you control. Mocking an
internal collaborator is the classic implementation-coupled test.

## The category IS the decision

Which boundary gets a mock follows directly from the dependency category chosen in `loom-design`
(see its DEEPENING reference) and pinned in `plan.md`:

| Category | Strategy |
|---|---|
| **In-process** (pure/in-memory) | No mock — test directly through the interface. |
| **Local-substitutable** (PGLite, SQLite, Ecto sandbox) | Use the real stand-in. Don't mock. |
| **Remote but owned** (your service behind a port) | Inject a port; in-memory adapter in tests, HTTP/gRPC in prod. |
| **True external** (Stripe, Twilio, clock, RNG) | Inject a port; mock/fake adapter in tests. |

## Designing for mockability

**1. Dependency injection** — pass external deps in, don't construct them inside:
```
GOOD: processPayment(order, paymentClient)
BAD:  processPayment(order) { client = new StripeClient(env.KEY); ... }
```

**2. SDK-style interfaces over generic fetchers** — a specific function per external operation, so
each mock returns one shape and there's no conditional logic in test setup:
```
GOOD: api = { getUser(id), getOrders(userId), createOrder(data) }
BAD:  api = { fetch(endpoint, options) }   // mock needs branching
```

## Smell

A test asserting "was called once with X" is usually testing implementation. Prefer asserting on the
*result* the call produced, through the interface. **One adapter is not a seam** — don't introduce a
port unless production + test adapters both justify it.
