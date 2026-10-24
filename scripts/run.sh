#!/bin/sh
# Prefer the user's Node/pnpm; use the bundled desktop runtime when absent.
set -eu
cd "$(dirname "$0")/.."
runtime="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies"
if ! command -v node >/dev/null 2>&1 && [ -x "$runtime/node/bin/node" ]; then
  PATH="$runtime/node/bin:$PATH"
fi
if ! command -v pnpm >/dev/null 2>&1 && [ -x "$runtime/bin/fallback/pnpm" ]; then
  PATH="$runtime/bin/fallback:$PATH"
fi
export PATH
if ! command -v node >/dev/null 2>&1 || ! command -v pnpm >/dev/null 2>&1; then
  echo "Install Node.js 22.13+ and pnpm 11.25.0, then run this command again." >&2
  exit 1
fi
if [ "$#" -eq 0 ]; then set -- dev; fi
exec pnpm "$@"
