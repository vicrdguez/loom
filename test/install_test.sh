#!/bin/sh
set -eu

ROOT=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
TMP_ROOT=$(mktemp -d "${TMPDIR:-/tmp}/loom-install-test.XXXXXX")
PASS=0
FAIL=0
CURRENT_OUT=""
CURRENT_STATUS=0
ASSERT_FAILED=0
SH_BIN=$(command -v sh)

cleanup() {
  rm -rf "$TMP_ROOT"
}
trap cleanup EXIT INT TERM

note() {
  printf '%s\n' "$*"
}

fail() {
  ASSERT_FAILED=1
  printf '    %s\n' "$*" >&2
  return 1
}

assert_status() {
  expected=$1
  if [ "$CURRENT_STATUS" -ne "$expected" ]; then
    note "    output:"
    sed 's/^/      /' "$CURRENT_OUT" >&2 || true
    fail "expected status $expected, got $CURRENT_STATUS"
  fi
}

assert_exists() {
  [ -e "$1" ] || fail "expected $1 to exist"
}

assert_not_exists() {
  [ ! -e "$1" ] || fail "expected $1 not to exist"
}

assert_dir_empty() {
  if find "$1" -mindepth 1 -print | grep . >/dev/null 2>&1; then
    fail "expected $1 to be empty"
  fi
}

assert_contains() {
  file=$1
  text=$2
  grep -F "$text" "$file" >/dev/null 2>&1 || fail "expected $file to contain: $text"
}

assert_not_contains() {
  file=$1
  text=$2
  if grep -F "$text" "$file" >/dev/null 2>&1; then
    fail "expected $file not to contain: $text"
  fi
}

run_cmd() {
  CURRENT_OUT="$TMP_ROOT/out.$$"
  set +e
  "$@" >"$CURRENT_OUT" 2>&1
  CURRENT_STATUS=$?
  set -e
}

run_test() {
  name=$1
  shift
  note "test: $name"
  ASSERT_FAILED=0
  set +e
  "$@"
  test_status=$?
  set -e
  if [ "$test_status" -eq 0 ] && [ "$ASSERT_FAILED" -eq 0 ]; then
    PASS=$((PASS + 1))
    note "  ok"
  else
    FAIL=$((FAIL + 1))
    note "  not ok"
  fi
}

make_project() {
  dir="$TMP_ROOT/project-$1"
  mkdir -p "$dir"
  printf '%s\n' "$dir"
}

make_home() {
  dir="$TMP_ROOT/home-$1"
  mkdir -p "$dir"
  printf '%s\n' "$dir"
}

make_failing_remote_bin() {
  dir="$TMP_ROOT/bin-fail-remote-$1"
  mkdir -p "$dir"
  cat >"$dir/curl" <<'SH'
#!/bin/sh
echo "unexpected curl $*" >&2
exit 99
SH
  cat >"$dir/wget" <<'SH'
#!/bin/sh
echo "unexpected wget $*" >&2
exit 99
SH
  chmod +x "$dir/curl" "$dir/wget"
  printf '%s\n' "$dir"
}

make_system_bin() {
  dir="$TMP_ROOT/bin-system-$1"
  mkdir -p "$dir"
  for cmd in awk basename cat chmod cp grep mkdir mktemp mv rm sed sh tar tr; do
    src=$(command -v "$cmd")
    ln -sf "$src" "$dir/$cmd"
  done
  printf '%s\n' "$dir"
}

copy_valid_payload() {
  dest=$1
  mkdir -p "$dest"
  cp "$ROOT/install.sh" "$dest/install.sh"
  cp "$ROOT/AGENTS.tmpl.md" "$dest/AGENTS.tmpl.md"
  mkdir -p "$dest/templates" "$dest/skills"
  cp "$ROOT/templates/project.md" "$dest/templates/project.md"
  cp -R "$ROOT/skills/loom-domain" "$dest/skills/"
  cp -R "$ROOT/skills/loom-design" "$dest/skills/"
  cp -R "$ROOT/skills/loom-explore" "$dest/skills/"
  cp -R "$ROOT/skills/loom-propose" "$dest/skills/"
  cp -R "$ROOT/skills/loom-apply" "$dest/skills/"
  cp -R "$ROOT/skills/loom-architecture" "$dest/skills/"
  cp -R "$ROOT/skills/loom-init" "$dest/skills/"
}

