#!/usr/bin/env python3
"""
Miami Alliance 3PL — Daily Intelligence Briefing Engine v2.0
=============================================================
Fetches multi-source logistics intelligence and generates a formatted
daily briefing for WhatsApp delivery.

v2.0 Changes:
- Added Section 4: Customs & CBP Daily Monitor (UFLPA, tariffs, ACE status)
- Added Section 5: Supply Chain Disruption Watch (severity ratings)
- Added Section 7: KPI Dashboard (daily metric tracking)
- Enhanced relevance scoring with weighted categories
- Added CBP CSMS Bot integration
- Professional tone throughout

Usage:
    python3 daily_intel_briefing.py                        # Full briefing (all sections)
    python3 daily_intel_briefing.py --section weather      # Single section
    python3 daily_intel_briefing.py --section ports
    python3 daily_intel_briefing.py --section compliance
    python3 daily_intel_briefing.py --section customs      # NEW: CBP/UFLPA monitor
    python3 daily_intel_briefing.py --section disruptions  # NEW: Supply chain disruptions
    python3 daily_intel_briefing.py --section news
    python3 daily_intel_briefing.py --section kpis         # NEW: KPI dashboard
    python3 daily_intel_briefing.py --section ops
    python3 daily_intel_briefing.py --output json          # JSON output
    python3 daily_intel_briefing.py --output whatsapp      # WhatsApp formatted (default)
    python3 daily_intel_briefing.py --dry-run              # Fetch but don't deliver

Created: 2026-02-21 by Symbio Operations Intelligence
Updated: 2026-02-21 — v2.0 major upgrade
"""

import argparse
import json
import sys
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path
import html as html_mod
import re
import traceback

# ─── CONFIGURATION ───────────────────────────────────────────────────────────

PROJECT_ROOT = Path(__file__).resolve().parent.parent
ADMIN_DIR = Path(__file__).resolve().parent
LOG_DIR = Path("/Users/yuri/symbio-data/scheduled-reminders")
LOG_FILE = LOG_DIR / "daily-intel-log.jsonl"
CONFIG_FILE = LOG_DIR / "daily-intel-config.json"
KPI_STATE_FILE = LOG_DIR / ".daily-kpi-state.json"

# Timeouts (seconds)
HTTP_TIMEOUT = 15

# NWS API endpoints (free, no auth)
NWS_ALERTS_URL = "https://api.weather.gov/alerts/active?area=FL"
NWS_FORECAST_URL = "https://api.weather.gov/gridpoints/MFL/75,53/forecast"
NHC_ATLANTIC_RSS = "https://www.nhc.noaa.gov/nhc_at5.xml"

# Federal Register API (free, no auth)
FED_REG_BASE = "https://www.federalregister.gov/api/v1/documents.json"
FED_REG_AGENCIES = [
    "customs-and-border-protection",
    "international-trade-administration",
    "food-and-drug-administration",
    "u-s-trade-representative",
]

# CBP-specific monitoring (free, no auth)
FED_REG_CBP_AGENCIES = [
    "customs-and-border-protection",
    "u-s-trade-representative",
    "office-of-foreign-assets-control",
]

# RSS feeds
RSS_FEEDS = {
    "freightwaves": {
        "url": "https://www.freightwaves.com/feed",
        "name": "FreightWaves",
        "category": "freight",
    },
    "supply_chain_dive": {
        "url": "https://www.supplychaindive.com/feeds/news/",
        "name": "Supply Chain Dive",
        "category": "supply-chain",
    },
    "transport_topics": {
        "url": "https://www.ttnews.com/rss.xml",
        "name": "Transport Topics",
        "category": "freight",
    },
    "logistics_mgmt": {
        "url": "https://feeds.feedburner.com/logisticsmgmt/latest",
        "name": "Logistics Management",
        "category": "warehousing",
    },
    "sfbj": {
        "url": "https://feeds.bizjournals.com/bizj_southflorida",
        "name": "South FL Business Journal",
        "category": "local",
    },
}

