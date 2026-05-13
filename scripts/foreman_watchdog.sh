#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

REPORT_DIR="${ROOT_DIR}/.tmp/foreman-watchdog"
mkdir -p "${REPORT_DIR}"

STAMP_UTC="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
REPORT_PATH="${REPORT_DIR}/report-${STAMP_UTC//:/-}.md"
CODEX_LOG="${REPORT_DIR}/codex-lane-${STAMP_UTC//:/-}.log"
OPUS_LOG="${REPORT_DIR}/opus-lane-${STAMP_UTC//:/-}.log"

FAILURES=0

{
  echo "# Codex + Opus Foreman Watchdog"
  echo
  echo "- Timestamp UTC: ${STAMP_UTC}"
  echo "- Workspace: ${ROOT_DIR}"
  echo
  echo "## Codex lane"
} > "${REPORT_PATH}"

if python3 admin/update_blog_news.py > "${CODEX_LOG}" 2>&1; then
  echo "- [x] Feed fetch + selection dry run passed" >> "${REPORT_PATH}"
else
  echo "- [ ] Feed fetch + selection dry run failed" >> "${REPORT_PATH}"
  FAILURES=$((FAILURES + 1))
fi

if rg -q '<h1>Worthy News in the Logistics World</h1>' blog.html; then
  echo "- [x] Blog headline marker present" >> "${REPORT_PATH}"
else
  echo "- [ ] Blog headline marker missing" >> "${REPORT_PATH}"
  FAILURES=$((FAILURES + 1))
fi

FEATURED_COUNT="$(rg -c '<article class="featured-card"' blog.html || true)"
GRID_COUNT="$(rg -c '<article class="blog-card"' blog.html || true)"

if [[ "${FEATURED_COUNT}" -ge 1 && "${GRID_COUNT}" -ge 6 ]]; then
  echo "- [x] Blog card counts healthy (featured=${FEATURED_COUNT}, grid=${GRID_COUNT})" >> "${REPORT_PATH}"
else
  echo "- [ ] Blog card counts low (featured=${FEATURED_COUNT}, grid=${GRID_COUNT})" >> "${REPORT_PATH}"
  FAILURES=$((FAILURES + 1))
fi

TODAY_LABEL="$(python3 - <<'PY'
from datetime import datetime
print(datetime.now().strftime("%B %d, %Y").replace(" 0", " "))
PY
)"

if rg -q "<span id=\"blog-date\">${TODAY_LABEL}</span>" blog.html; then
  echo "- [x] Blog date marker is current (${TODAY_LABEL})" >> "${REPORT_PATH}"
else
  echo "- [ ] Blog date marker not current (${TODAY_LABEL})" >> "${REPORT_PATH}"
  FAILURES=$((FAILURES + 1))
fi

{
  echo
  echo "## Opus lane"
} >> "${REPORT_PATH}"

if python3 -m unittest admin.test_update_blog_news > "${OPUS_LOG}" 2>&1; then
  echo "- [x] Updater unit tests passed" >> "${REPORT_PATH}"
else
  echo "- [ ] Updater unit tests failed" >> "${REPORT_PATH}"
  FAILURES=$((FAILURES + 1))
fi

{
  echo
  echo "## Verdict"
} >> "${REPORT_PATH}"

if [[ "${FAILURES}" -eq 0 ]]; then
  echo "- [x] Foreman watchdog passed with no findings" >> "${REPORT_PATH}"
else
  echo "- [ ] Foreman watchdog found ${FAILURES} issue(s)" >> "${REPORT_PATH}"
fi

echo "Watchdog report: ${REPORT_PATH}"
echo "Codex log: ${CODEX_LOG}"
echo "Opus log: ${OPUS_LOG}"

exit "${FAILURES}"
