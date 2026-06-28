# Acceptance — Ship changes via a worktree and PR (loom-submit)

This is a **prose change** (skill + doc files) with no automated test surface, so acceptance is
almost entirely human review.

## Manual acceptance
- [ ] Read the new `skills/loom-submit/SKILL.md` and its three forge references for coherence and
      tone — they should read like the other `loom-*` skills (terse, opinionated).
- [ ] Read the edited `skills/loom-apply/SKILL.md` and `skills/loom-propose/SKILL.md`: apply no longer
      archives/pushes; propose cuts the worktree and GCs merged ones.
- [ ] `AGENTS.md`, `AGENTS.tmpl.md`, and `README.md` describe the `explore → propose → apply → submit`
      loop with the PR as the acceptance gate.
- [ ] Run `sh test/install_test.sh` — installer still green.
- [ ] Run `./install.sh --dry-run` (or real) and confirm `loom-submit` is among the skills copied into
      each harness skills dir.
- [ ] On the **next** real change, confirm the flow end-to-end: propose creates `.loom-worktrees/<slug>/`,
      apply commits per slice + writes `acceptance.md`, submit opens a PR on Codeberg (draft on red,
      ready on green) using `FORGEJO_TOKEN`.

## Notes from implementation
- **Bootstrap exception:** this change was built on `main`, not in a worktree — it *introduces* the
  worktree/PR flow, so it cannot dogfood that flow for its own landing. The first change that fully
  exercises propose→apply→submit will be the *next* one.
- `loom-submit` is picked up by the installer automatically via the `skills/loom-*` glob — no
  `install.sh` change was needed.
- `.loom-worktrees/` gitignore is enforced two ways: a repo-root `.gitignore` entry, and a step in
  `loom-propose` that ensures the line exists before creating a worktree.
- Forge draft semantics differ per forge (GitHub native draft; Forgejo/Codeberg `WIP:` title prefix;
  GitLab native draft) — captured in each reference file.
