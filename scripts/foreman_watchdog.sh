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

# The blog's headline is translated (data-i18n), so match the stable attribute, not the text.
if grep -qE '<h1[^>]*data-i18n="blog.title"' blog.html; then
  echo "- [x] Blog headline marker present" >> "${REPORT_PATH}"
else
  echo "- [ ] Blog headline marker missing" >> "${REPORT_PATH}"
  FAILURES=$((FAILURES + 1))
fi

FEATURED_COUNT="$(grep -cF '<article class="featured-card"' blog.html || true)"
GRID_COUNT="$(grep -cF '<article class="blog-card"' blog.html || true)"

if [[ "${FEATURED_COUNT}" -ge 1 && "${GRID_COUNT}" -ge 6 ]]; then
  echo "- [x] Blog card counts healthy (featured=${FEATURED_COUNT}, grid=${GRID_COUNT})" >> "${REPORT_PATH}"
else
  echo "- [ ] Blog card counts low (featured=${FEATURED_COUNT}, grid=${GRID_COUNT})" >> "${REPORT_PATH}"
  FAILURES=$((FAILURES + 1))
fi

# The blog is rebuilt once a day (~13:50 UTC, "Daily Logistics News Update"), so the date shown is current
# when it is today or yesterday in UTC. The span carries a style attribute: read its text, not the exact tag.
DATE_LABELS="$(python3 - <<'PY'
from datetime import datetime, timedelta, timezone
now = datetime.now(timezone.utc)
for d in (now, now - timedelta(days=1)):
    print(d.strftime("%B %d, %Y").replace(" 0", " "))
PY
)"
BLOG_DATE="$(grep -oE '<span id="blog-date"[^>]*>[^<]*</span>' blog.html | sed -E 's/<[^>]*>//g' | head -n 1 || true)"

if [[ -n "${BLOG_DATE}" ]] && grep -qxF "${BLOG_DATE}" <<< "${DATE_LABELS}"; then
  echo "- [x] Blog date marker is current (${BLOG_DATE})" >> "${REPORT_PATH}"
else
  echo "- [ ] Blog date marker not current (${BLOG_DATE:-missing}; expected today or yesterday, UTC)" >> "${REPORT_PATH}"
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