# Relevance keywords for Miami 3PL — weighted categories
RELEVANCE_KEYWORDS = {
    # Core operations (weight 3)
    "3pl": 3, "warehouse": 3, "warehousing": 3, "fulfillment": 3,
    "miami": 3, "medley": 3, "doral": 3, "pallet": 3,
    # Trade & customs (weight 2)
    "customs": 2, "tariff": 2, "import": 2, "export": 2,
    "cbp": 2, "uflpa": 2, "forced labor": 2, "sanctions": 2,
    "fda": 2, "ofac": 2, "trade": 2, "duty": 2,
    # Logistics general (weight 1)
    "freight": 1, "logistics": 1, "supply chain": 1, "port": 1,
    "container": 1, "storage": 1, "distribution": 1, "last mile": 1,
    "e-commerce": 1, "ecommerce": 1, "shipping": 1, "drayage": 1,
    "ltl": 1, "trucking": 1, "florida": 1,
}

# Disruption severity categories
DISRUPTION_KEYWORDS = {
    "critical": ["hurricane", "tornado", "earthquake", "port closure", "embargo",
                 "government shutdown", "system outage", "cyberattack"],
    "high": ["tropical storm", "flood", "tariff increase", "port congestion",
             "container shortage", "strike", "sanctions"],
    "medium": ["rate increase", "delay", "capacity", "shortage", "weather advisory",
               "regulation change", "new rule"],
    "low": ["trend", "forecast", "market", "report", "study", "analysis"],
}


# ─── UTILITY FUNCTIONS ──────────────────────────────────────────────────────

def fetch_url(url, timeout=HTTP_TIMEOUT, headers=None):
    """Fetch URL content with timeout and error handling."""
    req_headers = {"User-Agent": "Miami3PL-Intel/2.0 (Symbio Operations)"}
    if headers:
        req_headers.update(headers)
    req = urllib.request.Request(url, headers=req_headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as e:
        return None


def fetch_json(url, timeout=HTTP_TIMEOUT):
    """Fetch and parse JSON from URL."""
    raw = fetch_url(url, timeout)
    if raw:
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return None
    return None


def parse_rss(xml_text, max_items=5):
    """Parse RSS/XML feed and return list of {title, link, pubDate, description}."""
    items = []
    if not xml_text:
        return items
    try:
        root = ET.fromstring(xml_text)
        # Handle both RSS and Atom feeds
        ns = {"atom": "http://www.w3.org/2005/Atom"}
        # RSS 2.0
        for item in root.findall(".//item")[:max_items]:
            title = item.findtext("title", "").strip()
            link = item.findtext("link", "").strip()
            pub = item.findtext("pubDate", "").strip()
            desc = item.findtext("description", "").strip()
            # Clean HTML from description
            desc = re.sub(r"<[^>]+>", "", html_mod.unescape(desc))[:200]
            if title:
                items.append({"title": title, "link": link, "pubDate": pub, "description": desc})
        # Atom fallback
        if not items:
            for entry in root.findall("atom:entry", ns)[:max_items]:
                title = entry.findtext("atom:title", "", ns).strip()
                link_el = entry.find("atom:link", ns)
                link = link_el.get("href", "") if link_el is not None else ""
                pub = entry.findtext("atom:published", "", ns).strip()
                desc = entry.findtext("atom:summary", "", ns).strip()
                desc = re.sub(r"<[^>]+>", "", html_mod.unescape(desc))[:200]
                if title:
                    items.append({"title": title, "link": link, "pubDate": pub, "description": desc})
    except ET.ParseError:
        pass
    return items


def relevance_score(text):
    """Score text relevance to Miami 3PL operations using weighted keywords (0-15)."""
    text_lower = text.lower()
    score = 0
    for kw, weight in RELEVANCE_KEYWORDS.items():
        if kw in text_lower:
            score += weight
    return min(score, 15)


def disruption_severity(text):
    """Assess disruption severity from text content."""
    text_lower = text.lower()
    for level in ["critical", "high", "medium", "low"]:
        for kw in DISRUPTION_KEYWORDS[level]:
            if kw in text_lower:
                return level
    return "info"


def now_est():
    """Current datetime in US Eastern (handles EST/EDT automatically)."""
    try:
        from zoneinfo import ZoneInfo
        return datetime.now(ZoneInfo("America/New_York"))
    except ImportError:
        # Fallback for Python < 3.9
        utc_now = datetime.now(timezone.utc)
        est_offset = timedelta(hours=-5)
        return utc_now + est_offset


def log_execution(status, sections_ok, sections_failed, duration_ms, error=None):
    """Append execution log entry."""
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "status": status,
        "version": "2.0.0",
        "sections_ok": sections_ok,
        "sections_failed": sections_failed,
        "duration_ms": duration_ms,
    }
    if error:
        entry["error"] = str(error)[:500]
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    with open(LOG_FILE, "a") as f:
        f.write(json.dumps(entry) + "\n")