make_valid_archive() {
  ref=$1
  archive_dir=$2
  payload="$TMP_ROOT/payload-$ref"
  rm -rf "$payload"
  copy_valid_payload "$payload/loom-$ref"
  mkdir -p "$archive_dir"
  (cd "$payload" && tar -czf "$archive_dir/$ref.tar.gz" "loom-$ref")
}

make_archive_without_architecture_skill() {
  ref=$1
  archive_dir=$2
  payload="$TMP_ROOT/payload-without-architecture-$ref"
  rm -rf "$payload"
  copy_valid_payload "$payload/loom-$ref"
  rm -rf "$payload/loom-$ref/skills/loom-architecture"
  mkdir -p "$archive_dir"
  (cd "$payload" && tar -czf "$archive_dir/$ref.tar.gz" "loom-$ref")
}

make_invalid_archive() {
  ref=$1
  archive_dir=$2
  payload="$TMP_ROOT/invalid-payload-$ref"
  rm -rf "$payload"
  mkdir -p "$payload/loom-$ref"
  cp "$ROOT/install.sh" "$payload/loom-$ref/install.sh"
  mkdir -p "$archive_dir"
  (cd "$payload" && tar -czf "$archive_dir/$ref.tar.gz" "loom-$ref")
}

make_remote_script() {
  name=$1
  dir="$TMP_ROOT/bootstrap-$name"
  mkdir -p "$dir"
  cp "$ROOT/install.sh" "$dir/install.sh"
  printf '%s\n' "$dir/install.sh"
}

make_fake_download_bin() {
  name=$1
  downloaders=$2
  metadata=$3
  archive_dir=$4
  log=$5
  dir="$TMP_ROOT/bin-download-$name"
  mkdir -p "$dir"
  cat >"$dir/fetch" <<'SH'
#!/bin/sh
url=
for arg in "$@"; do
  url=$arg
done
tool=${0##*/}
printf '%s %s\n' "$tool" "$url" >> "$LOOM_TEST_LOG"
case $url in
  *'api.github.com/repos/vicrdguez/loom/releases?'*)
    cat "$LOOM_TEST_METADATA"
    ;;
  *'/archive/'*.tar.gz)
    ref=${url##*/archive/}
    ref=${ref%.tar.gz}
    cat "$LOOM_TEST_ARCHIVE_DIR/$ref.tar.gz"
    ;;
  *)
    echo "unexpected download URL: $url" >&2
    exit 44
    ;;
esac
SH
  chmod +x "$dir/fetch"
  case " $downloaders " in *" curl "*) cp "$dir/fetch" "$dir/curl"; chmod +x "$dir/curl" ;; esac
  case " $downloaders " in *" wget "*) cp "$dir/fetch" "$dir/wget"; chmod +x "$dir/wget" ;; esac
  printf '%s:%s\n' "$dir" "$(make_system_bin "$name")"
}

test_checkout_install_includes_architecture_review_skill() {
  project=$(make_project local-install)
  home=$(make_home local-install)
  failbin=$(make_failing_remote_bin local-install)

  run_cmd env HOME="$home" PATH="$failbin:$PATH" "$SH_BIN" "$ROOT/install.sh" \
    --tools codex \
    --project "$project"

  assert_status 0
  assert_exists "$project/.codex/skills/loom-architecture/SKILL.md"
  assert_exists "$project/.codex/skills/loom-explore/SKILL.md"
  assert_exists "$project/.codex/skills/loom-propose/SKILL.md"
  assert_exists "$project/.codex/skills/loom-apply/SKILL.md"
  assert_exists "$project/docs/loom/project.md"
  assert_contains "$project/AGENTS.md" "<!-- LOOM:START -->"
  assert_not_exists "$home/.codex"
}

