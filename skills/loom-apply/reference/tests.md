# Good and bad tests

## Good tests — integration-style, through the interface

Test observable behaviour through a real interface, not mocks of internal parts.

```
GOOD: "user can checkout with valid cart"
  arrange: cart with a product
  act:     checkout(cart, paymentMethod)
  assert:  result.status == "confirmed"
```

Characteristics: tests behaviour callers care about; uses the public interface only; survives
internal refactors; describes WHAT not HOW; one logical assertion per test.

## Bad tests — coupled to implementation

```
BAD: "checkout calls paymentService.process"
  mock paymentService; assert process was called with cart.total
```

Red flags: mocking internal collaborators; testing private methods; asserting on call
counts/order; the test breaks on a behaviour-preserving refactor; the name describes HOW not WHAT;
verifying through external means instead of the interface.

```
BAD:  createUser → then SELECT * FROM users to confirm   (bypasses the interface)
GOOD: createUser → getUser(id) → assert name             (verifies through the interface)
```

## "Through the interface" is recursive — test internals at their own seam

The rule is *don't reach **past** a module's interface into its private guts* — it is **not** "only
test the topmost public API." A substantial internal module (a slippage model, a state-machine guard)
is itself a module with an interface; write its tests against **that** interface. Those tests don't
map to a top-level Gherkin scenario, and that's expected. Use `loom-design` to tell a real internal
module (test it) from incidental plumbing (don't pin it).

## Materializing a Gherkin scenario

One scenario → one test, in this project's own framework (ExUnit `test`/`describe`, Jest `it`, Go
table tests…). `Scenario Outline` rows → a parameterized/table-driven test.

| Gherkin | Test |
|---|---|
| `Feature` / `Rule` | a `describe`/`context` group |
| `Background` | shared setup (fixture / `setup` block) |
| `Scenario: <name>` | one test (name it after the scenario) |
| `Given …` (`And`/`But`) | arrange |
| `When …` (`And`/`But`) | act (call the interface) |
| `Then …` (`And`/`But`) | assert on the observable result |
| `Scenario Outline` + `Examples` | one parameterized / table-driven test |

```
Scenario: Reject cancelling a shipped order
  → test "order cancellation — reject cancelling a shipped order"
      arrange: an order in "shipped"
      act:     cancel(order)
      assert:  rejected with "already shipped"; order still "shipped"
```

Name tests after behaviour, not methods. No assertions on log lines or internal call counts.
