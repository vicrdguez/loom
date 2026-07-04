# Acceptance - add architecture review skill

## Manual acceptance
- [ ] Review `skills/loom-architecture/SKILL.md` and
      `skills/loom-architecture/reference/HTML-REPORT.md`; confirm the workflow is clearly optional
      discovery before `/loom-explore`, not code review or a required Loom phase.
- [ ] Compare `skills/loom-architecture/SKILL.md` and
      `skills/loom-architecture/reference/HTML-REPORT.md` against Matt Pocock's upstream
      `improve-codebase-architecture` files; confirm Loom only changes command names, hand-off flow,
      and dependency labels where necessary.
- [ ] Review README and AGENTS guidance; confirm `/loom-architecture` is presented as optional
      discovery and the normal Loom loop remains unchanged.

## Notes from implementation
Installer behavior is covered by `sh test/install_test.sh`. The Markdown behavior of the skill
itself is intentionally reviewed by humans rather than shell-tested, per the change plan. After PR
review, the Architecture review skill text and HTML report reference were reworked to preserve Matt
Pocock's upstream scaffold and process more directly, with Loom-specific command substitutions only
where the upstream flow would otherwise point at the wrong skill.
