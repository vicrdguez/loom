# Acceptance — {change title}

<!--
Written by loom-apply AFTER implementation: the human-checkable residue that automated tests can't
cover — visual rendering, UX feel, copy, anything needing human eyes. loom-submit lifts this into the
PR body, and merging the PR is the acceptance. Do NOT put it in intent.md (frozen after propose).
If the change is fully covered by tests, say so explicitly and leave the list empty.
Delete this comment in the real file.
-->

## Manual acceptance
- [ ] {A step a human runs to confirm the change is right — what to do, and what to look for.}

## Notes from implementation
{Anything learned while building that a reviewer should know: trade-offs taken, follow-ups, risks.}

---

### Example

```md
# Acceptance — add order cancellation

## Manual acceptance
- [ ] Cancel an unshipped order in the UI; the status badge flips to "Cancelled" and a refund toast
      appears.
- [ ] The cancelled order drops out of the "Open orders" filter.

## Notes from implementation
Refund fires async via the existing job queue (~5s in staging). Correctness is covered by tests —
these checks are look-and-feel only.
```