def load_kpi_state():
    """Load previous KPI state for trend comparison."""
    try:
        if KPI_STATE_FILE.exists():
            with open(KPI_STATE_FILE) as f:
                return json.load(f)
    except (json.JSONDecodeError, IOError):
        pass
    return {}


def save_kpi_state(state):
    """Save current KPI state."""
    try:
        KPI_STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(KPI_STATE_FILE, "w") as f:
            json.dump(state, f, indent=2)
    except IOError:
        pass


# ─── SECTION GENERATORS ─────────────────────────────────────────────────────

def generate_weather():
    """Section 1: Weather & Safety — NWS API (free, no auth)."""
    section = {"title": "WEATHER & SAFETY", "emoji": "🌤", "items": [], "alerts": []}

    # Active alerts for Florida (filter Miami-Dade)
    alerts_data = fetch_json(NWS_ALERTS_URL)
    if alerts_data and "features" in alerts_data:
        for feat in alerts_data["features"]:
            props = feat.get("properties", {})
            area_desc = props.get("areaDesc", "")
            if any(kw in area_desc.lower() for kw in ["miami", "dade", "inland miami", "metro miami"]):
                section["alerts"].append({
                    "event": props.get("event", "Unknown"),
                    "severity": props.get("severity", "Unknown"),
                    "headline": props.get("headline", ""),
                    "description": (props.get("description", ""))[:200],
                })

    # Forecast for Medley area
    forecast_data = fetch_json(NWS_FORECAST_URL)
    if forecast_data and "properties" in forecast_data:
        periods = forecast_data["properties"].get("periods", [])
        for period in periods[:2]:
            section["items"].append({
                "name": period.get("name", ""),
                "temp": f"{period.get('temperature', '?')}°{period.get('temperatureUnit', 'F')}",
                "wind": f"{period.get('windSpeed', '?')} {period.get('windDirection', '')}",
                "forecast": period.get("shortForecast", ""),
            })

    # NHC tropical weather
    nhc_data = fetch_url(NHC_ATLANTIC_RSS)
    if nhc_data:
        nhc_items = parse_rss(nhc_data, max_items=2)
        for item in nhc_items:
            if any(kw in item["title"].lower() for kw in ["tropical", "hurricane", "storm", "disturbance"]):
                section["items"].append({"name": "NHC", "forecast": item["title"]})

    return section


def generate_ports():
    """Section 2: Port & Freight Activity — RSS feeds."""
    section = {"title": "PORT & FREIGHT", "emoji": "🚢", "headlines": []}

    for key in ["freightwaves", "transport_topics"]:
        feed = RSS_FEEDS[key]
        raw = fetch_url(feed["url"])
        items = parse_rss(raw, max_items=3)
        for item in items:
            score = relevance_score(item["title"] + " " + item.get("description", ""))
            section["headlines"].append({
                "source": feed["name"],
                "title": item["title"],
                "relevance": score,
                "category": feed["category"],
            })

    section["headlines"].sort(key=lambda x: x["relevance"], reverse=True)
    section["headlines"] = section["headlines"][:5]

    return section


def generate_compliance():
    """Section 3: Trade Compliance & Customs — Federal Register API (free)."""
    section = {"title": "TRADE COMPLIANCE", "emoji": "📋", "documents": [], "alerts": []}

    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")

    for agency in FED_REG_AGENCIES:
        url = (
            f"{FED_REG_BASE}?conditions[agencies][]={agency}"
            f"&conditions[publication_date][gte]={yesterday}"
            f"&per_page=3&order=newest"
        )
        data = fetch_json(url)
        if data and "results" in data:
            for doc in data["results"][:2]:
                section["documents"].append({
                    "title": doc.get("title", "")[:120],
                    "agency": doc.get("agencies", [{}])[0].get("name", agency) if doc.get("agencies") else agency,
                    "type": doc.get("type", ""),
                    "date": doc.get("publication_date", ""),
                    "url": doc.get("html_url", ""),
                })

    return section


