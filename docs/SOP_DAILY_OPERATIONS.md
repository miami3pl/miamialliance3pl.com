# Miami Alliance 3PL — Standard Operating Procedure

## Daily Operations Intelligence & Task Management

**Document ID:** SOP-M3PL-001
**Version:** 2.0.0
**Effective Date:** February 21, 2026
**Author:** Symbio Operations Intelligence
**Classification:** INTERNAL — Miami Alliance 3PL Operations Team

---

## 1. PURPOSE

This SOP establishes the standard daily operations intelligence workflow for Miami Alliance 3PL. It defines the automated daily briefing process, research agent deployment, task management protocols, customs compliance monitoring, KPI tracking, supply chain disruption response, and escalation procedures to ensure efficient warehouse operations at 8780 NW 100th ST, Medley, FL 33178.

---

## 2. SCOPE

**Applies to:**

- Daily warehouse operations management
- Logistics coordination and freight monitoring
- Trade compliance monitoring (customs, tariffs, FDA/USDA, UFLPA)
- Customs brokerage daily monitoring and CBP enforcement tracking
- Supply chain disruption detection and response
- KPI tracking and performance benchmarking
- Customer communications and follow-ups
- Weather and safety preparedness
- Port activity monitoring (PortMiami, Port Everglades, MIA Cargo)

**Does not apply to:**

- Blue Macaw / USG LATAM operations (separate SOP)
- Endor Properties construction management
- Legal/litigation operations

---

## 3. DEFINITIONS

| Term                    | Definition                                                                      |
| ----------------------- | ------------------------------------------------------------------------------- |
| **Daily Briefing**      | Automated intelligence report generated at 08:30 EST and delivered via WhatsApp |
| **Research Agent**      | Automated data collection module targeting a specific intelligence domain       |
| **Intel Source**        | Public data feed (RSS, API, web) providing logistics/trade intelligence         |
| **Ops Checklist**       | Daily actionable task list derived from system state and calendar               |
| **Compliance Alert**    | Federal Register, CBP, FDA, or OFAC update requiring review                     |
| **Capacity Check**      | Warehouse utilization assessment against total available pallet positions       |
| **CSMS**                | CBP Cargo Systems Messaging Service — system alerts and trade notices           |
| **UFLPA**               | Uyghur Forced Labor Prevention Act — forced labor compliance requirement        |
| **ACE**                 | Automated Commercial Environment — CBP electronic trade processing system       |
| **Disruption Severity** | Rating (Critical/High/Medium/Low) assigned to supply chain disruption events    |
| **KPI**                 | Key Performance Indicator — measurable operational performance metric           |
| **Perfect Order**       | Order delivered complete, on-time, undamaged, and with correct documentation    |
| **Dock-to-Stock**       | Elapsed time from cargo arrival at dock to inventory system registration        |

---

## 4. DAILY SCHEDULE

| Time (EST)     | Activity                                    | Automation Level    | Owner          |
| -------------- | ------------------------------------------- | ------------------- | -------------- |
| 08:30          | Daily Briefing auto-generated and delivered | Fully automated     | Symbio         |
| 08:30–09:00    | Jorge reviews briefing, flags priorities    | Manual review       | Jorge          |
| 09:00          | Morning ops begin — execute checklist items | Manual execution    | Jorge          |
| 09:00          | Safety walkthrough and equipment inspection | Manual              | Jorge          |
| 10:00          | Compliance alert review (if flagged items)  | Semi-automated      | Jorge + Symbio |
| 12:00          | Midday status check — disruption monitoring | Semi-automated      | Symbio         |
| 15:00          | Customer inquiry SLA compliance check       | Automated flag      | Symbio         |
| 17:00          | End-of-day status capture and KPI logging   | Automated log       | Symbio         |
| Weekly (Mon)   | Freight rate index + capacity utilization   | Automated fetch     | Symbio         |
| Weekly (Wed)   | Mid-week capacity and onboarding check      | Manual + auto       | Jorge          |
| Weekly (Fri)   | Incident review + next week forecast        | Manual + auto       | Jorge          |
| Monthly (1st)  | Port statistics + billing + pricing review  | Manual + auto-fetch | Jorge + Symbio |
| Monthly (15th) | Mid-month billing reconciliation            | Manual              | Jorge          |

