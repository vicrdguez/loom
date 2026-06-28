# Loom

Loom is a small workflow for building software with an AI coding agent. You talk a change through
until it's clear, write down what it should do, build it test-first, and come out with documentation
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

Run `/loom-init` once in a project, then per change:

| Skill | What it does |
|---|---|
| `/loom-init` | First-time setup: write `docs/loom/project.md` from what's already in the repo, and import an existing OpenSpec tree if there is one. |
| `/loom-explore` | The thinking. Grill the change, then use `loom-domain` and `loom-design` to sharpen the language and settle the module shapes. |
| `/loom-propose` | Write the brief: `intent.md` and `behavior.md` (Gherkin), plus `plan.md` and `tasks.md` when the change is big enough to need them. |
| `/loom-apply` | Build it test-first from the scenarios, update the capability doc, archive the change. |

`explore` and `propose` are the interactive, think-hard stages. `apply` is the executor, and since
the decisions are already written down in `plan.md`, you can hand it to a cheaper model.

### Two skills you can also run on their own

These are used inside the loop, but they stand alone too, which is handy for getting a brownfield
project on its feet before you adopt the full flow. These come almost directly from Matt's skills repo.

| Skill | What it does |
|---|---|
| `/loom-domain` | Build and sharpen the domain glossary (`CONTEXT.md`) and record decisions as ADRs. |
| `/loom-design` | Talk about modules in precise terms: interfaces, seams, depth, testability. It applies at every level, so internal modules count too. |

## Install

```sh
curl -fsSL https://codeberg.org/vicrodriguez/loom/raw/branch/main/install.sh | sh
```

Pass flags through `sh -s --`:

```sh
curl -fsSL https://codeberg.org/vicrodriguez/loom/raw/branch/main/install.sh | sh -s -- --tools codex
```

Other flags: `--tools LIST`, `--global` (install the skills for your user instead of one project),
`--project DIR`, `--ref REF`, `--uninstall`, `--force`, `--dry-run`. By default, the remote
installer resolves the latest non-prerelease Codeberg release archive. Use `--ref REF` or
`LOOM_REF=REF` to install a specific tag or branch.

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
        ├── <slug>/{intent.md, behavior.md, plan.md?, tasks.md?}
        └── archive/<date>-<slug>/…
```

The glossary, ADRs, and capability docs live outside `docs/loom/`, so `./install.sh --uninstall`
takes Loom out and leaves all of that, and your tests, where they are.


## License

MIT. See [LICENSE](LICENSE).