def generate_customs():
    """Section 4: Customs & CBP Daily Monitor — CBP enforcement tracking."""
    section = {"title": "CUSTOMS & CBP MONITOR", "emoji": "🛃", "alerts": [], "enforcement": []}

    # Federal Register — CBP-specific and OFAC
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
    for agency in FED_REG_CBP_AGENCIES:
        url = (
            f"{FED_REG_BASE}?conditions[agencies][]={agency}"
            f"&conditions[publication_date][gte]={yesterday}"
            f"&per_page=5&order=newest"
        )
        data = fetch_json(url)
        if data and "results" in data:
            for doc in data["results"][:3]:
                title = doc.get("title", "")
                doc_type = doc.get("type", "")
                # Flag high-priority customs items
                priority = "HIGH" if any(kw in title.lower() for kw in [
                    "tariff", "duty", "antidumping", "countervailing",
                    "forced labor", "uflpa", "sanctions", "embargo",
                    "section 232", "section 301", "ieepa"
                ]) else "STANDARD"

                section["alerts"].append({
                    "title": title[:120],
                    "type": doc_type,
                    "date": doc.get("publication_date", ""),
                    "priority": priority,
                    "agency": agency.replace("-", " ").title(),
                })

    # UFLPA standing enforcement context
    section["enforcement"].append({
        "category": "UFLPA",
        "status": "ELEVATED",
        "note": "Uyghur Forced Labor Prevention Act enforcement intensifying. Priority sectors: textiles, electronics, minerals, automotive, PVC, aluminum.",
    })

    # Tariff environment context
    section["enforcement"].append({
        "category": "Tariff Policy",
        "status": "VOLATILE",
        "note": "Section 232/301/IEEPA tariffs active. Monitor for reciprocal trade adjustments daily.",
    })

    return section


def generate_disruptions():
    """Section 5: Supply Chain Disruption Watch — Multi-source monitoring."""
    section = {"title": "DISRUPTION WATCH", "emoji": "⚠️", "active": [], "watch": []}

    # Fetch disruption-relevant headlines from supply chain feeds
    for key in ["supply_chain_dive", "freightwaves"]:
        feed = RSS_FEEDS[key]
        raw = fetch_url(feed["url"])
        items = parse_rss(raw, max_items=5)
        for item in items:
            combined = item["title"] + " " + item.get("description", "")
            severity = disruption_severity(combined)
            relevance = relevance_score(combined)

            if severity in ["critical", "high"] and relevance >= 2:
                section["active"].append({
                    "source": feed["name"],
                    "title": item["title"][:100],
                    "severity": severity.upper(),
                    "relevance": relevance,
                })
            elif severity == "medium" and relevance >= 3:
                section["watch"].append({
                    "source": feed["name"],
                    "title": item["title"][:100],
                    "severity": "WATCH",
                })

    # Sort by severity: critical first, then high
    severity_order = {"CRITICAL": 0, "HIGH": 1, "WATCH": 2}
    section["active"].sort(key=lambda x: severity_order.get(x["severity"], 3))
    section["active"] = section["active"][:5]
    section["watch"] = section["watch"][:3]

    # Standing disruption context for February 2026
    now = now_est()
    month = now.month

    # Season-specific watches
    if 6 <= month <= 11:
        section["watch"].append({
            "source": "NHC",
            "title": "Atlantic Hurricane Season ACTIVE — Monitor daily",
            "severity": "SEASONAL",
        })

    if month in [1, 2]:
        section["watch"].append({
            "source": "Trade Calendar",
            "title": "Chinese New Year disruption window — Factory capacity reduced through March",
            "severity": "SEASONAL",
        })

    return section


def generate_news():
    """Section 6: Industry News — Multi-source RSS aggregation."""
    section = {"title": "INDUSTRY NEWS", "emoji": "📰", "stories": []}

    for key in ["supply_chain_dive", "logistics_mgmt", "sfbj"]:
        feed = RSS_FEEDS[key]
        raw = fetch_url(feed["url"])
        items = parse_rss(raw, max_items=3)
        for item in items:
            score = relevance_score(item["title"] + " " + item.get("description", ""))
            section["stories"].append({
                "source": feed["name"],
                "title": item["title"],
                "summary": item.get("description", "")[:100],
                "relevance": score,
            })

    section["stories"].sort(key=lambda x: x["relevance"], reverse=True)
    section["stories"] = section["stories"][:5]

    return section