test_install_latest_non_prerelease_release() {
  project=$(make_project latest-release)
  home=$(make_home latest-release)
  metadata="$TMP_ROOT/releases-latest.json"
  archives="$TMP_ROOT/archives-latest"
  log="$TMP_ROOT/download-latest.log"
  bootstrap=$(make_remote_script latest-release)

  cat >"$metadata" <<'JSON'
[
  {"tag_name":"v0.2.0-rc1","prerelease":true,"draft":false},
  {"tag_name":"v0.1.0","prerelease":false,"draft":false}
]
JSON
  make_valid_archive "v0.1.0" "$archives"
  : >"$log"

  test_path=$(make_fake_download_bin latest-release "curl wget" "$metadata" "$archives" "$log")

  run_cmd env \
    HOME="$home" \
    PATH="$test_path" \
    LOOM_TEST_METADATA="$metadata" \
    LOOM_TEST_ARCHIVE_DIR="$archives" \
    LOOM_TEST_LOG="$log" \
    "$SH_BIN" "$bootstrap" \
    --tools codex \
    --project "$project"

  assert_status 0
  assert_contains "$log" "api.github.com/repos/vicrdguez/loom/releases?per_page=50"
  assert_contains "$log" "/archive/v0.1.0.tar.gz"
  assert_not_contains "$log" "/archive/v0.2.0-rc1.tar.gz"
  assert_exists "$project/.codex/skills/loom-explore/SKILL.md"
  assert_exists "$project/docs/loom/project.md"
  assert_contains "$project/AGENTS.md" "<!-- LOOM:START -->"
  assert_not_exists "$home/.codex"
}

test_select_explicit_ref_for_remote_install() {
  metadata="$TMP_ROOT/releases-explicit.json"
  archives="$TMP_ROOT/archives-explicit"
  cat >"$metadata" <<'JSON'
[
  {"tag_name":"v9.9.9","prerelease":false,"draft":false}
]
JSON
  make_valid_archive "v0.1.0" "$archives"
  make_valid_archive "main" "$archives"

  project_env=$(make_project explicit-env)
  home_env=$(make_home explicit-env)
  log_env="$TMP_ROOT/download-explicit-env.log"
  bootstrap_env=$(make_remote_script explicit-env)
  : >"$log_env"
  path_env=$(make_fake_download_bin explicit-env "curl wget" "$metadata" "$archives" "$log_env")

  run_cmd env \
    HOME="$home_env" \
    PATH="$path_env" \
    LOOM_REF="v0.1.0" \
    LOOM_TEST_METADATA="$metadata" \
    LOOM_TEST_ARCHIVE_DIR="$archives" \
    LOOM_TEST_LOG="$log_env" \
    "$SH_BIN" "$bootstrap_env" \
    --tools codex \
    --project "$project_env"

  assert_status 0
  assert_not_contains "$log_env" "api.github.com/repos/vicrdguez/loom/releases?"
  assert_contains "$log_env" "/archive/v0.1.0.tar.gz"
  assert_exists "$project_env/.codex/skills/loom-explore/SKILL.md"

  project_cli=$(make_project explicit-cli)
  home_cli=$(make_home explicit-cli)
  log_cli="$TMP_ROOT/download-explicit-cli.log"
  bootstrap_cli=$(make_remote_script explicit-cli)
  : >"$log_cli"
  path_cli=$(make_fake_download_bin explicit-cli "curl wget" "$metadata" "$archives" "$log_cli")

  run_cmd env \
    HOME="$home_cli" \
    PATH="$path_cli" \
    LOOM_REF="v0.1.0" \
    LOOM_TEST_METADATA="$metadata" \
    LOOM_TEST_ARCHIVE_DIR="$archives" \
    LOOM_TEST_LOG="$log_cli" \
    "$SH_BIN" "$bootstrap_cli" \
    --ref main \
    --tools codex \
    --project "$project_cli"

  assert_status 0
  assert_not_contains "$log_cli" "api.github.com/repos/vicrdguez/loom/releases?"
  assert_contains "$log_cli" "/archive/main.tar.gz"
  assert_not_contains "$log_cli" "/archive/v0.1.0.tar.gz"
  assert_exists "$project_cli/.codex/skills/loom-explore/SKILL.md"
}