---

## 5. DAILY BRIEFING PROCEDURE

### 5.1 Automated Generation

The daily briefing runs at 08:30 EST via cron trigger:

```
Trigger: cron → send-daily-intel.sh → daily_intel_briefing.py → WhatsApp delivery
```

### 5.2 Briefing Sections (8 Sections — In Order)

**Section 1: Weather & Safety (CRITICAL)**

- Source: NWS API (api.weather.gov) — no authentication required
- Checks: Active weather alerts for FL zone FLZ172 (Miami-Dade)
- Checks: 24-hour forecast for Medley area
- Checks: NHC tropical weather (hurricane season Jun 1 – Nov 30)
- Action Required If: Severe weather warning, tropical storm watch/warning, flood alert
- Escalation: If Category 1+ hurricane within 72hrs → immediate notification to Jorge + Yuri

**Section 2: Port & Freight Activity (HIGH)**

- Source: FreightWaves RSS, Transport Topics RSS, PortMiami dock report
- Monitors: Vessel arrivals at PortMiami, freight rate trends, capacity indicators
- Weekly Enhancement: DAT Trendlines national van/reefer/flatbed spot rates (Monday)
- Action Required If: Major port disruption, rate spike > 10% week-over-week

**Section 3: Trade Compliance & Customs (HIGH)**

- Source: Federal Register API (free JSON), FDA Import Alerts, OFAC updates
- Monitors: New CBP rules, tariff changes (Section 232/301), FDA detention alerts, sanctions
- Filters: Only agencies relevant to freight/warehousing (CBP, USTR, Commerce, FDA)
- Action Required If: New tariff action affecting warehouse inventory categories, new FDA DWPE alert

**Section 4: Customs & CBP Daily Monitor (HIGH) — v2.0**

- Source: Federal Register (CBP, USTR, OFAC specific), CBP CSMS Bot
- Monitors:
  - ACE system status and maintenance windows
  - New tariff actions (Section 232, 301, IEEPA)
  - UFLPA enforcement trends and detention statistics
  - Antidumping/countervailing duty orders
  - Entry filing requirements changes
  - OFAC sanctions list updates
- Priority Flagging:
  - HIGH: Tariff changes, UFLPA actions, sanctions, antidumping orders
  - STANDARD: General notices, procedural updates
- Standing Enforcement Context: UFLPA elevated enforcement, tariff policy volatility
- Action Required If: New tariff affecting warehouse goods, UFLPA detention of similar products, ACE outage

**Section 5: Supply Chain Disruption Watch (HIGH) — v2.0**

- Source: Supply Chain Dive, FreightWaves, NHC, CBP appropriations alerts
- Severity Rating System:
  - CRITICAL: Hurricane, port closure, embargo, system outage, cyberattack
  - HIGH: Tropical storm, tariff increase, container shortage, strike, sanctions
  - MEDIUM: Rate increase, capacity constraint, regulation change
  - LOW: Market trend, forecast, industry analysis
- Seasonal Monitoring:
  - Jun-Nov: Atlantic Hurricane Season active watch
  - Jan-Feb: Chinese New Year factory disruption window
  - Year-round: Tariff volatility, cyber threats, government funding
- Action Required If: Critical/High severity disruption detected — activate contingency plan

**Section 6: Industry News (MEDIUM)**

- Source: Supply Chain Dive RSS, Logistics Management RSS, South FL Business Journal
- Delivers: Top 5 headlines with 1-line summaries and relevance tags
- Tags: freight, ports, warehousing, 3pl, e-commerce, technology, supply-chain
- Action Required If: News directly affects Miami3PL operations or competitive landscape

**Section 7: KPI Dashboard (STANDARD) — v2.0**

