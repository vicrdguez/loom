#!/bin/sh
# Loom installer — copies the loom-* Agent Skills into your harness(es), scaffolds docs/loom,
# and injects a lean orientation block into AGENTS.md. POSIX sh, no dependencies.
set -eu

LOOM_VERSION="0.1.0"

TOOLS="claude,codex,opencode"
GLOBAL=0
PROJECT="$PWD"
UNINSTALL=0
FORCE=0
DRYRUN=0

SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)

usage() {
  cat <<'EOF'
Loom installer

Usage:
  ./install.sh [options]

Options:
  --tools LIST     Comma-separated harnesses: claude,codex,opencode (default: all three)
  --global         Install skills into user-level dirs instead of the project
  --project DIR    Target project root (default: current directory)
  --uninstall      Remove loom-* skills and the AGENTS.md block (leaves docs/ and CONTEXT.md)
  --force          Overwrite scaffolded files (e.g. docs/loom/project.md) that already exist
  --dry-run        Print what would happen; change nothing
  --help           Show this help

After installing, run /loom-init in your agent to bootstrap the project.
EOF
}

# Run a command, or just print it under --dry-run.
run() {
  if [ "$DRYRUN" -eq 1 ]; then
    printf '  [dry-run] %s\n' "$*"
  else
    "$@"
  fi
}

say() { printf '%s\n' "$*"; }

# Parse arguments.
while [ $# -gt 0 ]; do
  case $1 in
    --tools) TOOLS=${2:?--tools needs a value}; shift 2 ;;
    --tools=*) TOOLS=${1#*=}; shift ;;
    --global) GLOBAL=1; shift ;;
    --project) PROJECT=${2:?--project needs a value}; shift 2 ;;
    --project=*) PROJECT=${1#*=}; shift ;;
    --uninstall) UNINSTALL=1; shift ;;
    --force) FORCE=1; shift ;;
    --dry-run) DRYRUN=1; shift ;;
    --help|-h) usage; exit 0 ;;
    *) printf 'Unknown option: %s\n' "$1" >&2; usage >&2; exit 1 ;;
  esac
done

# Validate tools.
for tool in $(printf '%s' "$TOOLS" | tr ',' ' '); do
  case $tool in
    claude|codex|opencode) : ;;
    *) printf 'Unknown tool: %s (expected claude, codex, or opencode)\n' "$tool" >&2; exit 1 ;;
  esac
done

# Canonicalize the project path when it already exists.
if [ -d "$PROJECT" ]; then
  PROJECT=$(CDPATH='' cd -- "$PROJECT" && pwd)
fi

# Echo the skills dir for a given tool, honoring --global.
skills_dir_for() {
  if [ "$GLOBAL" -eq 1 ]; then
    case $1 in
      claude) printf '%s/.claude/skills' "$HOME" ;;
      codex) printf '%s/.codex/skills' "$HOME" ;;
      opencode) printf '%s/.config/opencode/skills' "$HOME" ;;
    esac
  else
    case $1 in
      claude) printf '%s/.claude/skills' "$PROJECT" ;;
      codex) printf '%s/.codex/skills' "$PROJECT" ;;
      opencode) printf '%s/.opencode/skills' "$PROJECT" ;;
    esac
  fi
}

install_skills() {
  for tool in $(printf '%s' "$TOOLS" | tr ',' ' '); do
    dir=$(skills_dir_for "$tool")
    say "Skills -> $dir"
    run mkdir -p "$dir"
    for src in "$SCRIPT_DIR"/skills/loom-*; do
      [ -d "$src" ] || continue
      name=$(basename "$src")
      run rm -rf "$dir/$name"
      run cp -R "$src" "$dir/"
    done
  done
}

uninstall_skills() {
  for tool in $(printf '%s' "$TOOLS" | tr ',' ' '); do
    dir=$(skills_dir_for "$tool")
    for src in "$SCRIPT_DIR"/skills/loom-*; do
      [ -d "$src" ] || continue
      name=$(basename "$src")
      if [ -d "$dir/$name" ]; then
        say "Remove $dir/$name"
        run rm -rf "$dir/$name"
      fi
    done
  done
}

