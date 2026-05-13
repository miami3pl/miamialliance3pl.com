#!/usr/bin/env python3
"""
Generate a once-per-day passive Miami3PL daily tasklist with customs focus.
"""

from __future__ import annotations

import argparse
import json
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

try:
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover
    ZoneInfo = None  # type: ignore[assignment]


DEFAULT_TIMEZONE = "America/New_York"
SKILL_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_STATE_FILE = SKILL_ROOT / ".state" / "last_run.json"
DEFAULT_OUTPUT_DIR = SKILL_ROOT / "outputs"

BASE_TASKS = [
    {
        "priority": "HIGH",
        "owner": "Ops Coordinator",
        "due_et": "09:00",
        "task": "Review overnight exceptions, delayed loads, and client escalations.",
    },
    {
        "priority": "HIGH",
        "owner": "Customs Signal Agent",
        "due_et": "09:30",
        "task": "Scan last 24h CBP/USTR/Commerce/FDA/OFAC updates for operational impact.",
    },
    {
        "priority": "HIGH",
        "owner": "FTZ Governance Agent",
        "due_et": "10:00",
        "task": "Check FTZ 32/281 notices and CBP Part 146 process changes for Miami3PL relevance.",
    },
    {
        "priority": "HIGH",
        "owner": "Port and Carrier Agent",
        "due_et": "10:15",
        "task": "Review PortMiami and Port Everglades disruptions affecting inbound schedules.",
    },
    {
        "priority": "MEDIUM",
        "owner": "Tariff Impact Agent",
        "due_et": "11:00",
        "task": "Assess duty and tariff exposure for active import SKUs in transit.",
    },
    {
        "priority": "MEDIUM",
        "owner": "Client Communications Agent",
        "due_et": "12:00",
        "task": "Send concise risk updates for shipments at compliance or delay risk.",
    },
    {
        "priority": "MEDIUM",
        "owner": "Ops Coordinator",
        "due_et": "17:00",
        "task": "Capture unresolved items and compliance notes for end-of-day handoff.",
    },
]

MONDAY_TASKS = [
    {
        "priority": "MEDIUM",
        "owner": "Port and Carrier Agent",
        "due_et": "14:00",
        "task": "Publish weekly freight and capacity snapshot for South Florida lanes.",
    },
    {
        "priority": "MEDIUM",
        "owner": "Ops Coordinator",
        "due_et": "15:00",
        "task": "Review warehouse utilization and update weekly outbound allocation plan.",
    },
]

MONTH_START_TASKS = [
    {
        "priority": "MEDIUM",
        "owner": "FTZ Governance Agent",
        "due_et": "13:00",
        "task": "Prepare month-start FTZ/CBP compliance review and pending filing list.",
    },
    {
        "priority": "MEDIUM",
        "owner": "Tariff Impact Agent",
        "due_et": "16:00",
        "task": "Refresh monthly duty impact assumptions for top import accounts.",
    },
]

RESEARCH_AGENT_MATRIX = [
    {
        "agent": "Customs Signal Agent",
        "scope": "CBP, Federal Register, FDA, OFAC",
        "deliverable": "24h compliance delta summary",
        "sla": "By 09:30 ET",
    },
    {
        "agent": "FTZ Governance Agent",
        "scope": "FTZ 32, FTZ 281, 19 CFR Part 146",
        "deliverable": "Site governance and filing watch",
        "sla": "By 10:00 ET",
    },
    {
        "agent": "Port and Carrier Agent",
        "scope": "PortMiami, Port Everglades, ocean/road disruptions",
        "deliverable": "Inbound risk and reroute recommendations",
        "sla": "By 10:15 ET",
    },
    {
        "agent": "Tariff Impact Agent",
        "scope": "Section 301/232 and duty-rate changes",
        "deliverable": "SKU exposure list and cost flags",
        "sla": "By 11:00 ET",
    },
    {
        "agent": "Client Communications Agent",
        "scope": "At-risk customer shipments",
        "deliverable": "Client-ready update lines",
        "sla": "By 12:00 ET",
    },
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate Miami3PL daily passive customs and operations tasklist.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Generate a new tasklist even if one was already generated today.",
    )
    parser.add_argument(
        "--date",
        dest="date_override",
        help="Run date in YYYY-MM-DD format. Defaults to today's date in timezone.",
    )
    parser.add_argument(
        "--timezone",
        default=DEFAULT_TIMEZONE,
        help=f"IANA timezone (default: {DEFAULT_TIMEZONE}).",
    )
    parser.add_argument(
        "--state-file",
        default=str(DEFAULT_STATE_FILE),
        help=f"Path to run-state file (default: {DEFAULT_STATE_FILE}).",
    )
    parser.add_argument(
        "--output-dir",
        default=str(DEFAULT_OUTPUT_DIR),
        help=f"Directory for generated tasklists (default: {DEFAULT_OUTPUT_DIR}).",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Emit machine-readable JSON to stdout.",
    )
    return parser.parse_args()