- Source: Internal operational data (Firestore), manual input tracking
- Daily KPIs Tracked:

| KPI                    | Target     | How to Measure                          |
| ---------------------- | ---------- | --------------------------------------- |
| Order Picking Accuracy | 99.9%      | Correct picks / total picks             |
| On-Time Shipping Rate  | 98%+       | Orders shipped by cutoff / total orders |
| Dock-to-Stock Time     | < 24 hours | Arrival timestamp to system entry       |
| Inventory Accuracy     | 99.5%+     | Cycle count match / total counted       |
| Customer Response SLA  | < 4 hours  | Inquiry to first response elapsed time  |
| Capacity Utilization   | Track %    | Occupied pallets / total positions      |

- Weekly KPIs (Monday):

| KPI                | Target | How to Measure                                  |
| ------------------ | ------ | ----------------------------------------------- |
| Perfect Order Rate | 95%+   | Complete + on-time + undamaged + documented     |
| Revenue per Pallet | Track  | Monthly revenue / average pallet positions used |

- Trend Tracking: Each KPI compared against previous day/week for trend indicator

**Section 8: Operations Checklist (STANDARD)**

- Generated from: Calendar reminders, Firestore pending items, recurring tasks
- Includes: Pending shipments, overdue invoices, customer follow-ups, capacity check
- Day-Specific Items:
  - Monday: Freight rates, capacity utilization, weekly plan, quote review
  - Wednesday: Mid-week capacity check, customer onboarding follow-up
  - Friday: Incident review, next week forecast, facility security check
  - 1st of Month: Port stats, pricing review, billing summaries, account reviews, SOP review
  - 15th of Month: Mid-month billing reconciliation, inventory variance analysis
- Format: Checkbox list for tracking throughout the day

### 5.3 Delivery Format

Briefing delivered as formatted WhatsApp message:

- Headers with emoji identifiers per section
- Bold key data points
- Severity flags (🔴 CRITICAL, 🟠 HIGH, 🔵 STANDARD)
- Concise — entire briefing structured for quick scanning
- Professional tone with minimal Star Wars accent

### 5.4 Failure Handling

If any intel source fails during generation:

- Skip the failed source
- Note "[Source unavailable — will retry next cycle]" in that section
- Log the failure to `daily-intel-log.jsonl` with error details
- Continue generating remaining sections
- Never block the entire briefing for one source failure
- Maximum 90-second total generation time

---

## 6. RESEARCH AGENT SPECIFICATIONS

### 6.1 Agent Architecture

Eight parallel agents execute simultaneously:

| Agent            | Domain              | Primary Source             | Timeout | Fallback                     |
| ---------------- | ------------------- | -------------------------- | ------- | ---------------------------- |
| Weather Agent    | Weather & Safety    | api.weather.gov (JSON)     | 15s     | "Check weather.gov manually" |
| Port Agent       | Port & Freight      | RSS feeds (4 sources)      | 20s     | Cached last-known data       |
| Compliance Agent | Trade/Customs       | federalregister.gov API    | 20s     | "Check FR manually"          |
| Customs Agent    | CBP/UFLPA Monitor   | FR API + CSMS Bot          | 20s     | Standing enforcement context |
| Disruption Agent | Supply Chain Risks  | RSS feeds + NHC + CBP      | 20s     | Seasonal watch items only    |
| News Agent       | Industry News       | RSS feeds (4 sources)      | 20s     | Cached last-known headlines  |
| KPI Agent        | Performance Metrics | Firestore + state file     | 10s     | Benchmark targets only       |
| Ops Agent        | Operations          | Local Firestore + calendar | 10s     | Static checklist template    |

### 6.2 Data Freshness Requirements

