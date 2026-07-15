# Acceptance — Add reviewer WIP Claims

## Manual acceptance
- [ ] On GitHub, create an older `loom:review + loom:wip` PR and a later `loom:review` PR; confirm the
      reviewer discovery command selects only the later PR.
- [ ] On GitHub, GitLab, and Codeberg, claim an unclaimed review PR; confirm it retains `loom:review`,
      gains `loom:wip`, and a human requeue removes only `loom:wip`.
- [ ] On each forge, confirm reviewer pass and rework handoffs replace `loom:review + loom:wip` with
      `loom:done` and `loom:rework` respectively, after comments are published for rework.

## Notes from implementation
`sh test/install_test.sh` covers installed instructions and forge command contracts. Live forge
permissions and CLI/API behavior remain human checks.
