#!/usr/bin/env bash
# Blocking Stop hook: an assistant turn cannot finish unless the test suite passes,
# and once it passes the CODEBASE.md docs are refreshed for any changed source files.
#
# 1. Runs `npm run test:run` (vitest) in the app directory. On failure it exits 2,
#    which tells Claude Code to BLOCK the stop and feed the output back — so the
#    failing tests must be fixed before the turn can end.
# 2. On success it chains to update-codebase-docs.sh, so the documentation is
#    updated at the same time the tests run (only when they're green). The doc
#    step never blocks the turn.

PROJECT_DIR="/Users/simonvollert/Documents/Hobbies/SchematicDrawer/smart-schematics"
HOOK_DIR="/Users/simonvollert/Documents/Hobbies/SchematicDrawer/.claude"

cd "$PROJECT_DIR" || { echo "run-tests: cannot cd to $PROJECT_DIR" >&2; exit 2; }

OUTPUT=$(npm run test:run 2>&1)
STATUS=$?

if [ "$STATUS" -ne 0 ]; then
  echo "❌ Test suite failed — fix the failing tests before finishing this turn." >&2
  echo "Run \`npm run test:run\` in $PROJECT_DIR to reproduce." >&2
  echo "--- vitest output (tail) ---" >&2
  echo "$OUTPUT" | tail -45 >&2
  exit 2
fi

echo "✅ All tests passed."

# Tests are green → refresh the docs for any changed source files. Guard against
# the nested `claude -p` doc-updater re-entering this hook and re-running the
# whole suite for nothing.
if [ -z "$CLAUDE_DOCS_UPDATE" ]; then
  CLAUDE_DOCS_UPDATE=1 bash "$HOOK_DIR/update-codebase-docs.sh"
fi

exit 0
