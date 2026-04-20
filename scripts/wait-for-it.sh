#!/usr/bin/env sh
set -eu

HOST="${1:-localhost}"
PORT="${2:-80}"

echo "Waiting stub for ${HOST}:${PORT}"
