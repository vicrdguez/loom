# Acceptance — Add the Pi Worker console

## Manual acceptance
- [ ] Install the branch with `pi -e git:github.com/vicrdguez/loom@add-pi-worker-console` (or use
      `pi -e .` from its checkout); confirm Pi lists the `loom-workers` extension and every
      `/skill:loom-*` command, and that merely loading the package changes no project file.
- [ ] In a trusted disposable project initialized by `/skill:loom-init`, configure GitHub and create
      one eligible implementor object plus one unrelated review object. Run `/loom-workers start both`,
      select models/thinking levels, and confirm both Role lanes run concurrently with independent
      status and TUI-only Activity.
- [ ] Select the same model for both Roles and confirm Pi warns about absent Model diversity without
      refusing either lane. Restart Pi and confirm each Role's saved choice appears first. If a trusted
      extension registers a provider/model, confirm that model can start a Worker too.
- [ ] While a Worker is running, change its Board lifecycle; confirm status observes the exact object
      but waits for settlement. Requeue a claimed failure by removing only `loom:wip`; confirm a fresh
      Worker starts automatically.
- [ ] Exercise `list`, `status`, `pause`, `resume`, `retry`, and `stop`; confirm `list` groups all open
      lifecycle objects and Claims, `retry` cannot bypass `loom:wip`, and stopping or quitting Pi
      cancels within five seconds while preserving Change worktree files and commits.

## Notes from implementation
`pi -e . --list-models` loaded the local package successfully without a build step. Automated Node
coverage exercises package discovery, GitHub parsing and command/transport failures, model
preferences, extension-registered model discovery, atomic stale-lock contention, fresh session
isolation, Pi extension startup/resource/shutdown hooks, lane reconciliation/controls (including
exact-assignment pause/resume and shutdown during Board selection, Role-lock acquisition, or session
creation), parent shutdown wiring, disposal, and display-width-safe filtered Activity; the POSIX
installer suite continues to cover the unchanged compatibility installer. Pre-Claim retries wait 5
seconds and then 30 seconds before pausing after the third failure. Live model calls, GitHub lifecycle
timing, and visual TUI presentation remain the human-checkable residue above.