| Data Type          | Max Staleness | Refresh Frequency    |
| ------------------ | ------------- | -------------------- |
| Weather alerts     | 30 minutes    | Every briefing cycle |
| Port activity      | 24 hours      | Daily                |
| Compliance updates | 24 hours      | Daily                |
| CBP enforcement    | 24 hours      | Daily                |
| Disruption alerts  | 4 hours       | Daily + mid-day      |
| Freight rates      | 7 days        | Weekly (Monday)      |
| Industry news      | 24 hours      | Daily                |
| KPI metrics        | 24 hours      | Daily (manual input) |
| Operations data    | Real-time     | Every briefing cycle |

### 6.3 Source Priority Matrix

**Priority 1 — Always fetch fresh:**

- NWS weather alerts
- Federal Register new documents (CBP, FDA, USTR, OFAC)
- CBP CSMS alerts
- Active disruption feeds

**Priority 2 — Daily refresh acceptable:**

- RSS news feeds
- Port dock reports
- OFAC updates
- Industry headlines

**Priority 3 — Weekly/monthly is fine:**

- DAT freight rate indices
- Port cargo statistics
- BTS freight indicators
- UFLPA detention statistics

---

## 7. CUSTOMS COMPLIANCE PROCEDURE

### 7.1 Daily Customs Monitoring

**Mandatory Daily Activities:**

| Activity               | Requirement                                                   | Source              |
| ---------------------- | ------------------------------------------------------------- | ------------------- |
| CSMS Alert Review      | Check CBP Cargo Systems Messaging Service for system updates  | csmsbot.com         |
| Federal Register Check | Review CBP, USTR, OFAC notices published in last 24h          | federalregister.gov |
| ACE System Status      | Verify ACE is operational before filing entries               | CBP.gov             |
| UFLPA Compliance Check | Verify no inventory in priority sectors flagged for detention | CBP UFLPA stats     |
| Tariff Change Monitor  | Track Section 232/301/IEEPA tariff modifications              | Federal Register    |

### 7.2 UFLPA Compliance Requirements

The Uyghur Forced Labor Prevention Act enforcement is intensifying in 2026. Key requirements:

- **Rebuttable Presumption:** All goods from Xinjiang are presumed to be made with forced labor unless proven otherwise
- **Priority Sectors (2026):** Textiles, electronics, minerals (lithium, copper), automotive, PVC, aluminum, steel
- **Documentation Required:** Full supply chain traceability documentation for any goods with exposure to priority sectors
- **Detention Stats:** 6,636+ shipments detained in first half of 2025 — trend is accelerating
- **Action:** For any warehouse client importing goods from affected sectors, maintain complete supply chain documentation

### 7.3 Tariff Environment (2026)

Current active tariff programs requiring daily monitoring:

| Program       | Status       | Impact                                            |
| ------------- | ------------ | ------------------------------------------------- |
| Section 232   | Active       | Steel, aluminum, semiconductors under review      |
| Section 301   | Active       | China tariffs, annual review cycle                |
| IEEPA Tariffs | Volatile     | 10% global import tax (post Supreme Court ruling) |
| Reciprocal    | Evolving     | Country-specific adjustments (India, Indonesia)   |
| USMCA         | Under Review | Six-year review launched 2026                     |

### 7.4 Record Retention

- **Minimum Retention:** 5 years for all customs records
- **Digital Backup:** All entry documentation backed up to secure storage
- **Audit Trail:** Maintain log of all compliance checks performed

---

## 8. SUPPLY CHAIN DISRUPTION RESPONSE

### 8.1 Severity Response Matrix

| Severity | Response Time | Actions Required                                              |
| -------- | ------------- | ------------------------------------------------------------- |
| CRITICAL | Immediate     | Notify Jorge + Yuri, activate contingency plan, brief clients |
| HIGH     | Same day      | Assess impact, notify affected clients, adjust operations     |
| MEDIUM   | 24-48 hours   | Monitor situation, prepare contingency if escalates           |
| LOW      | End of week   | Log for awareness, include in weekly review                   |

### 8.2 Contingency Plan Elements

For CRITICAL/HIGH disruptions:

