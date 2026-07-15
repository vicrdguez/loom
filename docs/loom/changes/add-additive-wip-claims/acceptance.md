# Acceptance — Add additive WIP Claims

## Manual acceptance
- [ ] On a disposable GitHub, GitLab, or Forgejo repository, follow the relevant Board reference to create and claim a ready issue; confirm the lifecycle label remains alongside `loom:wip`.
- [ ] On Forgejo, exercise claim, requeue, and review handoff commands; confirm numeric label IDs are accepted by the API.

## Notes from implementation
Installer tests cover the installed instruction payload and handoff invariants. Live forge command execution remains manual because each forge is an external system.