test_fail_when_no_stable_release_exists() {
  project=$(make_project no-stable)
  home=$(make_home no-stable)
  metadata="$TMP_ROOT/releases-no-stable.json"
  archives="$TMP_ROOT/archives-no-stable"
  log="$TMP_ROOT/download-no-stable.log"
  bootstrap=$(make_remote_script no-stable)

  cat >"$metadata" <<'JSON'
[
  {"tag_name":"v0.2.0-rc1","prerelease":true,"draft":false},
  {"tag_name":"v0.1.0-draft","prerelease":false,"draft":true}
]
JSON
  mkdir -p "$archives"
  : >"$log"
  test_path=$(make_fake_download_bin no-stable "curl wget" "$metadata" "$archives" "$log")

  run_cmd env \
    HOME="$home" \
    PATH="$test_path" \
    LOOM_TEST_METADATA="$metadata" \
    LOOM_TEST_ARCHIVE_DIR="$archives" \
    LOOM_TEST_LOG="$log" \
    "$SH_BIN" "$bootstrap" \
    --tools codex \
    --project "$project"

  assert_status 1
  assert_contains "$CURRENT_OUT" "No stable Loom release found on GitHub"
  assert_contains "$log" "api.github.com/repos/vicrdguez/loom/releases?per_page=50"
  assert_not_contains "$log" "/archive/"
  assert_dir_empty "$project"
  assert_not_exists "$home/.codex"
}

test_reject_invalid_remote_payload() {
  project=$(make_project invalid-payload)
  home=$(make_home invalid-payload)
  metadata="$TMP_ROOT/releases-invalid.json"
  archives="$TMP_ROOT/archives-invalid"
  log="$TMP_ROOT/download-invalid.log"
  bootstrap=$(make_remote_script invalid-payload)

  cat >"$metadata" <<'JSON'
[
  {"tag_name":"v0.1.0","prerelease":false,"draft":false}
]
JSON
  make_invalid_archive "v0.1.0" "$archives"
  : >"$log"
  test_path=$(make_fake_download_bin invalid-payload "curl wget" "$metadata" "$archives" "$log")

  run_cmd env \
    HOME="$home" \
    PATH="$test_path" \
    LOOM_REF="v0.1.0" \
    LOOM_TEST_METADATA="$metadata" \
    LOOM_TEST_ARCHIVE_DIR="$archives" \
    LOOM_TEST_LOG="$log" \
    "$SH_BIN" "$bootstrap" \
    --tools codex \
    --project "$project"

  assert_status 1
  assert_contains "$CURRENT_OUT" "Invalid Loom release archive for v0.1.0"
  assert_contains "$log" "/archive/v0.1.0.tar.gz"
  assert_dir_empty "$project"
  assert_not_exists "$home/.codex"
}

test_remote_release_payload_requires_architecture_review_skill() {
  project=$(make_project missing-architecture)
  home=$(make_home missing-architecture)
  metadata="$TMP_ROOT/releases-missing-architecture.json"
  archives="$TMP_ROOT/archives-missing-architecture"
  log="$TMP_ROOT/download-missing-architecture.log"
  bootstrap=$(make_remote_script missing-architecture)

  cat >"$metadata" <<'JSON'
[
  {"tag_name":"v0.1.0","prerelease":false,"draft":false}
]
JSON
  make_archive_without_architecture_skill "v0.1.0" "$archives"
  : >"$log"
  test_path=$(make_fake_download_bin missing-architecture "curl wget" "$metadata" "$archives" "$log")

  run_cmd env \
    HOME="$home" \
    PATH="$test_path" \
    LOOM_REF="v0.1.0" \
    LOOM_TEST_METADATA="$metadata" \
    LOOM_TEST_ARCHIVE_DIR="$archives" \
    LOOM_TEST_LOG="$log" \
    "$SH_BIN" "$bootstrap" \
    --tools codex \
    --project "$project"

  assert_status 1
  assert_contains "$CURRENT_OUT" "Invalid Loom release archive for v0.1.0"
  assert_contains "$log" "/archive/v0.1.0.tar.gz"
  assert_dir_empty "$project"
  assert_not_exists "$home/.codex"
}

