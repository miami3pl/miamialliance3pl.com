---
name: miami3pl-daily-customs-ops
description: Run a once-per-day passive Miami3PL operations and customs workflow with professional outputs, SOP discipline, and assigned research-agent tasks. Use for requests to generate a daily tasklist, customs or FTZ monitoring checklist, CBP/Federal Register watch items, or Miami3PL daily briefing execution.
---

# Miami3PL Daily Customs Ops

## Overview

Execute one daily passive cycle for Miami3PL operations intelligence and customs compliance coverage. Keep outputs concise, professional, and scoped to Miami3PL unless the user explicitly asks to expand scope.

## Quick Start

1. Run:
`python3 scripts/generate_daily_tasklist.py`
2. If already generated today, keep passive mode and reuse the existing file.
3. If the user explicitly asks for a rerun, execute:
`python3 scripts/generate_daily_tasklist.py --force`
4. Follow `references/sop.md` for tone, escalation, and completion standards.
5. Follow `references/research-agents.md` for research-agent ownership and task routing.
6. For unattended daily automation, schedule:
`scripts/passive_daily_runner.sh`

## Workflow

1. Determine run mode.
- Default to passive once-per-day behavior (America/New_York calendar day).
- Use `--force` only when the user asks for a refresh.
2. Generate the programmed tasklist artifact.
- Script writes markdown to `outputs/`.
- Script records the run in `.state/last_run.json`.
3. Enforce customs and FTZ coverage.
- Always include CBP, Federal Register, tariff exposure, and FTZ site governance checks.
- Keep tasks practical for Miami3PL operations in Medley, FL.
4. Deliver a professional handoff.
- Use action-first language.
- Include owner, priority, and due window for each task.
- Keep updates short and operational.

## SOP Rules

- Start from the generated tasklist and avoid unnecessary narrative.
- Keep language neutral and professional.
- Escalate critical compliance and safety items immediately.
- Preserve timestamps and completion marks so the list is revisitable.
- Keep scope isolated to Miami3PL unless explicitly instructed otherwise.

## References

- `scripts/generate_daily_tasklist.py`
- `scripts/passive_daily_runner.sh`
- `references/sop.md`
- `references/research-agents.md`
- `../../docs/SOP_DAILY_OPERATIONS.md` for the full operations SOP when a deep dive is needed.