1. **Client Communication:** Proactive notification within 2 hours of detection
2. **Inventory Protection:** Secure warehouse, adjust receiving/shipping schedules
3. **Alternative Routing:** Identify alternate freight lanes and carriers
4. **Financial Impact:** Estimate cost impact and document for insurance/claims
5. **Recovery Timeline:** Establish expected resolution timeline and update daily

### 8.3 Seasonal Disruption Calendar

| Period     | Risk                                   | Preparation                             |
| ---------- | -------------------------------------- | --------------------------------------- |
| Jan-Feb    | Chinese New Year (6-8 week disruption) | Pre-position inventory, alert clients   |
| Jun-Nov    | Atlantic Hurricane Season              | Emergency protocols, backup plans ready |
| Oct-Nov    | Peak shipping season congestion        | Capacity planning, carrier pre-booking  |
| Dec-Jan    | Holiday surge + factory closures       | Overtime scheduling, temp labor plans   |
| Year-round | Tariff policy changes                  | Daily Federal Register monitoring       |
| Year-round | Cyber threats to logistics infra       | Security protocols, backup systems      |

---

## 9. KPI MANAGEMENT PROCEDURE

### 9.1 Daily KPI Collection

At end of each business day (17:00 EST):

1. Log order accuracy from WMS/manual tracking
2. Record on-time shipping percentage
3. Calculate dock-to-stock time for today's inbound
4. Note inventory discrepancies from cycle counts
5. Review customer inquiry response times
6. Update capacity utilization count

### 9.2 KPI Review Cadence

| Frequency | KPIs Reviewed                                           | Action                               |
| --------- | ------------------------------------------------------- | ------------------------------------ |
| Daily     | Order accuracy, on-time ship, dock-to-stock, SLA        | Immediate correction if below target |
| Weekly    | Perfect order rate, capacity utilization, incident rate | Process improvement if trending down |
| Monthly   | Revenue per pallet, client SLA compliance, safety rate  | Strategic review with Yuri           |

### 9.3 KPI Benchmarks (Industry Standard)

| KPI                    | Good   | Excellent | Best-in-Class |
| ---------------------- | ------ | --------- | ------------- |
| Order Picking Accuracy | 99.0%  | 99.5%     | 99.9%         |
| On-Time Shipping       | 95%    | 98%       | 99.5%         |
| Dock-to-Stock          | 48 hrs | 24 hrs    | 2 hrs         |
| Inventory Accuracy     | 97%    | 99%       | 99.5%+        |
| Perfect Order Rate     | 90%    | 95%       | 98%+          |

---

## 10. TASK MANAGEMENT PROTOCOL

### 10.1 Daily Checklist Items (Recurring)

**Every Day:**

- [ ] Review daily briefing (08:30)
- [ ] Safety walkthrough: exits, fire systems, PPE compliance
- [ ] Equipment inspection: forklifts, pallet jacks, dock levelers
- [ ] Check warehouse temperature and conditions
- [ ] Review pending inbound shipments and dock appointments
- [ ] Process outbound orders and verify pick lists
- [ ] Update inventory counts if changes occurred
- [ ] Respond to customer inquiries within 4 business hours
- [ ] Review compliance alerts from today's briefing
- [ ] Log any incidents or exceptions

**Every Monday:**

- [ ] Review weekly freight rate indices (DAT)
- [ ] Assess warehouse capacity utilization
- [ ] Plan week's outbound schedule
- [ ] Review any open customer quotes (> 48hrs)
- [ ] Weekly incident/exception log review

**Every Wednesday:**

- [ ] Mid-week capacity forecast check
- [ ] Follow up on pending customer onboarding

**Every Friday:**

- [ ] End-of-week incident review
- [ ] Prepare next week's capacity forecast
- [ ] Secure facility: verify dock doors, alarms, security

**Every 1st of Month:**

- [ ] Review monthly port cargo statistics
- [ ] Assess pricing competitiveness
- [ ] Generate monthly billing summaries
- [ ] Customer account reviews and SLA compliance
- [ ] Archive logs older than 90 days
- [ ] Review and update SOP procedures

