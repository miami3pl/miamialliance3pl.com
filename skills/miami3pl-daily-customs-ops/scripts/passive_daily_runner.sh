#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_DIR="$SKILL_ROOT/outputs"
RUN_LOG="$OUTPUT_DIR/passive-run-$(date +%F).json"

mkdir -p "$OUTPUT_DIR"
python3 "$SCRIPT_DIR/generate_daily_tasklist.py" --json > "$RUN_LOG"
echo "$RUN_LOG"
