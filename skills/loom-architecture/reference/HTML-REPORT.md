# Architecture Review HTML Report

Render the Architecture review as a single temporary HTML file. The report is disposable: it exists
to help the user pick a candidate, not to become project documentation.

## File

- Write to the OS temp directory, for example
  `${TMPDIR:-/tmp}/loom-architecture-review-<slug>.html`.
- Do not write under `docs/`, `docs/loom/`, or the project root unless the user explicitly asks.
- Include enough inline data that the file can be opened directly in a browser.

## Dependencies

Use CDNs for presentation only:

- Tailwind CDN for layout and badges.
- Mermaid CDN for diagrams when a before/after diagram clarifies the recommendation.

The report must remain useful if Mermaid fails: keep all key claims in text.

## Structure

1. **Header**
   - Project name or repo path.
   - Review timestamp.
   - Short note that the report is read-only discovery before `/loom-explore`.

2. **Top recommendation**
   - One candidate only.
   - State why it is first.
   - Show recommendation strength and dependency category badges.
   - Include the best evidence links or paths.

3. **Candidate cards**
   - Include every credible candidate found.
   - Do not cap the list, and do not add filler candidates.
   - Each card contains:
     - Title.
     - Current friction.
     - Deepening move.
     - Evidence.
     - Recommendation strength badge.
     - Dependency category badge.
     - ADR warning badge.
     - Why not now.

4. **Before/after visuals**
   - Use Mermaid for module/seam diagrams when helpful.
   - Keep diagrams conceptual. Do not propose final interfaces or detailed implementation plans.

5. **Next step**
   - Tell the user to choose a candidate and run `/loom-explore`.
   - Make clear that Durable docs are still untouched.

## Badge language

Recommendation strength:

- `Strong` — clear evidence, high leverage, likely to fit a focused Loom Change.
- `Medium` — useful but needs narrowing or stronger evidence in `/loom-explore`.
- `Weak` — credible but lower leverage, riskier, or best deferred.

Dependency category:

- `In-process`
- `Local-substitutable`
- `Remote but owned`
- `True external`

ADR warning:

- `ADR likely` — selection may create a hard-to-reverse, surprising trade-off.
- `ADR possible` — explore first; an ADR may or may not be justified.
- `No ADR expected` — likely ordinary implementation choice.

## Tone

Keep the report visual, concrete, and opinionated. Prefer evidence over hedging. Avoid code-review
language like "nit", "issue", or "finding"; these are architecture candidates, not defects.
