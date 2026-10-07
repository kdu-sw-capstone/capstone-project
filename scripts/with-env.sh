#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
if [[ ! -f "$root/.env" ]]; then
  echo 'Create .env from .env.example and configure local credentials first.' >&2
  exit 1
fi
# .env is trusted local shell configuration; quote values containing shell metacharacters.
set -a
source "$root/.env"
set +a
exec "$@"
