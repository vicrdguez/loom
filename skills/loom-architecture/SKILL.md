---
name: loom-architecture
description: Discover architecture-improvement candidates before a specific Loom Change is chosen. Scan read-only for architecture friction, render a temporary HTML report with visual deepening candidates, and hand the selected candidate into loom-explore.
---

# loom-architecture

Architecture review is optional discovery before the normal Loom loop. Use it when the user wants to
find a worthwhile architecture improvement but has not chosen a specific Change yet.

This is **not** code review, dependency auditing, style critique, or a general project health check.
The output is a short list of credible architecture-improvement candidates: places where a module
could become deeper, seams could move, duplication could collapse, or domain language could become
clearer enough to unlock future changes.

## Read first

Load the project's orientation material before scanning:

- `docs/loom/project.md` — stack, commands, and repo conventions.
- `CONTEXT.md` or `CONTEXT-MAP.md` — domain language. Read only; do not edit during review.
- `docs/adr/*` — hard-to-reverse decisions already made. Read only.
- `docs/capabilities/*` — what the system already does.

If one of these does not exist, continue. Architecture review can start with a sparse project.

## Scan

Scan read-only. Do not edit code, Durable docs, Loom change docs, or capability docs.

Use several focused passes, preferably with subagents when the Harness supports them:

1. **Module depth pass** — find shallow pass-through modules, over-wide interfaces, and places where
   callers must know too much about an implementation.
2. **Seam pass** — find seams that are missing, misplaced, or hypothetical. Apply the one-adapter
   rule from `loom-design`: one adapter is not a real seam.
3. **Duplication and locality pass** — find behavior repeated across callers where one deeper module
   could improve locality.
4. **Domain language pass** — find naming conflicts or fuzzy terms, checking against `CONTEXT.md`.
5. **Workflow friction pass** — find places where tests, scripts, or docs make the next Change harder
   than it needs to be.

For each candidate, classify the dependency category using `loom-design`'s deepening taxonomy:

- **In-process** — pure computation or in-memory state.
- **Local-substitutable** — filesystem, database, or other dependency with a local test stand-in.
- **Remote but owned** — an owned service across a network seam; use a port and adapters.
- **True external** — third-party service or nondeterministic dependency; inject and mock/fake.

Reject candidates that are merely taste, formatting, isolated bugs, speculative rewrites, or vague
"clean up this area" projects. Include every credible candidate you find; do not cap the list, and
do not pad the report with weak ideas.

## Candidate shape

Each candidate must include:

- **Title** — a concrete architecture-improvement possibility.
- **Current friction** — what makes the system harder to change today.
- **Deepening move** — the kind of module/seam/language improvement worth exploring.
- **Evidence** — files, commands, or observed patterns that justify the candidate.
- **Recommendation strength** — `Strong`, `Medium`, or `Weak`.
- **Dependency category** — one of the categories above.
- **ADR warning** — whether the change may need an ADR if selected.
- **Why not now** — any reason to defer or narrow the candidate.

Pick exactly one **top recommendation**. The top recommendation should maximize likely leverage,
clarity of evidence, and fit for Loom's test-first Change loop.

Do **not** propose final module interfaces in the report. Interface design belongs in
`/loom-explore`, using `loom-design`, after the human chooses a candidate.

## Render the report

Render an ephemeral HTML report in the OS temp directory. Use Tailwind CDN and Mermaid CDN where
diagrams clarify before/after structure. Do not create persistent report files under `docs/loom/`.

Follow [HTML-REPORT.md](./reference/HTML-REPORT.md) for the report structure and visual style.

After writing the report, show the user the path and summarize the top recommendation plus the
number of candidates found.

## Continue

Ask the user which candidate to explore. Once selected:

1. Fork the conversation for the selected candidate when the Harness supports thread forking;
   otherwise continue in the same conversation.
2. Start `/loom-explore` with the selected candidate as the proposed Change.
3. Only then may Durable docs change: `loom-explore` can sharpen `CONTEXT.md`, offer ADRs, and settle
   module shapes.

The hand-off line is:

**"Run `/loom-explore` on the selected Architecture review candidate."**
