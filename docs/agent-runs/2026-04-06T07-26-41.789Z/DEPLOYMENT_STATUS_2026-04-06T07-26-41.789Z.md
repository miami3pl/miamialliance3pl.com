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
- Active runtime note: `auth-monitor` is online but currently reports expired Claude/Gemini/Codex auth state and previous startup errors in its own repo; treat only post-restart recurrences as blockers for this run.
