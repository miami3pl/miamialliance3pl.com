# DEPLOYMENT STATUS

- State: In progress
- Scope: Miami3PL Firebase deploy plus Symbio restart and queue clear
- Validation: Passed (`./scripts/firebase-doctor.sh`, PM2 online, queue empty, fresh Jorge routing to CODEX)
- Git commit: Pending
- Git push: Pending
- Deployment: Pending
- Restart: Pending
- Queue clear: Pending
- Live verification: Pending
- Active runtime note: Fresh `symbio` logs are healthy after the last boot; current active noise is Claude/Gemini auth expiry/backoff in `auth-monitor`, while the `CREDENTIALS_PATH` crash lines are stale from an older pre-restart build.
