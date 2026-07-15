# Loom

Loom is a small workflow for building software with an AI coding agent. You talk a change through
until it's clear, write down what it should do, build it test-first, and open a PR — with documentation
you didn't have to write as a separate chore. It installs into Claude Code, Codex, and OpenCode as a
set of skills.

**Loom doesn't introduce a new method or invents anything**. It takes ideas that already work and wires them into one bundle you install once.

The shape of the workflow is inspired in [OpenSpec](https://github.com/Fission-AI/OpenSpec):
propose a change, work it, and keep living documentation of what the system does.

The working habits are Matt Pocock's, from his
[skills repo](https://github.com/mattpocock/skills): grill a plan before you build it
(`grill-with-docs`), sharpen the domain language as you go (`domain-modeling`), design deep modules
(`codebase-design`), build test-first (`tdd`), and frame intent as a short brief (`to-prd`). Two of
his files, the glossary and ADR formats, are used as-is; the rest is adapted to fit the flow.

What Loom adds is the arrangement: one install, one set of skills, that carries you from a vague idea
to tested code with docs that stay current. If you already use those skills, Loom won't teach you a
new trick. It just puts them on a single line.

## How it differs from OpenSpec

Loom drops OpenSpec's canonical spec tree and the machinery that keeps it correct: delta specs, a
sync step, validation, and a CLI. The reasoning is short. The tests are what guarantee behaviour, so
there's no point maintaining a second source of truth in parallel. What you keep instead is a
plain-English summary of each capability that you edit by hand, sitting on top of the tests that
actually hold the line.

## The loop

If you know the change you want, start with `/loom-explore`. If you want to look for a good
architecture improvement first, run `/loom-architecture`: it scans read-only for architecture
friction, renders a temporary HTML report with candidates, and hands the chosen candidate into
`/loom-explore`.

Run `/loom-init` once in a project, then per change:

| Skill | What it does |
|---|---|
| `/loom-init` | First-time setup: write `docs/loom/project.md` from what's already in the repo, and import an existing OpenSpec tree if there is one. |
| `/loom-explore` | The thinking. Grill the change, then use `loom-domain` and `loom-design` to sharpen the language and settle the module shapes. |
| `/loom-propose` | Cut the change branch (a git worktree), then write the brief: `intent.md` and `behavior.md` (Gherkin), plus `plan.md` and `tasks.md` when the change is big enough to need them. |
| `/loom-apply` | Build it test-first from the scenarios, commit per slice, update the capability doc, and record `acceptance.md` (the human-checkable steps). |
| `/loom-review` | Re-verify independently and code-review guilty-until-proven — a standing model stage run in a **fresh context**, before the human. Pass → land + `loom:done`; fail → bounce with feedback, editing no code. |
| `/loom-submit` | Verify, archive, and open a PR. The PR review is the human acceptance gate — merging it accepts the change and lands the archive on `main`. |

`explore` and `propose` are the interactive, think-hard stages. `apply` builds each change in its own
worktree and `submit` opens the PR, so `apply → submit` can run unattended — even several changes in
parallel — with the human gate at PR merge. Since the decisions are already written down in `plan.md`,
`apply` is the part you can hand to a cheaper model.

**Review is a standing stage, not just verification.** A model reviews; the human accepts. `loom-review`
re-runs the mechanical verify itself (it never trusts the builder's green suite) and adds an
adversarial, guilty-until-proven code read — judging whether each test would actually fail if the
behavior broke, grounded in the target project's own quality skills. Its one rule: it runs in a **fresh
context**, so a model never blesses work in the same context that wrote it.

## Two topologies

Loom's pipeline is one set of stages — explore → propose → build → review → land — run under one of two
**topologies**. There is **no mode flag**: topology is chosen **per change**, and emerges from what you
run.

- **Single-model** (the default): one model plus the human fills every role, handing off sequentially.
  Nothing changes from the table above — except that `review` runs in a fresh context (a separate
  `/loom-review` invocation or a spawned reviewer sub-agent) before you land. Ceremony-free: no board,
  no roles.
- **Multi-model**: distinct models fill the roles — a planner (explore/propose), an **implementor**
  worker (build), and a **reviewer** worker (review) — coordinating asynchronously through the **forge
  board**, with the human's merge as the final gate. Each worker processes one change per invocation
  and exits; the harness's own scheduler re-fires it with a fresh context. Loom ships no runtime.

The **keystone** is the trust boundary: *the model that built a change never verifies, archives, or
blesses it.* That is what makes a cheaper or foreign implementor safe — and it is why review must run
outside the build context (a different model in multi-model; at minimum a fresh context of the same
model in single-model).

### The board and its five labels

In the multi-model topology, workers coordinate through the forge's issues, PRs, and five labels:

| Label | Rides on | Awaiting |
|---|---|---|
| `loom:ready` | issue | an **implementor** to build it |
| `loom:wip` | issue or PR | an **implementor currently working** it (additive Claim) |
| `loom:review` | PR | a **reviewer** to judge it |
| `loom:rework` | PR | the **implementor** to address feedback |
| `loom:done` | PR | the **human** to merge (acceptance) |

`/loom-propose` publishes a change on demand (push the branch + open a `loom:ready` issue pointing to
the brief); `/loom-implement` claims an eligible `loom:ready` issue or `loom:rework` PR by adding
`loom:wip`, builds it by composing `loom-apply`, and opens a PR marked `loom:review`; `/loom-review`
verifies independently and either lands it (`loom:done`) or bounces it (`loom:rework`, feedback as PR
comments). Publishing reuses the existing `## Forge` config — no new setup. See
[ADR-0003](docs/adr/0003-multi-model-topology-via-board-workers.md) and
[ADR-0007](docs/adr/0007-board-claims-use-additive-wip-label.md).

`loom:wip` is additive: claimed work keeps its lifecycle label, and implementors skip objects already
carrying it. Interrupted Claims remain visible until a human removes `wip` to requeue them. This
narrows accidental duplicate pickup but is not an atomic lock.

### Discovery and foundational skills

These are used around or inside the loop, but they stand alone too, which is handy for getting a
brownfield project on its feet before you adopt the full flow. They come almost directly from Matt's
skills repo.

| Skill | What it does |
|---|---|
| `/loom-architecture` | Optional discovery before a change is chosen: scan architecture friction, produce a temporary visual report, and select a candidate for `/loom-explore`. |
| `/loom-domain` | Build and sharpen the domain glossary (`CONTEXT.md`) and record decisions as ADRs. |
| `/loom-design` | Talk about modules in precise terms: interfaces, seams, depth, testability. It applies at every level, so internal modules count too. |

## Install

### Claude Code (native plugin)

Loom ships as a Claude Code plugin, so the idiomatic install is the plugin marketplace — it is
version-tracked and updates in place, no shell or archive juggling:

```
/plugin marketplace add vicrdguez/loom
/plugin install loom@loom
```

Then run `/loom-init` in your project — it scaffolds `docs/`, adds the Loom section to `AGENTS.md`,
and wires `@AGENTS.md` into `CLAUDE.md`.

### Codex, OpenCode, or all harnesses at once (installer)

The plugin mechanism is Claude-only, so Codex and OpenCode (and a one-shot install across all three)
use the script:

```sh
curl -fsSL https://raw.githubusercontent.com/vicrdguez/loom/main/install.sh | sh
```

Pass flags through `sh -s --`:

```sh
curl -fsSL https://raw.githubusercontent.com/vicrdguez/loom/main/install.sh | sh -s -- --tools codex
```

Other flags: `--tools LIST`, `--global` (install the skills for your user instead of one project),
`--project DIR`, `--ref REF`, `--uninstall`, `--force`, `--dry-run`. By default, the remote
installer resolves the latest non-prerelease GitHub release archive. Use `--ref REF` or
`LOOM_REF=REF` to install a specific tag or branch.

GitHub is the canonical host for installs, releases, and PRs. Codeberg is only a mirror.

The installer copies the `loom-*` skills into each harness's skills directory, scaffolds `docs/`,
and adds a short Loom section to `AGENTS.md` (and `@AGENTS.md` to `CLAUDE.md` for Claude Code).
Then run `/loom-init`.

From a checkout, contributors can run the same installer directly:

```sh
./install.sh --tools claude,codex,opencode
```

| Harness | Skills directory (project / global) | Instructions file |
|---|---|---|
| Claude Code | `.claude/skills` / `~/.claude/skills` | `AGENTS.md`, via `CLAUDE.md` → `@AGENTS.md` |
| Codex CLI | `.codex/skills` / `~/.codex/skills` | `AGENTS.md` |
| OpenCode | `.opencode/skills` / `~/.config/opencode/skills` | `AGENTS.md` |

The skills are the common denominator across all three: the same `SKILL.md` format, invokable as
`/loom-*`. That's why there are no per-harness command files to keep in sync.

## What it writes in your project

```
AGENTS.md                    a short Loom section, alongside your own notes
CONTEXT.md                   the domain glossary
docs/
├── adr/NNNN-*.md            architecture decisions
├── capabilities/<name>.md   living docs of what the system does, edited by hand
└── loom/
    ├── project.md           stack and the test/build/lint commands
    └── changes/
        ├── <slug>/{intent.md, behavior.md, plan.md?, tasks.md?, acceptance.md}
        └── archive/<date>-<slug>/…
```

The glossary, ADRs, and capability docs live outside `docs/loom/`, so `./install.sh --uninstall`
takes Loom out and leaves all of that, and your tests, where they are.


## License

MIT. See [LICENSE](LICENSE).
