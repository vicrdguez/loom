# Board Topology Requires Independent Contexts, Not Different Model IDs

The topology formerly called **multi-model** is now the **Board topology**: Roles are filled by
Board-coordinated Workers, and every Worker invocation must receive a fresh, independent context.
This supersedes ADR 0003's distinct-model requirement because model identity is not the trust
invariant—the single-model topology already permits independent review by the same model in a fresh
context. **Model diversity** remains an optional strengthening, and the Worker console warns rather
than refuses when implementor and reviewer model choices match.