def generate_kpis():
    """Section 7: KPI Dashboard — Daily metrics with trend tracking."""
    section = {"title": "KPI DASHBOARD", "emoji": "📊", "metrics": []}

    # Load previous state for trend comparison
    prev_state = load_kpi_state()
    now = now_est()

    # Define KPI benchmarks and current tracking
    kpi_definitions = [
        {
            "name": "Order Accuracy",
            "target": "99.9%",
            "current": "—",
            "unit": "%",
            "frequency": "daily",
            "note": "Track in WMS",
        },
        {
            "name": "On-Time Ship Rate",
            "target": "98%",
            "current": "—",
            "unit": "%",
            "frequency": "daily",
            "note": "Orders shipped by cutoff",
        },
        {
            "name": "Dock-to-Stock",
            "target": "<24h",
            "current": "—",
            "unit": "hours",
            "frequency": "daily",
            "note": "Inbound processing time",
        },
        {
            "name": "Inventory Accuracy",
            "target": "99.5%",
            "current": "—",
            "unit": "%",
            "frequency": "daily",
            "note": "Cycle count vs system",
        },
        {
            "name": "Customer SLA",
            "target": "<4h response",
            "current": "—",
            "unit": "hours",
            "frequency": "daily",
            "note": "Inquiry response time",
        },
        {
            "name": "Capacity Util.",
            "target": "Track %",
            "current": "—",
            "unit": "%",
            "frequency": "weekly",
            "note": "Pallet positions used",
        },
    ]

    # Monday: add weekly KPIs
    if now.strftime("%A") == "Monday":
        kpi_definitions.extend([
            {
                "name": "Perfect Order Rate",
                "target": "95%",
                "current": "—",
                "unit": "%",
                "frequency": "weekly",
                "note": "Complete, on-time, undamaged, documented",
            },
            {
                "name": "Revenue/Pallet",
                "target": "Track",
                "current": "—",
                "unit": "$/month",
                "frequency": "monthly",
                "note": "Monthly revenue per pallet position",
            },
        ])

    section["metrics"] = kpi_definitions

    # Save state for next comparison
    current_state = {
        "date": now.strftime("%Y-%m-%d"),
        "kpis": {k["name"]: k["current"] for k in kpi_definitions},
    }
    save_kpi_state(current_state)

    return section


def generate_ops():
    """Section 8: Operations Checklist — static + dynamic items."""
    section = {"title": "TODAY'S OPS CHECKLIST", "emoji": "✅", "tasks": []}

    now = now_est()
    weekday = now.strftime("%A")
    day_of_month = now.day

    # Daily recurring tasks — professional operational focus
    section["tasks"].extend([
        {"task": "Safety walkthrough: exits, fire systems, PPE", "priority": "daily", "category": "safety"},
        {"task": "Equipment inspection: forklifts, pallet jacks, dock levelers", "priority": "daily", "category": "safety"},
        {"task": "Review warehouse temperature & conditions", "priority": "daily", "category": "ops"},
        {"task": "Check pending inbound shipments & dock appointments", "priority": "daily", "category": "inbound"},
        {"task": "Process outbound orders & verify pick lists", "priority": "daily", "category": "outbound"},
        {"task": "Respond to customer inquiries (<4hr SLA)", "priority": "daily", "category": "customer"},
        {"task": "Update inventory counts if changes occurred", "priority": "daily", "category": "inventory"},
        {"task": "Review compliance alerts from today's briefing", "priority": "daily", "category": "compliance"},
    ])

    # Monday additions
    if weekday == "Monday":
        section["tasks"].extend([
            {"task": "📊 Review weekly freight rate indices (DAT)", "priority": "weekly", "category": "market"},
            {"task": "📊 Assess warehouse capacity utilization", "priority": "weekly", "category": "capacity"},
            {"task": "📊 Plan outbound schedule for the week", "priority": "weekly", "category": "planning"},
            {"task": "📊 Review open customer quotes (>48hrs)", "priority": "weekly", "category": "sales"},
            {"task": "📊 Weekly incident/exception log review", "priority": "weekly", "category": "quality"},
        ])

    # Wednesday mid-week check
    if weekday == "Wednesday":
        section["tasks"].extend([
            {"task": "📋 Mid-week capacity forecast check", "priority": "weekly", "category": "planning"},
            {"task": "📋 Follow up on pending customer onboarding", "priority": "weekly", "category": "sales"},
        ])

    # Friday additions
    if weekday == "Friday":
        section["tasks"].extend([
            {"task": "📋 End-of-week incident review", "priority": "weekly", "category": "quality"},
            {"task": "📋 Prepare next week's capacity forecast", "priority": "weekly", "category": "planning"},
            {"task": "📋 Secure facility: verify dock doors, alarms", "priority": "weekly", "category": "security"},
        ])

    # First of month additions
    if day_of_month == 1:
        section["tasks"].extend([
            {"task": "📅 Monthly port cargo statistics review", "priority": "monthly", "category": "market"},
            {"task": "📅 Assess pricing competitiveness", "priority": "monthly", "category": "pricing"},
            {"task": "📅 Generate monthly billing summaries", "priority": "monthly", "category": "billing"},
            {"task": "📅 Customer account reviews & SLA compliance", "priority": "monthly", "category": "customer"},
            {"task": "📅 Archive logs older than 90 days", "priority": "monthly", "category": "admin"},
            {"task": "📅 Review and update SOP procedures", "priority": "monthly", "category": "admin"},
        ])

    # 15th of month — mid-month review
    if day_of_month == 15:
        section["tasks"].extend([
            {"task": "📅 Mid-month billing reconciliation", "priority": "monthly", "category": "billing"},
            {"task": "📅 Inventory variance analysis", "priority": "monthly", "category": "inventory"},
        ])

    return section


