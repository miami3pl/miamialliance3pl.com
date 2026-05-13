# DEPLOYMENT STATUS

- State: In progress
- Scope: Miami3PL Firebase deploy plus Symbio restart and queue clear
- Validation: Passed (`./scripts/firebase-doctor.sh`, `firebase use`, PM2 online, queue empty, disk headroom ~40 GiB)
- Git commit: Pending
- Git push: Pending
- Deployment: Pending
- Restart: Pending
- Queue clear: Pending
- Live verification: Pending
- Active runtime note: Fresh Jorge tracing shows the current request is routing through CODEX correctly; the only recurring runtime noise is expired CLI auth/backoff and historical auth-monitor startup errors from an older MCP-50 build.
