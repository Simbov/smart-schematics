#!/usr/bin/env bash
# Auto-update CODEBASE.md when source files under src/ change.
# Chained from run-tests.sh after the test suite passes (Stop hook), so the docs
# are refreshed at the same time the tests run.
#
# The actual prose update needs the `claude` CLI (a nested headless run). That
# CLI is NOT available in every environment (e.g. some sandboxed agent shells
# only have node/npm). When it's missing we DON'T silently no-op — we drop a
# visible marker listing the stale files so the gap is obvious and actionable.

# Resolve paths relative to this script's location (repo-portable)
HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$HOOK_DIR")"
PROJECT_DIR="$REPO_ROOT/smart-schematics"
CODEBASE_MD="$REPO_ROOT/CODEBASE.md"
STALE_MARKER="$HOOK_DIR/DOCS_STALE.txt"

cd "$PROJECT_DIR" || exit 0

# Find src/ files modified more recently than CODEBASE.md (no git required).
# Skip *.test.js/.jsx — test edits alone don't change the architecture docs.
CHANGED=$(find src/ -newer "$CODEBASE_MD" \( -name "*.js" -o -name "*.jsx" \) \
  ! -name "*.test.js" ! -name "*.test.jsx" 2>/dev/null | sort -u)

if [ -z "$CHANGED" ]; then
  # Docs are current — clear any stale marker from a previous run.
  rm -f "$STALE_MARKER"
  exit 0
fi

FILE_LIST=$(echo "$CHANGED" | sed 's/^/  - /')

if ! command -v claude >/dev/null 2>&1; then
  # No CLI to generate docs in this environment. Record the gap loudly.
  {
    echo "CODEBASE.md may be stale — the following source files changed after it"
    echo "was last updated, and the doc-update hook could not run ('claude' CLI"
    echo "not on PATH in this environment). Update CODEBASE.md by hand or ask the"
    echo "agent to refresh it."
    echo
    echo "Changed since CODEBASE.md ($(date)):"
    echo "$FILE_LIST"
  } > "$STALE_MARKER"
  echo "⚠️  Docs not auto-updated: 'claude' CLI unavailable. See .claude/DOCS_STALE.txt" >&2
  exit 0
fi

# CLAUDE_DOCS_UPDATE keeps the nested invocation from re-triggering the test hook.
CLAUDE_DOCS_UPDATE=1 claude --dangerously-skip-permissions -p "
The following source files in the SchematicDrawer project were recently changed:

$FILE_LIST

Read each changed file at $PROJECT_DIR/<path>, then read the current CODEBASE.md at
$CODEBASE_MD and update ONLY the sections that describe the changed files.
Do not rewrite sections that were not affected by the changed files.
Keep the same document structure and section headings.
" && rm -f "$STALE_MARKER"
