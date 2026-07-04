# Acceptance - add architecture review skill

## Manual acceptance
- [ ] Review `skills/loom-architecture/SKILL.md` and
      `skills/loom-architecture/reference/HTML-REPORT.md`; confirm the workflow is clearly optional
      discovery before `/loom-explore`, not code review or a required Loom phase.
- [ ] Review README and AGENTS guidance; confirm `/loom-architecture` is presented as optional
      discovery and the normal Loom loop remains unchanged.

## Notes from implementation
Installer behavior is covered by `sh test/install_test.sh`. The Markdown behavior of the skill
itself is intentionally reviewed by humans rather than shell-tested, per the change plan.