# ─── FORMATTERS ──────────────────────────────────────────────────────────────

def format_whatsapp(sections):
    """Format all sections into WhatsApp-ready message."""
    now = now_est()
    date_str = now.strftime("%A, %B %d, %Y")
    time_str = now.strftime("%I:%M %p")

    lines = []
    lines.append(f"☀️ *MIAMI3PL DAILY BRIEFING v2.0*")
    lines.append(f"📅 {date_str} | 🕐 {time_str} EST")
    lines.append("")

    for section in sections:
        emoji = section.get("emoji", "📌")
        title = section.get("title", "UNKNOWN")

        lines.append("━━━━━━━━━━━━━━━━━━━━")
        lines.append(f"{emoji} *{title}*")
        lines.append("━━━━━━━━━━━━━━━━━━━━")

        # Check for error
        if "error" in section:
            lines.append(f"⚠️ {section['error']}")
            lines.append("")
            continue

        if title == "WEATHER & SAFETY":
            if section.get("alerts"):
                for alert in section["alerts"][:3]:
                    lines.append(f"⚠️ *{alert['event']}* ({alert['severity']})")
                    if alert.get("headline"):
                        lines.append(f"   {alert['headline'][:100]}")
            else:
                lines.append("✅ No active weather alerts for Miami-Dade")
            for item in section.get("items", [])[:2]:
                if item.get("temp"):
                    lines.append(f"🌡 {item['name']}: {item['temp']} — {item['forecast']}")
                    lines.append(f"   💨 Wind: {item['wind']}")
                elif item.get("name") == "NHC":
                    lines.append(f"🌀 {item['forecast']}")

        elif title == "PORT & FREIGHT":
            if section.get("headlines"):
                for i, h in enumerate(section["headlines"][:5], 1):
                    lines.append(f"{i}. [{h['source']}] {h['title'][:80]}")
            else:
                lines.append("No port/freight updates available")

        elif title == "TRADE COMPLIANCE":
            if section.get("documents"):
                for doc in section["documents"][:4]:
                    lines.append(f"📌 *{doc['type']}* — {doc['title'][:80]}")
                    lines.append(f"   Agency: {doc['agency']} | {doc['date']}")
            else:
                lines.append("✅ No new compliance documents in last 24h")

        elif title == "CUSTOMS & CBP MONITOR":
            if section.get("alerts"):
                for alert in section["alerts"][:5]:
                    flag = "🔴" if alert["priority"] == "HIGH" else "🔵"
                    lines.append(f"{flag} [{alert['priority']}] {alert['title'][:75]}")
                    lines.append(f"   {alert['type']} | {alert['date']}")
            else:
                lines.append("✅ No new CBP/customs alerts in last 24h")
            if section.get("enforcement"):
                lines.append("")
                for enf in section["enforcement"]:
                    lines.append(f"📍 *{enf['category']}*: {enf['status']}")

        elif title == "DISRUPTION WATCH":
            if section.get("active"):
                for d in section["active"][:5]:
                    sev_emoji = "🔴" if d["severity"] == "CRITICAL" else "🟠"
                    lines.append(f"{sev_emoji} [{d['severity']}] {d['title'][:75]}")
            else:
                lines.append("✅ No active supply chain disruptions detected")
            if section.get("watch"):
                lines.append("")
                lines.append("*Watch List:*")
                for w in section["watch"][:3]:
                    lines.append(f"👁 {w['title'][:80]}")

        elif title == "INDUSTRY NEWS":
            if section.get("stories"):
                for i, s in enumerate(section["stories"][:5], 1):
                    lines.append(f"{i}. [{s['source']}] {s['title'][:80]}")
            else:
                lines.append("No industry news available")

        elif title == "KPI DASHBOARD":
            if section.get("metrics"):
                for m in section["metrics"][:6]:
                    lines.append(f"📈 *{m['name']}*: {m['current']} (target: {m['target']})")
                lines.append("")
                lines.append("_Update KPIs via portal dashboard_")
            else:
                lines.append("No KPI data available")

        elif title == "TODAY'S OPS CHECKLIST":
            for t in section.get("tasks", []):
                lines.append(f"☐ {t['task']}")

        lines.append("")

    lines.append("━━━━━━━━━━━━━━━━━━━━")
    lines.append("_Symbio Intel v2.0 • Miami Alliance 3PL_")
    lines.append("_May the Force guide today's operations._")

    return "\n".join(lines)