**Every 15th of Month:**

- [ ] Mid-month billing reconciliation
- [ ] Inventory variance analysis

### 10.2 Priority Classification

| Priority | Response Time | Examples                                                       |
| -------- | ------------- | -------------------------------------------------------------- |
| CRITICAL | Immediate     | Weather emergency, compliance violation, security incident     |
| HIGH     | Same day      | Customer delivery issue, new compliance rule, port disruption  |
| MEDIUM   | 24–48 hours   | Rate quote follow-up, inventory discrepancy, new customer lead |
| LOW      | End of week   | Market trend review, SOP update, process improvement           |

### 10.3 Escalation Matrix

| Issue                   | First Response       | Escalation To                    | Timeframe  |
| ----------------------- | -------------------- | -------------------------------- | ---------- |
| Weather emergency       | Symbio alert → Jorge | Jorge → Yuri                     | Immediate  |
| Compliance violation    | Symbio flag → Jorge  | Jorge → Legal counsel            | Same day   |
| UFLPA detention risk    | Symbio alert → Jorge | Jorge → customs broker           | Same day   |
| Customer complaint      | Jorge                | Jorge → Yuri (if unresolved 24h) | 4 hours    |
| System outage           | Symbio auto-recovery | Symbio → Yuri                    | 30 minutes |
| Pricing dispute         | Jorge                | Jorge → Yuri                     | 24 hours   |
| Supply chain disruption | Symbio alert → Jorge | Jorge → affected clients         | 2 hours    |
| Cyber security incident | Symbio alert → Jorge | Jorge → Yuri + IT security       | Immediate  |

---

## 11. INTELLIGENCE SOURCES REGISTRY

### 11.1 Tier 1 — Automated Daily (Free, Programmatic Access)

| Source               | URL/Endpoint                                  | Method    | Auth | Section      |
| -------------------- | --------------------------------------------- | --------- | ---- | ------------ |
| NWS Weather API      | api.weather.gov/alerts/active?area=FL         | REST JSON | None | Weather      |
| NWS Forecast         | api.weather.gov/gridpoints/MFL/75,53/forecast | REST JSON | None | Weather      |
| Federal Register     | federalregister.gov/api/v1/documents.json     | REST JSON | None | Compliance   |
| FreightWaves         | freightwaves.com/feed                         | RSS/XML   | None | Ports/News   |
| Supply Chain Dive    | supplychaindive.com/feeds/news/               | RSS/XML   | None | News/Disrupt |
| Transport Topics     | ttnews.com/rss.xml                            | RSS/XML   | None | Ports        |
| NHC Tropical Weather | nhc.noaa.gov/nhc_at5.xml                      | RSS/XML   | None | Weather      |
| CBP CSMS Bot         | csmsbot.com                                   | Web       | None | Customs      |

### 11.2 Tier 2 — Automated Weekly

| Source                 | URL/Endpoint                                  | Method     | Auth |
| ---------------------- | --------------------------------------------- | ---------- | ---- |
| DAT Trendlines         | dat.com/trendlines                            | Web scrape | None |
| Flexport Market Update | flexport.com/logistics/freight-market-update/ | Web scrape | None |
| SFBJ                   | feeds.bizjournals.com/bizj_southflorida       | RSS/XML    | None |
| CBP Trade Snapshot     | cbp.gov/trade/snapshot                        | Web        | None |

### 11.3 Tier 3 — Manual/Monthly Review

| Source                | URL                                     | Notes                  |
| --------------------- | --------------------------------------- | ---------------------- |
| PortMiami Dock Report | miamidade.gov/Apps/Seaport/dailydock/   | Manual check or scrape |
| Port Everglades Stats | porteverglades.net/about-us/statistics/ | Monthly PDF download   |
| MIA Cargo Stats       | miami-airport.com/cargo.asp             | Monthly review         |
| OFAC Actions          | ofac.treasury.gov/recent-actions        | Weekly email digest    |
| UFLPA Statistics      | cbp.gov/newsroom/stats/trade/uflpa      | Monthly review         |
| Florida Ports Council | flaports.org/news-updates/              | Weekly check           |