test_remote_install_includes_architecture_review_skill() {
  project=$(make_project remote-architecture)
  home=$(make_home remote-architecture)
  metadata="$TMP_ROOT/releases-remote-architecture.json"
  archives="$TMP_ROOT/archives-remote-architecture"
  log="$TMP_ROOT/download-remote-architecture.log"
  bootstrap=$(make_remote_script remote-architecture)

  cat >"$metadata" <<'JSON'
[
  {"tag_name":"v0.1.0","prerelease":false,"draft":false}
]
JSON
  make_valid_archive "v0.1.0" "$archives"
  : >"$log"
  test_path=$(make_fake_download_bin remote-architecture "curl wget" "$metadata" "$archives" "$log")

  run_cmd env \
    HOME="$home" \
    PATH="$test_path" \
    LOOM_REF="v0.1.0" \
    LOOM_TEST_METADATA="$metadata" \
    LOOM_TEST_ARCHIVE_DIR="$archives" \
    LOOM_TEST_LOG="$log" \
    "$SH_BIN" "$bootstrap" \
    --tools codex \
    --project "$project"

  assert_status 0
  assert_exists "$project/.codex/skills/loom-architecture/SKILL.md"
  assert_exists "$project/.codex/skills/loom-architecture/reference/HTML-REPORT.md"
  assert_exists "$project/docs/loom/project.md"
  assert_contains "$project/AGENTS.md" "<!-- LOOM:START -->"
  assert_not_exists "$home/.codex"
}

test_dry_run_remote_install_makes_no_project_or_user_install_changes() {
  project=$(make_project dry-run)
  home=$(make_home dry-run)
  metadata="$TMP_ROOT/releases-dry-run.json"
  archives="$TMP_ROOT/archives-dry-run"
  log="$TMP_ROOT/download-dry-run.log"
  bootstrap=$(make_remote_script dry-run)

  cat >"$metadata" <<'JSON'
[
  {"tag_name":"v0.1.0","prerelease":false,"draft":false}
]
JSON
  make_valid_archive "v0.1.0" "$archives"
  : >"$log"
  test_path=$(make_fake_download_bin dry-run "curl wget" "$metadata" "$archives" "$log")

  run_cmd env \
    HOME="$home" \
    PATH="$test_path" \
    LOOM_REF="v0.1.0" \
    LOOM_TEST_METADATA="$metadata" \
    LOOM_TEST_ARCHIVE_DIR="$archives" \
    LOOM_TEST_LOG="$log" \
    "$SH_BIN" "$bootstrap" \
    --dry-run \
    --tools codex \
    --project "$project"

  assert_status 0
  assert_contains "$CURRENT_OUT" "[dry-run]"
  assert_contains "$log" "/archive/v0.1.0.tar.gz"
  assert_dir_empty "$project"
  assert_not_exists "$home/.codex"
}

test_remote_uninstall_removes_loom_artifacts_and_preserves_durable_docs() {
  project=$(make_project remote-uninstall)
  home=$(make_home remote-uninstall)

  run_cmd env HOME="$home" "$SH_BIN" "$ROOT/install.sh" \
    --tools codex \
    --project "$project"
  assert_status 0

  printf '# Project context\n' > "$project/CONTEXT.md"
  mkdir -p "$project/docs/capabilities"
  printf '# Installation\n' > "$project/docs/capabilities/installation.md"
  assert_exists "$project/.codex/skills/loom-architecture/SKILL.md"
  assert_exists "$project/.codex/skills/loom-explore/SKILL.md"
  assert_contains "$project/AGENTS.md" "<!-- LOOM:START -->"

  metadata="$TMP_ROOT/releases-uninstall.json"
  archives="$TMP_ROOT/archives-uninstall"
  log="$TMP_ROOT/download-uninstall.log"
  bootstrap=$(make_remote_script remote-uninstall)

  cat >"$metadata" <<'JSON'
[
  {"tag_name":"v0.1.0","prerelease":false,"draft":false}
]
JSON
  make_valid_archive "v0.1.0" "$archives"
  : >"$log"
  test_path=$(make_fake_download_bin remote-uninstall "curl wget" "$metadata" "$archives" "$log")

  run_cmd env \
    HOME="$home" \
    PATH="$test_path" \
    LOOM_REF="v0.1.0" \
    LOOM_TEST_METADATA="$metadata" \
    LOOM_TEST_ARCHIVE_DIR="$archives" \
    LOOM_TEST_LOG="$log" \
    "$SH_BIN" "$bootstrap" \
    --uninstall \
    --tools codex \
    --project "$project"

  assert_status 0
  assert_not_exists "$project/.codex/skills/loom-architecture"
  assert_not_exists "$project/.codex/skills/loom-explore"
  assert_not_contains "$project/AGENTS.md" "<!-- LOOM:START -->"
  assert_exists "$project/docs/loom/project.md"
  assert_exists "$project/CONTEXT.md"
  assert_exists "$project/docs/capabilities/installation.md"
}

