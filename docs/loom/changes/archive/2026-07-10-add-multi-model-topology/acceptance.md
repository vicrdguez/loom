# Acceptance — add-multi-model-topology

This is a **prose change**: the "tests" are the SKILL.md / README / AGENTS instructions themselves,
and the mechanical check is that the installer still ships everything (skills install by glob, so
`sh test/install_test.sh` stays green and a fresh install lands `loom-implement` + `loom-review` and
their references). What tests can't judge — whether the prose is correct, coherent, and the forge
commands actually work end-to-end — needs human eyes:

## Read-throughs (prose quality)
- [ ] `loom-implement/SKILL.md` and `loom-review/SKILL.md` read as coherent worker skills, in the same
      voice/altitude as the existing `loom-*` skills (compare against `loom-submit`/`loom-apply`).
- [ ] The **trust boundary** reads unambiguously in both workers: implement *only presents*; review
      *never edits code* and *re-runs verify itself*. No sentence invites a worker to cross it.
- [ ] `loom-propose`'s publish tail makes clear that **default = local, zero forge writes**, and publish
      is only on explicit request (the single-model path must feel unchanged).

## Board commands (need a real forge to trust)
- [ ] On GitHub with `GH_TOKEN` set, walk one change through the board by hand using
      `loom-implement/reference/github.md`: ensure-labels (idempotent on re-run) → publish a
      `loom:ready` issue → open a `loom:review` PR + close the issue → swap to `loom:rework` and back →
      `loom:done`. Confirm each `gh` command is correct as written (label colors, `--force` upsert, the
      review-comment API path, `sort_by(.number)` claim query).
- [ ] The Codeberg/Forgejo and GitLab board references are plausible but were **not** run against a live
      instance — spot-check them if you use those forges (esp. the Forgejo label/PATCH-labels API and
      `glab`'s `--unlabel/--label` swap flags).

## Cross-skill links
- [ ] After a real install, the relative links resolve: `loom-propose`/`loom-review` →
      `../loom-implement/reference/<forge>.md`, and that file → `../../loom-submit/reference/<forge>.md`.
      (Verified in the flat install layout during apply; re-confirm if the installer's directory shape
      ever changes.)

## Docs
- [ ] `README.md`'s "Two topologies" section and the four-label table read correctly to a newcomer, and
      the loop table's new `/loom-review` row doesn't muddy the single-model default.
- [ ] `AGENTS.md` and `AGENTS.tmpl.md` are in sync (same topology block + trust-boundary guardrail), and
      the template block still injects cleanly into a target project's `AGENTS.md`.

## Open question surfaced during apply (non-blocking)
- The single-model relationship between `loom-review` (which lands via the `loom-submit` core on a pass)
  and running `loom-submit` standalone is described at a high level per ADR-0003 but not choreographed
  step-by-step — deliberately, since editing `loom-submit`/`loom-apply` was out of scope. If real
  single-model use shows friction ("do I run review *or* submit?"), that's a follow-up change, not a
  defect here.