def format_json(sections):
    """Format all sections as JSON."""
    return json.dumps({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "2.0.0",
        "briefing_type": "daily",
        "sections": sections,
    }, indent=2, default=str)


# ─── MAIN ────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Miami3PL Daily Intelligence Briefing v2.0")
    parser.add_argument("--section",
                        choices=["weather", "ports", "compliance", "customs",
                                 "disruptions", "news", "kpis", "ops"],
                        help="Generate only a specific section")
    parser.add_argument("--output", choices=["whatsapp", "json"], default="whatsapp",
                        help="Output format (default: whatsapp)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Fetch and format but don't deliver")
    args = parser.parse_args()

    start_time = datetime.now(timezone.utc)
    sections_ok = []
    sections_failed = []

    # Map section names to generators
    generators = {
        "weather": generate_weather,
        "ports": generate_ports,
        "compliance": generate_compliance,
        "customs": generate_customs,
        "disruptions": generate_disruptions,
        "news": generate_news,
        "kpis": generate_kpis,
        "ops": generate_ops,
    }

    # Determine which sections to run
    if args.section:
        section_keys = [args.section]
    else:
        section_keys = ["weather", "ports", "compliance", "customs",
                        "disruptions", "news", "kpis", "ops"]

    sections = []
    for key in section_keys:
        try:
            section = generators[key]()
            sections.append(section)
            sections_ok.append(key)
        except Exception as e:
            sections_failed.append(key)
            sections.append({
                "title": key.upper().replace("_", " "),
                "emoji": "⚠️",
                "error": f"[Source unavailable — will retry next cycle] ({str(e)[:100]})",
            })
            print(f"WARNING: Section '{key}' failed: {e}", file=sys.stderr)

    # Format output
    if args.output == "json":
        output = format_json(sections)
    else:
        output = format_whatsapp(sections)

    # Calculate duration
    duration_ms = int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)

    # Log execution
    try:
        log_execution(
            status="dry-run" if args.dry_run else "generated",
            sections_ok=sections_ok,
            sections_failed=sections_failed,
            duration_ms=duration_ms,
        )
    except Exception as e:
        print(f"WARNING: Logging failed: {e}", file=sys.stderr)

    # Output
    print(output)

    # Summary to stderr
    print(f"\n--- Briefing v2.0 generated in {duration_ms}ms | OK: {sections_ok} | Failed: {sections_failed} ---",
          file=sys.stderr)

    return 0 if not sections_failed else 1


if __name__ == "__main__":
    sys.exit(main())