test_fetch_remote_payload_with_available_downloader() {
  for downloader in curl wget; do
    project=$(make_project "downloader-$downloader")
    home=$(make_home "downloader-$downloader")
    metadata="$TMP_ROOT/releases-downloader-$downloader.json"
    archives="$TMP_ROOT/archives-downloader-$downloader"
    log="$TMP_ROOT/download-downloader-$downloader.log"
    bootstrap=$(make_remote_script "downloader-$downloader")

    cat >"$metadata" <<'JSON'
[
  {"tag_name":"v0.1.0","prerelease":false,"draft":false}
]
JSON
    make_valid_archive "v0.1.0" "$archives"
    : >"$log"
    test_path=$(make_fake_download_bin "downloader-$downloader" "$downloader" "$metadata" "$archives" "$log")

    run_cmd env \
      HOME="$home" \
      PATH="$test_path" \
      LOOM_REF="v0.1.0" \
      LOOM_TEST_METADATA="$metadata" \
      LOOM_TEST_ARCHIVE_DIR="$archives" \
      LOOM_TEST_LOG="$log" \
      "$SH_BIN" "$bootstrap" \
      --tools codex \
      --project "$project"

    assert_status 0
    assert_contains "$log" "$downloader https://github.com/vicrdguez/loom/archive/v0.1.0.tar.gz"
    assert_exists "$project/.codex/skills/loom-explore/SKILL.md"
  done
}

test_fail_clearly_when_no_downloader_is_available() {
  project=$(make_project no-downloader)
  home=$(make_home no-downloader)
  bootstrap=$(make_remote_script no-downloader)
  test_path=$(make_system_bin no-downloader)

  run_cmd env \
    HOME="$home" \
    PATH="$test_path" \
    "$SH_BIN" "$bootstrap" \
    --tools codex \
    --project "$project"

  assert_status 1
  assert_contains "$CURRENT_OUT" "Remote install requires curl or wget"
  assert_dir_empty "$project"
  assert_not_exists "$home/.codex"
}

run_test "Checkout install includes the architecture review skill" \
  test_checkout_install_includes_architecture_review_skill
run_test "Install the latest non-prerelease release" \
  test_install_latest_non_prerelease_release
run_test "Select an explicit ref for remote install" \
  test_select_explicit_ref_for_remote_install
run_test "Fail when no stable release exists" \
  test_fail_when_no_stable_release_exists
run_test "Reject an invalid remote payload" \
  test_reject_invalid_remote_payload
run_test "Remote release payload requires the architecture review skill" \
  test_remote_release_payload_requires_architecture_review_skill
run_test "Remote install includes the architecture review skill" \
  test_remote_install_includes_architecture_review_skill
run_test "Dry-run remote install makes no project or user install changes" \
  test_dry_run_remote_install_makes_no_project_or_user_install_changes
run_test "Remote uninstall removes Loom artifacts and preserves durable docs" \
  test_remote_uninstall_removes_loom_artifacts_and_preserves_durable_docs
run_test "Fetch the remote payload with an available downloader" \
  test_fetch_remote_payload_with_available_downloader
run_test "Fail clearly when no downloader is available" \
  test_fail_clearly_when_no_downloader_is_available

note ""
note "$PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
