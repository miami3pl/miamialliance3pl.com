#!/usr/bin/env bash
set -euo pipefail

SELFHEAL="false"
if [[ "${1:-}" == "--selfheal" ]]; then
  SELFHEAL="true"
fi

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

PROJECT_ID="miamialliance3pl"
if [[ -f .firebaserc ]]; then
  parsed="$(sed -n 's/.*"default"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' .firebaserc | head -n1 || true)"
  if [[ -n "$parsed" ]]; then
    PROJECT_ID="$parsed"
  fi
fi

FAILS=0
WARNS=0

ok() { printf "[OK] %s\n" "$*"; }
warn() { printf "[WARN] %s\n" "$*"; WARNS=$((WARNS+1)); }
fail() { printf "[FAIL] %s\n" "$*"; FAILS=$((FAILS+1)); }

run_or_fail() {
  local desc="$1"
  shift
  if "$@"; then
    ok "$desc"
  else
    fail "$desc"
  fi
}

printf "Firebase Doctor\n"
printf "Project root: %s\n" "$PROJECT_ROOT"
printf "Project id: %s\n\n" "$PROJECT_ID"

# Required files
for f in firebase.json firestore.rules functions/index.js functions/package.json; do
  if [[ -f "$f" ]]; then
    ok "file present: $f"
  else
    fail "file missing: $f"
  fi
done

HAS_MCP="false"
if [[ -f mcp/server.js && -f mcp/package.json ]]; then
  HAS_MCP="true"
  ok "optional MCP app present"
elif [[ -e mcp/server.js || -e mcp/package.json || -d mcp ]]; then
  fail "mcp/ exists but is incomplete (expected mcp/server.js and mcp/package.json)"
else
  warn "optional mcp/ app not present; skipping MCP checks"
fi

# Firebase CLI installation
if command -v firebase >/dev/null 2>&1; then
  ok "firebase CLI present ($(firebase --version 2>/dev/null || echo unknown))"
else
  if [[ "$SELFHEAL" == "true" ]]; then
    warn "firebase CLI missing; installing firebase-tools@15.3.1"
    npm install -g firebase-tools@15.3.1 >/dev/null
    hash -r
    if command -v firebase >/dev/null 2>&1; then
      ok "firebase CLI installed ($(firebase --version 2>/dev/null || echo unknown))"
    else
      fail "firebase CLI install failed"
    fi
  else
    fail "firebase CLI missing (run with --selfheal)"
  fi
fi

# Ensure .firebaserc exists
if [[ ! -f .firebaserc ]]; then
  if [[ "$SELFHEAL" == "true" ]]; then
    warn ".firebaserc missing; creating default mapping"
    cat > .firebaserc <<EOF
{
  "projects": {
    "default": "$PROJECT_ID"
  }
}
EOF
    ok ".firebaserc created"
  else
    fail ".firebaserc missing"
  fi
else
  ok ".firebaserc present"
fi

# Dependencies
if [[ -f functions/package-lock.json ]]; then
  if [[ "$SELFHEAL" == "true" ]]; then
    (cd functions && npm ci >/dev/null)
    ok "functions dependencies installed"
  else
    [[ -d functions/node_modules ]] && ok "functions/node_modules present" || warn "functions/node_modules missing"
  fi
fi

if [[ "$HAS_MCP" == "true" && -f mcp/package-lock.json ]]; then
  if [[ "$SELFHEAL" == "true" ]]; then
    (cd mcp && npm ci >/dev/null)
    ok "mcp dependencies installed"
  else
    [[ -d mcp/node_modules ]] && ok "mcp/node_modules present" || warn "mcp/node_modules missing"
  fi
fi

# Syntax checks
if node --check functions/index.js >/dev/null 2>&1; then
  ok "functions/index.js syntax valid"
else
  fail "functions/index.js syntax invalid"
fi

if [[ "$HAS_MCP" == "true" ]]; then
  if node --check mcp/server.js >/dev/null 2>&1; then
    ok "mcp/server.js syntax valid"
  else
    fail "mcp/server.js syntax invalid"
  fi
fi

# Auth check
AUTH_OK="false"
if command -v firebase >/dev/null 2>&1; then
  login_output="$(firebase login:list 2>&1 || true)"
  if printf "%s" "$login_output" | grep -qi "No authorized accounts"; then
    warn "firebase has no authorized accounts"
  else
    ok "firebase login session present"
    # True auth check requires an API call
    if firebase functions:list --project "$PROJECT_ID" >/tmp/firebase_doctor_functions.$$ 2>&1; then
      ok "firebase API auth works (functions:list)"
      AUTH_OK="true"
    else
      warn "firebase logged-in state exists, but API auth failed (reauth may be required)"
    fi
  fi
fi

# Endpoint checks (public availability)
get_http_code() {
  local name="$1"
  local url="https://us-central1-${PROJECT_ID}.cloudfunctions.net/${name}"
  local code
  code="$(curl -s -o /tmp/firebase_doctor_endpoint.$$ -w '%{http_code}' --max-time 20 "$url" || echo 000)"
  rm -f /tmp/firebase_doctor_endpoint.$$ || true
  printf "%s" "$code"
}

check_endpoint_any_http() {
  local name="$1"
  local code
  code="$(get_http_code "$name")"
  if [[ "$code" =~ ^[0-9]+$ ]] && (( code >= 200 && code <= 499 )); then
    ok "endpoint ${name} reachable (HTTP ${code})"
  else
    fail "endpoint ${name} unreachable (HTTP ${code})"
  fi
}

check_endpoint_not_404() {
  local name="$1"
  local code
  code="$(get_http_code "$name")"
  if [[ "$code" == "404" ]]; then
    fail "endpoint ${name} is NOT deployed (HTTP 404)"
    return
  fi
  if [[ "$code" =~ ^[0-9]+$ ]] && (( code >= 200 && code <= 499 )); then
    ok "endpoint ${name} reachable (HTTP ${code})"
  else
    fail "endpoint ${name} unreachable (HTTP ${code})"
  fi
}

# stripeWebhook typically returns 400 without signature when deployed
check_endpoint_any_http "stripeWebhook"
# These should be deployed and not return 404
check_endpoint_not_404 "portalChatWebhook"
check_endpoint_not_404 "whatsappWebhookEnhanced"

rm -f /tmp/firebase_doctor_login.$$ /tmp/firebase_doctor_functions.$$ 2>/dev/null || true

printf "\nSummary: fails=%d warns=%d\n" "$FAILS" "$WARNS"
if (( FAILS > 0 )); then
  exit 1
fi
exit 0