---

## 12. QUALITY STANDARDS

### 12.1 Briefing Quality

- Briefing must be delivered by 08:35 EST (5-minute window)
- All 8 sections must be present (even if source unavailable)
- No speculative information — facts only, sourced
- Professional tone — suitable for forwarding to clients
- Severity flagging must be accurate (no false alarms)

### 12.2 Data Accuracy

- RSS headlines used verbatim (no AI rewriting of source titles)
- Weather data from official NWS only (no third-party weather apps)
- Compliance data from official Federal Register API only
- Freight rates from DAT/Freightos official indices only
- Customs alerts from CBP/Federal Register only
- Disruption severity ratings must match defined criteria

### 12.3 Logging & Audit

All briefing executions logged to JSONL format:

```json
{
  "timestamp": "2026-02-21T13:30:00Z",
  "status": "delivered",
  "version": "2.0.0",
  "sections_ok": [
    "weather",
    "ports",
    "compliance",
    "customs",
    "disruptions",
    "news",
    "kpis",
    "ops"
  ],
  "sections_failed": [],
  "delivery": "whatsapp",
  "duration_ms": 4200
}
```

---

## 13. MAINTENANCE

### 13.1 Weekly Review

- Check `daily-intel-log.jsonl` for persistent failures
- Verify RSS feed URLs still active
- Confirm Federal Register API endpoint unchanged
- Review disruption severity calibration

### 13.2 Monthly Review

- Update source registry if new relevant sources identified
- Review and refine relevance scoring weights
- Archive logs older than 90 days
- Review KPI benchmarks against industry updates
- Update UFLPA priority sector list

### 13.3 Quarterly Review

- Full SOP review and update
- Assess if new intelligence categories needed
- Review competitive landscape sources
- Update tariff environment summary
- Calibrate disruption severity thresholds

---

## 14. FILES & INFRASTRUCTURE

| File                                                                                    | Purpose                     |
| --------------------------------------------------------------------------------------- | --------------------------- |
| `/Users/yuri/.claude/commands/commands/miami3pl-daily.md`                               | Skill definition (v2.0)     |
| `/Users/yuri/Dropbox/mcp-servers/MCP-51-miami3pl/project/admin/daily_intel_briefing.py` | Python intel engine (v2.0)  |
| `/Users/yuri/symbio-data/scheduled-reminders/send-daily-intel.sh`                       | Cron trigger script         |
| `/Users/yuri/symbio-data/scheduled-reminders/daily-intel-config.json`                   | Config & source registry    |
| `/Users/yuri/symbio-data/scheduled-reminders/daily-intel-log.jsonl`                     | Execution logs              |
| `/Users/yuri/symbio-data/scheduled-reminders/.daily-intel-state`                        | Run count & state           |
| `/Users/yuri/symbio-data/scheduled-reminders/.daily-kpi-state.json`                     | KPI state for trends (v2.0) |
| `/Users/yuri/Dropbox/mcp-servers/MCP-51-miami3pl/project/docs/SOP_DAILY_OPERATIONS.md`  | This SOP document           |

---

## 15. REVISION HISTORY

| Version | Date       | Author | Changes                                                                                                                                                                                       |
| ------- | ---------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.0.0   | 2026-02-21 | Symbio | Major upgrade: Added Customs & CBP Monitor, Disruption Watch, KPI Dashboard. 8 research agents. Professional SOP with UFLPA procedures, tariff tracking, KPI benchmarks, disruption response. |
| 1.0.0   | 2026-02-21 | Symbio | Initial SOP creation (5 sections, 5 agents)                                                                                                                                                   |

---

_Document maintained by Symbio Operations Intelligence for Miami Alliance 3PL._
_Standard Operating Procedure — Internal Use Only._
_Version 2.0.0 — May the Force guide our operations._