scaffold_project() {
  say "Scaffold docs/ in $PROJECT"
  run mkdir -p "$PROJECT/docs/adr" "$PROJECT/docs/capabilities" \
              "$PROJECT/docs/loom/changes/archive"
  proj="$PROJECT/docs/loom/project.md"
  if [ -f "$proj" ] && [ "$FORCE" -eq 0 ]; then
    say "  keep existing docs/loom/project.md"
  else
    run cp "$SCRIPT_DIR/templates/project.md" "$proj"
  fi
}

# Replace the LOOM block in AGENTS.md in place, or create/append it.
inject_agents() {
  agents="$PROJECT/AGENTS.md"
  tmpl="$SCRIPT_DIR/AGENTS.tmpl.md"
  if [ ! -f "$agents" ]; then
    say "Create AGENTS.md with Loom block"
    if [ "$DRYRUN" -eq 0 ]; then cp "$tmpl" "$agents"; fi
    return
  fi
  if grep -q '<!-- LOOM:START -->' "$agents"; then
    say "Refresh Loom block in AGENTS.md"
    if [ "$DRYRUN" -eq 0 ]; then
      awk -v tmpl="$tmpl" '
        BEGIN { block=""; while ((getline line < tmpl) > 0) block = block line ORS }
        /<!-- LOOM:START -->/ { printf "%s", block; skip=1; next }
        /<!-- LOOM:END -->/   { if (skip) { skip=0; next } }
        !skip { print }
      ' "$agents" > "$agents.loomtmp"
      mv "$agents.loomtmp" "$agents"
    fi
  else
    say "Append Loom block to AGENTS.md"
    if [ "$DRYRUN" -eq 0 ]; then
      printf '\n' >> "$agents"
      cat "$tmpl" >> "$agents"
    fi
  fi
}

strip_agents() {
  agents="$PROJECT/AGENTS.md"
  [ -f "$agents" ] || return 0
  grep -q '<!-- LOOM:START -->' "$agents" || return 0
  say "Strip Loom block from AGENTS.md"
  if [ "$DRYRUN" -eq 0 ]; then
    awk '
      /<!-- LOOM:START -->/ { skip=1 }
      /<!-- LOOM:END -->/   { if (skip) { skip=0; next } }
      !skip { print }
    ' "$agents" > "$agents.loomtmp"
    mv "$agents.loomtmp" "$agents"
  fi
}

ensure_claude_import() {
  case ",$TOOLS," in *",claude,"*) : ;; *) return 0 ;; esac
  claude="$PROJECT/CLAUDE.md"
  if [ ! -f "$claude" ]; then
    say "Create CLAUDE.md -> @AGENTS.md"
    if [ "$DRYRUN" -eq 0 ]; then printf '@AGENTS.md\n' > "$claude"; fi
  elif ! grep -q '@AGENTS.md' "$claude"; then
    say "Add @AGENTS.md import to CLAUDE.md"
    if [ "$DRYRUN" -eq 0 ]; then printf '\n@AGENTS.md\n' >> "$claude"; fi
  fi
}

# --- main ---
say "Loom v$LOOM_VERSION"
say "Tools: $TOOLS  |  Scope: $( [ "$GLOBAL" -eq 1 ] && echo global || echo project )  |  Project: $PROJECT"
[ "$DRYRUN" -eq 1 ] && say "(dry run — no changes)"
say ""

if [ "$UNINSTALL" -eq 1 ]; then
  uninstall_skills
  strip_agents
  say ""
  say "Uninstalled Loom skills and AGENTS.md block. docs/ and CONTEXT.md were left untouched."
  exit 0
fi

if [ "$DRYRUN" -eq 0 ]; then mkdir -p "$PROJECT"; fi
install_skills
scaffold_project
inject_agents
ensure_claude_import

say ""
say "Done. Next: run /loom-init in your agent to bootstrap this project."
