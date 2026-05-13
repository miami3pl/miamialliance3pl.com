# Miami3PL Daily Customs Ops SOP

## Purpose

Standardize a once-per-day passive execution cycle for Miami3PL operations and customs monitoring.
Keep delivery professional, efficient, and directly actionable.

## Daily Cadence

1. Execute the task generator once daily:
`python3 scripts/generate_daily_tasklist.py`
2. Reuse the existing tasklist if the script reports an already generated run.
3. Force a rerun only when explicitly requested:
`python3 scripts/generate_daily_tasklist.py --force`
4. For unattended daily automation, schedule:
`scripts/passive_daily_runner.sh`

Example cron line (08:30 ET daily):
`30 8 * * * /bin/bash /absolute/path/to/skills/miami3pl-daily-customs-ops/scripts/passive_daily_runner.sh`

## Professional Tone Standard

- Use short, neutral, operations-first phrasing.
- Avoid speculation and promotional language.
- State owner, due window, and risk level for each task.
- Separate facts from assumptions.

## Priority and Escalation

| Priority | Target Response | Escalation Rule |
| --- | --- | --- |
| CRITICAL | Immediate | Escalate to operations leadership without delay. |
| HIGH | Same business day | Escalate if not acknowledged within 2 hours. |
| MEDIUM | Within 24 hours | Carry over with blocker note if unresolved. |
| LOW | End of week | Batch with process-improvement review. |

## Customs and FTZ Minimum Checks

- Check new customs and sanctions signals from CBP/Federal Register/USTR/FDA/OFAC.
- Review FTZ governance touchpoints relevant to Miami3PL operations.
- Confirm impact path for affected shipments, SKUs, and client commitments.
- Document whether action is required today, this week, or monitor only.

## Completion Protocol

1. Mark done items using `[x]` and append completion timestamp.
2. For blocked tasks, append `BLOCKED:` with cause and owner.
3. End each day with a short unresolved-items section for next-day carryover.
