# Miami3PL Research Agents

## Agent Roster

| Agent | Domain | Primary Output | Cadence |
| --- | --- | --- | --- |
| Customs Signal Agent | CBP, Federal Register, FDA, OFAC | Compliance change summary + impact tags | Daily |
| FTZ Governance Agent | FTZ 32, FTZ 281, 19 CFR Part 146 | FTZ/activation governance watch | Daily |
| Port and Carrier Agent | PortMiami, Port Everglades, carrier disruptions | Inbound and routing risk digest | Daily |
| Tariff Impact Agent | Section 301/232 and duty rates | SKU duty exposure list | Daily |
| Client Communications Agent | Customer shipments at risk | Client-ready update lines | Daily |

## Programmed Tasklist Mapping

| Task Type | Default Owner | Expected Artifact | Due Window |
| --- | --- | --- | --- |
| Compliance delta scan | Customs Signal Agent | 24h delta summary | 09:30 ET |
| FTZ governance check | FTZ Governance Agent | FTZ note with required actions | 10:00 ET |
| Port disruption review | Port and Carrier Agent | Delay/reroute flags | 10:15 ET |
| Duty exposure check | Tariff Impact Agent | SKU risk and cost note | 11:00 ET |
| Client updates | Client Communications Agent | Approved outbound update lines | 12:00 ET |

## Deployment Protocol

1. Start from the generated daily tasklist and assign each task to one owner.
2. Require each agent output to contain:
- Source checked
- Time checked
- Operational impact
- Required next action
3. Use explicit risk labels: `critical`, `high`, `medium`, `monitor`.
4. Escalate `critical` and `high` customs findings immediately.

## Quality Gates

- No task without owner.
- No risk label without a next action.
- No carryover without blocker reason and next checkpoint.
