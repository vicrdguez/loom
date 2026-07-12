# Acceptance — Add the Worker console

## Manual acceptance
- [ ] From a published release on each supported host family, run `install.sh --cli`, then `loom
      --version`; confirm the installed console tag matches the skills release and no Elixir/Erlang
      installation is required.
- [ ] In an initialized test repository with authenticated `gh` and Codex, publish one
      `loom:ready` Change and run bare `loom`; configure both Roles and confirm the implementor lane
      launches exactly one fresh Worker and hands the resulting `loom:review` PR to the reviewer lane.
- [ ] Observe a real Codex run: completed agent messages render as Markdown Activity while reasoning,
      commands, tool calls, searches, and file-change mechanics never appear or survive restart.
- [ ] Resize the terminal above and below 96 columns; confirm both lanes appear side by side when wide,
      one focused full-width lane appears when narrow, and the command line stays fixed at the bottom.
- [ ] Quit while a Worker is active; confirm the console asks first, stops the Worker gracefully, and
      offers force termination only if the graceful stop does not complete.
- [ ] Start a second console for the same project, then repeat after killing the first ungracefully;
      confirm live ownership is refused and stale ownership is recovered.

## Notes from implementation
Automated coverage is hermetic and uses fake Board/Harness adapters, temporary projects, captured
Codex JSONL shapes, ExRatatui's headless backend, fake CLI artifacts, and a local standard Mix release
smoke test. Live GitHub/Codex authentication and terminal feel remain the human acceptance residue.
