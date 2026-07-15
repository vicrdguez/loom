# Loom

Loom is a small workflow for building software with an AI coding agent. You talk a change through
until it's clear, write down what it should do, build it test-first, and open a PR — with documentation
you didn't have to write as a separate chore. It installs into Claude Code, Pi, Codex CLI, and
OpenCode as a set of skills.

Loom packages proven agent-workflow practices into installable skills.

## How it differs from OpenSpec

Loom drops OpenSpec's canonical spec tree and the machinery that keeps it correct: delta specs, a
sync step, validation, and a CLI. The reasoning is short. The tests are what guarantee behaviour, so
there's no point maintaining a second source of truth in parallel. What you keep instead is a
plain-English summary of each capability that you edit by hand, sitting on top of the tests that
actually hold the line.

## The loop

Commands below use Claude Code's `/loom-*` spelling. In Pi, invoke the same skills as
`/skill:loom-*` (for example, `/skill:loom-init`).

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

`loom-review` independently re-runs verification in a **fresh context**; a human accepts at PR merge.

## Two topologies

Choose a topology per change; there is no mode flag.

- **Single-model** (default): one model and the human work sequentially; run `/loom-review` in a fresh context before landing.
- **Board topology**: planner, implementor, and reviewer Workers coordinate through the forge Board;
  every work unit gets a fresh context, and the reviewer is separate from the builder.

### The Board and its five labels

In the Board topology, Workers coordinate through the forge's issues, PRs, and five labels:

| Label | Rides on | Awaiting |
|---|---|---|
| `loom:ready` | issue | an **implementor** to build it |
| `loom:wip` | issue or PR | a **worker currently working** it (additive Claim) |
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

`loom:wip` is additive: claimed work keeps its lifecycle label, and implementors and reviewers skip
objects already carrying it. Interrupted Claims remain visible until a human removes `wip` to requeue
them. This narrows accidental duplicate pickup but is not an atomic lock.

Pi's `/loom-workers` console can schedule the Board topology while leaving Claims and lifecycle
mutations to the Role skills. It creates a fresh in-memory Pi session for every assignment.

### Discovery and foundational skills

| Skill | What it does |
|---|---|
| `/loom-architecture` | Optional discovery before a change is chosen: scan architecture friction, produce a temporary visual report, and select a candidate for `/loom-explore`. |
| `/loom-domain` | Build and sharpen the domain glossary (`CONTEXT.md`) and record decisions as ADRs. |
| `/loom-design` | Talk about modules in precise terms: interfaces, seams, depth, testability. It applies at every level, so internal modules count too. |

## Install

### Claude Code (native plugin)

Install with:

```
/plugin marketplace add vicrdguez/loom
/plugin install loom@loom
```

Then run `/loom-init` in your project — it scaffolds `docs/`, adds the Loom section to `AGENTS.md`,
and wires `@AGENTS.md` into `CLAUDE.md`.

### Pi (native Git package)

Install the skills and Worker console together:

```sh
pi install git:github.com/vicrdguez/loom
```

In a trusted project, run `/skill:loom-init` once. Start the interactive, GitHub-only Worker console
with `/loom-workers start both`; inspect it with `/loom-workers list` and `/loom-workers status`, and
use `pause`, `resume`, `retry`, or `stop` with `implementor`, `reviewer`, or `both`.

### Codex CLI and OpenCode (deprecated compatibility installer)

`install.sh` is the deprecated compatibility path for Codex CLI and OpenCode. It remains supported
and tested, but gains no Pi mode or runtime warning:

```sh
curl -fsSL https://raw.githubusercontent.com/vicrdguez/loom/main/install.sh | sh
```

Pass flags through `sh -s --`:

```sh
curl -fsSL https://raw.githubusercontent.com/vicrdguez/loom/main/install.sh | sh -s -- --tools codex
```

For options, run `./install.sh --help`.

The installer copies the `loom-*` skills into the selected harness directories, scaffolds `docs/`,
and adds a short Loom section to `AGENTS.md`. Then run `/loom-init`.

From a checkout, contributors can run the same installer directly:

```sh
./install.sh --tools claude,codex,opencode
```


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

Uninstall leaves project docs and tests intact.


## License

MIT. See [LICENSE](LICENSE).