def resolve_run_date(timezone_name: str, date_override: str | None) -> date:
    if date_override:
        try:
            return date.fromisoformat(date_override)
        except ValueError as exc:
            raise SystemExit(f"Invalid --date value '{date_override}': {exc}") from exc

    if ZoneInfo is None:
        return datetime.now(timezone.utc).date()

    try:
        return datetime.now(ZoneInfo(timezone_name)).date()
    except Exception as exc:  # pragma: no cover
        raise SystemExit(f"Invalid timezone '{timezone_name}': {exc}") from exc


def read_state(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError:
        return {}


def write_state(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2))


def build_task_records(run_date: date) -> list[dict[str, str]]:
    records: list[dict[str, str]] = [dict(task) for task in BASE_TASKS]
    if run_date.weekday() == 0:
        records.extend(dict(task) for task in MONDAY_TASKS)
    if run_date.day == 1:
        records.extend(dict(task) for task in MONTH_START_TASKS)
    return records


def to_markdown(
    run_date: date,
    run_ts_utc: str,
    timezone_name: str,
    tasks: list[dict[str, str]],
) -> str:
    lines = [
        f"# Miami3PL Daily Passive Customs Ops Tasklist - {run_date.isoformat()}",
        "",
        f"Generated (UTC): {run_ts_utc}",
        f"Operating timezone: {timezone_name}",
        "",
        f"TODO LIST ({run_ts_utc})",
        "",
    ]

    for task in tasks:
        lines.append(
            f"- [ ] [PENDING] [{task['priority']}] [{task['owner']}] {task['task']} "
            f"(Due {task['due_et']} ET)"
        )

    lines.extend(
        [
            "",
            "## Research Agent Matrix",
            "",
            "| Agent | Scope | Deliverable | SLA |",
            "| --- | --- | --- | --- |",
        ]
    )

    for row in RESEARCH_AGENT_MATRIX:
        lines.append(
            f"| {row['agent']} | {row['scope']} | {row['deliverable']} | {row['sla']} |"
        )

    lines.extend(
        [
            "",
            "## SOP Completion Standard",
            "",
            "- Escalate critical customs or safety risks immediately.",
            "- Keep handoff notes concise and professional.",
            "- Carry unresolved tasks into the next day with owner and blocker noted.",
        ]
    )
    return "\n".join(lines) + "\n"


def emit(result: dict[str, Any], as_json: bool) -> None:
    if as_json:
        print(json.dumps(result, indent=2))
        return

    if result["status"] == "already_ran":
        print(
            "PASSIVE: Tasklist already generated for "
            f"{result['run_date']} at {result.get('last_run_at_utc', 'unknown')}."
        )
        print(f"Reusing: {result.get('output_file', 'unknown')}")
        return

    print(f"Generated: {result['output_file']}")
    print(f"Run date: {result['run_date']}")


def main() -> None:
    args = parse_args()
    run_date = resolve_run_date(args.timezone, args.date_override)
    run_date_str = run_date.isoformat()
    state_file = Path(args.state_file).expanduser().resolve()
    output_dir = Path(args.output_dir).expanduser().resolve()
    state = read_state(state_file)

    if (
        not args.force
        and state.get("last_run_date") == run_date_str
        and state.get("last_output_file")
    ):
        emit(
            {
                "status": "already_ran",
                "run_date": run_date_str,
                "last_run_at_utc": state.get("last_run_at_utc"),
                "output_file": state.get("last_output_file"),
            },
            args.json,
        )
        return

    run_ts_utc = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    tasks = build_task_records(run_date)
    body = to_markdown(run_date, run_ts_utc, args.timezone, tasks)

    output_dir.mkdir(parents=True, exist_ok=True)
    output_file = output_dir / f"daily-tasklist-{run_date_str}.md"
    output_file.write_text(body)

    write_state(
        state_file,
        {
            "last_run_date": run_date_str,
            "last_run_at_utc": run_ts_utc,
            "last_output_file": str(output_file),
            "timezone": args.timezone,
        },
    )

    emit(
        {
            "status": "generated",
            "run_date": run_date_str,
            "output_file": str(output_file),
            "task_count": len(tasks),
        },
        args.json,
    )


if __name__ == "__main__":
    main()
