# Prefer Harness-Native Distribution

Loom uses each Harness's native package mechanism when one exists: Claude Code's plugin system and Pi packages are the preferred installation paths. The shared `install.sh` path is deprecated but remains tested and supported for Codex CLI and OpenCode until they have Loom-native package paths; removing it or adding those future integrations requires separate Changes.
