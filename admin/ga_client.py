#!/usr/bin/env python3
"""
Miami3PL Google Analytics 4 Data Client
========================================
Pulls GA4 data using Firebase service account (OAuth2 — no API keys).

Auth: Uses existing Firebase service account from miamialliance3pl project.
The service account must have Viewer+ role in GA4 Admin > Property Access.

Usage:
  python3 ga_client.py setup          # Check prerequisites & discover property
  python3 ga_client.py overview [N]   # Last N days overview (default 30)
  python3 ga_client.py today          # Today's stats
  python3 ga_client.py realtime       # Real-time active users
  python3 ga_client.py visitors [N]   # Daily visitors for last N days (default 30)
  python3 ga_client.py pages [N]      # Top N pages (default 20)
  python3 ga_client.py sources [N]    # Top N traffic sources (default 20)
  python3 ga_client.py events [N]     # Top N events (default 20)
  python3 ga_client.py countries [N]  # Top N countries (default 20)
  python3 ga_client.py devices        # Device breakdown
  python3 ga_client.py compare [N]    # Compare last N days vs previous N days
  python3 ga_client.py report [days]  # Full report for last N days (default 30)
  python3 ga_client.py json [cmd]     # Output as JSON (for Symbio parsing)
"""

import sys
import json
from datetime import datetime
from pathlib import Path

# ══════════════════════════════════════════════════════════
# CONFIGURATION
# ══════════════════════════════════════════════════════════

SERVICE_ACCOUNT_PATH = Path(__file__).parent.parent.parent / "firebase-key.json"
PROPERTY_CACHE = Path(__file__).parent / ".ga_property_id"
GA4_MEASUREMENT_ID = "G-KTW0F25ZM1"
# Max age for cached property ID before re-validation (seconds)
CACHE_MAX_AGE = 86400  # 24 hours

# ══════════════════════════════════════════════════════════
# SINGLETONS — avoid redundant auth + client creation
# ══════════════════════════════════════════════════════════

_credentials = None
_data_client = None
_admin_client = None
_property_id = None  # in-memory cache for session


def get_credentials():
    """Load service account credentials with GA4 scopes (cached)."""
    global _credentials
    if _credentials is not None:
        return _credentials

    from google.oauth2 import service_account

    if not SERVICE_ACCOUNT_PATH.exists():
        print(f"ERROR: Service account not found at {SERVICE_ACCOUNT_PATH}")
        print("Download from Firebase Console > Project Settings > Service Accounts")
        sys.exit(1)

    _credentials = service_account.Credentials.from_service_account_file(
        str(SERVICE_ACCOUNT_PATH),
        scopes=[
            "https://www.googleapis.com/auth/analytics.readonly",
            "https://www.googleapis.com/auth/analytics",
        ],
    )
    return _credentials


def get_data_client():
    """GA4 Data API client (cached singleton)."""
    global _data_client
    if _data_client is not None:
        return _data_client

    from google.analytics.data_v1beta import BetaAnalyticsDataClient

    _data_client = BetaAnalyticsDataClient(credentials=get_credentials())
    return _data_client


def get_admin_client():
    """GA4 Admin API client (cached singleton)."""
    global _admin_client
    if _admin_client is not None:
        return _admin_client

    from google.analytics.admin_v1alpha import AnalyticsAdminServiceClient

    _admin_client = AnalyticsAdminServiceClient(credentials=get_credentials())
    return _admin_client


def get_sa_email():
    """Read the service account email from the key file."""
    sa_data = json.loads(SERVICE_ACCOUNT_PATH.read_text())
    return sa_data.get("client_email", "unknown")


# ══════════════════════════════════════════════════════════
# PROPERTY ID MANAGEMENT — smart cache + auto-recovery
# ══════════════════════════════════════════════════════════

def validate_property_id(prop_id):
    """Validate a property ID works with the Data API.
    Returns True if valid, False if permission denied / not found."""
    from google.analytics.data_v1beta.types import RunReportRequest, DateRange, Metric

    try:
        get_data_client().run_report(RunReportRequest(
            property=f"properties/{prop_id}",
            date_ranges=[DateRange(start_date="1daysAgo", end_date="today")],
            metrics=[Metric(name="activeUsers")],
            limit=1,
        ))
        return True
    except Exception as e:
        err = str(e)
        if "403" in err or "PERMISSION_DENIED" in err or "NOT_FOUND" in err:
            return False
        return True  # network errors etc — don't invalidate


def cache_is_fresh():
    """Check if the property ID cache file is recent enough to skip validation."""
    if not PROPERTY_CACHE.exists():
        return False
    import time
    age = time.time() - PROPERTY_CACHE.stat().st_mtime
    return age < CACHE_MAX_AGE


def discover_property_id():
    """Use GA Admin API to find the GA4 property for our measurement ID."""
    from google.analytics.admin_v1alpha.types import ListPropertiesRequest

    client = get_admin_client()

    try:
        accounts = list(client.list_accounts())
        if not accounts:
            print(f"ERROR: No GA4 accounts accessible. Add as Viewer: {get_sa_email()}")
            return None

        for account in accounts:
            account_id = account.name.split("/")[-1]
            properties = list(client.list_properties(
                request=ListPropertiesRequest(filter=f"parent:accounts/{account_id}")
            ))
            for prop in properties:
                prop_id = prop.name.split("/")[-1]
                try:
                    streams = list(client.list_data_streams(parent=prop.name))
                    for stream in streams:
                        if hasattr(stream, "web_stream_data") and stream.web_stream_data:
                            if stream.web_stream_data.measurement_id == GA4_MEASUREMENT_ID:
                                PROPERTY_CACHE.write_text(prop_id)
                                return prop_id
                except Exception:
                    continue  # skip properties we can't read streams for

        print(f"ERROR: No property found with measurement ID {GA4_MEASUREMENT_ID}")
        print("Available properties:")
        for account in accounts:
            account_id = account.name.split("/")[-1]
            for prop in client.list_properties(
                request=ListPropertiesRequest(filter=f"parent:accounts/{account_id}")
            ):
                print(f"  {prop.name} — {prop.display_name}")
        return None

    except Exception as e:
        err = str(e)
        if "403" in err or "PERMISSION_DENIED" in err:
            print(f"ERROR: Permission denied. Add service account as Viewer: {get_sa_email()}")
        elif "404" in err or "NOT_FOUND" in err:
            print("ERROR: Analytics Admin API not enabled.")
            print("  https://console.cloud.google.com/apis/library/analyticsadmin.googleapis.com?project=miamialliance3pl")
        else:
            print(f"ERROR: {e}")
        return None


def discover_property_id_exhaustive():
    """Brute-force: try every property across all accounts until one validates."""
    from google.analytics.admin_v1alpha.types import ListPropertiesRequest

    client = get_admin_client()
    try:
        for account in client.list_accounts():
            account_id = account.name.split("/")[-1]
            for prop in client.list_properties(
                request=ListPropertiesRequest(filter=f"parent:accounts/{account_id}")
            ):
                prop_id = prop.name.split("/")[-1]
                if validate_property_id(prop_id):
                    print(f"[OK] Found working property: {prop.display_name} (ID: {prop_id})")
                    PROPERTY_CACHE.write_text(prop_id)
                    return prop_id
    except Exception as e:
        print(f"ERROR in exhaustive discovery: {e}")
    return None


def get_property_id():
    """Get GA4 property ID — smart cache with validation + auto-recovery.

    Strategy:
    - If cache is fresh (<24h) and in-memory cache set: return immediately (zero API calls)
    - If cache exists but stale: validate against Data API, re-discover if bad
    - If no cache: discover via Admin API, validate, cache
    """
    global _property_id

    # Fast path: already validated this session
    if _property_id is not None:
        return _property_id

    # Check on-disk cache
    if PROPERTY_CACHE.exists():
        cached_id = PROPERTY_CACHE.read_text().strip()
        if cached_id:
            if cache_is_fresh():
                # Trust fresh cache — skip validation API call
                _property_id = cached_id
                return cached_id
            # Stale cache — validate
            if validate_property_id(cached_id):
                # Touch the file to refresh mtime
                PROPERTY_CACHE.write_text(cached_id)
                _property_id = cached_id
                return cached_id
            else:
                print(f"[WARN] Cached property ID {cached_id} is stale — re-discovering...")
                PROPERTY_CACHE.unlink()

    # Discover from scratch
    prop_id = discover_property_id()
    if prop_id:
        if validate_property_id(prop_id):
            _property_id = prop_id
            return prop_id
        else:
            print(f"[WARN] Discovered property {prop_id} failed validation — trying all properties...")
            prop_id = discover_property_id_exhaustive()
            if prop_id:
                _property_id = prop_id
                return prop_id

    print("\nManual fix: echo 'PROPERTY_ID' >", PROPERTY_CACHE)
    sys.exit(1)


# ══════════════════════════════════════════════════════════
# FORMATTERS
# ══════════════════════════════════════════════════════════

def fmt_num(n):
    """Format number with commas."""
    try:
        return f"{int(n):,}"
    except (ValueError, TypeError):
        return str(n)


def fmt_dur(seconds):
    """Format seconds as human-readable duration."""
    try:
        s = int(float(seconds))
        if s < 60:
            return f"{s}s"
        m, s = divmod(s, 60)
        if m < 60:
            return f"{m}m {s}s"
        h, m = divmod(m, 60)
        return f"{h}h {m}m"
    except (ValueError, TypeError):
        return str(seconds)


def fmt_pct(value):
    """Format as percentage."""
    try:
        return f"{float(value):.1f}%"
    except (ValueError, TypeError):
        return str(value)


def fmt_delta(current, previous):
    """Format a change indicator: +12.5% or -3.2%"""
    try:
        c, p = float(current), float(previous)
        if p == 0:
            return "+NEW" if c > 0 else "—"
        change = ((c - p) / p) * 100
        arrow = "+" if change >= 0 else ""
        return f"{arrow}{change:.1f}%"
    except (ValueError, TypeError, ZeroDivisionError):
        return "—"


def safe_int(val):
    """Safely convert to int, return 0 on failure."""
    try:
        return int(val)
    except (ValueError, TypeError):
        return 0


def safe_float(val):
    """Safely convert to float, return 0.0 on failure."""
    try:
        return float(val)
    except (ValueError, TypeError):
        return 0.0


def parse_int_arg(args, default):
    """Parse first argument as int with error handling."""
    if not args:
        return default
    try:
        return int(args[0])
    except ValueError:
        print(f"[WARN] Invalid number '{args[0]}', using default {default}")
        return default


# ══════════════════════════════════════════════════════════
# DATA QUERIES
# ══════════════════════════════════════════════════════════

def run_report(property_id, start, end, dimensions, metrics, limit=20, order_by_metric=None):
    """Generic GA4 report runner with auto-recovery on stale property ID."""
    from google.analytics.data_v1beta.types import (
        RunReportRequest, DateRange, Dimension, Metric, OrderBy
    )

    order_bys = []
    if order_by_metric:
        order_bys = [OrderBy(
            metric=OrderBy.MetricOrderBy(metric_name=order_by_metric),
            desc=True,
        )]

    request = RunReportRequest(
        property=f"properties/{property_id}",
        date_ranges=[DateRange(start_date=start, end_date=end)],
        dimensions=[Dimension(name=d) for d in dimensions],
        metrics=[Metric(name=m) for m in metrics],
        limit=limit,
        order_bys=order_bys or None,
    )

    try:
        return get_data_client().run_report(request)
    except Exception as e:
        err = str(e)
        if "403" in err or "PERMISSION_DENIED" in err:
            new_id = _auto_recover(property_id)
            if new_id:
                request.property = f"properties/{new_id}"
                try:
                    return get_data_client().run_report(request)
                except Exception:
                    pass
            print("ERROR: Permission denied for GA4 Data API.")
            print(f"  1. Enable API: https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com?project=miamialliance3pl")
            print(f"  2. Add Viewer role: {get_sa_email()}")
        else:
            print(f"ERROR: {e}")
        sys.exit(1)


def run_realtime(property_id):
    """Run realtime report with auto-recovery."""
    from google.analytics.data_v1beta.types import (
        RunRealtimeReportRequest, Dimension, Metric
    )

    request = RunRealtimeReportRequest(
        property=f"properties/{property_id}",
        dimensions=[Dimension(name="unifiedScreenName")],
        metrics=[Metric(name="activeUsers")],
    )

    try:
        return get_data_client().run_realtime_report(request)
    except Exception as e:
        err = str(e)
        if "403" in err or "PERMISSION_DENIED" in err:
            new_id = _auto_recover(property_id)
            if new_id:
                request.property = f"properties/{new_id}"
                try:
                    return get_data_client().run_realtime_report(request)
                except Exception:
                    pass
            print("ERROR: Permission denied for realtime API.")
            print(f"  https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com?project=miamialliance3pl")
        else:
            print(f"ERROR: {e}")
        sys.exit(1)


def _auto_recover(bad_property_id):
    """Attempt to recover from a stale property ID. Returns new ID or None."""
    global _property_id
    if PROPERTY_CACHE.exists():
        print(f"[WARN] Permission denied for property {bad_property_id} — auto-recovering...")
        PROPERTY_CACHE.unlink()
        _property_id = None
        new_id = discover_property_id()
        if new_id and new_id != bad_property_id:
            print(f"[OK] Switched to property {new_id}")
            _property_id = new_id
            return new_id
    return None


# ══════════════════════════════════════════════════════════
# COMMANDS
# ══════════════════════════════════════════════════════════

def cmd_setup():
    """Check prerequisites and discover property."""
    print("=" * 60)
    print("  MIAMI 3PL — GOOGLE ANALYTICS SETUP CHECK")
    print("=" * 60)

    if SERVICE_ACCOUNT_PATH.exists():
        print(f"\n[OK] Service account found")
        print(f"     Email: {get_sa_email()}")
        sa_data = json.loads(SERVICE_ACCOUNT_PATH.read_text())
        print(f"     Project: {sa_data.get('project_id', 'unknown')}")
    else:
        print(f"\n[FAIL] Service account NOT found at {SERVICE_ACCOUNT_PATH}")
        return

    print(f"\n[...] Discovering GA4 property for {GA4_MEASUREMENT_ID}...")
    prop_id = get_property_id()
    print(f"[OK] GA4 Property ID: {prop_id}")

    print(f"\n[...] Testing data access...")
    try:
        response = run_report(prop_id, "7daysAgo", "today", ["date"], ["activeUsers"], limit=1)
        if response.rows:
            print(f"[OK] Data API working! Recent active users: {response.rows[0].metric_values[0].value}")
        else:
            print(f"[OK] Data API connected (no data yet)")

        print(f"\n[...] Testing realtime access...")
        rt = run_realtime(prop_id)
        total = sum(safe_int(r.metric_values[0].value) for r in rt.rows) if rt.rows else 0
        print(f"[OK] Realtime API working! Active now: {total}")

        print(f"\n{'=' * 60}")
        print(f"  ALL SYSTEMS GO — GA4 data access is operational")
        print(f"  Property ID: {prop_id}")
        print(f"  Measurement ID: {GA4_MEASUREMENT_ID}")
        print(f"  Cache age limit: {CACHE_MAX_AGE // 3600}h")
        print(f"{'=' * 60}")
    except SystemExit:
        pass


def cmd_overview(days=30):
    """Overview stats for the period."""
    prop_id = get_property_id()
    response = run_report(
        prop_id, f"{days}daysAgo", "today", [],
        ["activeUsers", "newUsers", "sessions", "screenPageViews",
         "averageSessionDuration", "bounceRate", "engagedSessions",
         "engagementRate", "eventsPerSession", "sessionsPerUser"],
    )

    print(f"\n{'=' * 55}")
    print(f"  MIAMI 3PL — GA4 OVERVIEW (Last {days} Days)")
    print(f"{'=' * 55}")

    if response.rows:
        vals = [v.value for v in response.rows[0].metric_values]
        labels = [
            ("Active Users", fmt_num(vals[0])),
            ("New Users", fmt_num(vals[1])),
            ("Sessions", fmt_num(vals[2])),
            ("Page Views", fmt_num(vals[3])),
            ("Avg Session Duration", fmt_dur(vals[4])),
            ("Bounce Rate", fmt_pct(safe_float(vals[5]) * 100)),
            ("Engaged Sessions", fmt_num(vals[6])),
            ("Engagement Rate", fmt_pct(safe_float(vals[7]) * 100)),
            ("Events/Session", f"{safe_float(vals[8]):.1f}"),
            ("Sessions/User", f"{safe_float(vals[9]):.1f}"),
        ]
        w = max(len(l) for l, _ in labels)
        for label, val in labels:
            print(f"  {label:<{w}}  {val}")
    else:
        print("  No data available for this period.")

    print(f"{'=' * 55}")
    return response


def cmd_today():
    """Today's stats."""
    prop_id = get_property_id()
    response = run_report(
        prop_id, "today", "today", [],
        ["activeUsers", "newUsers", "sessions", "screenPageViews", "averageSessionDuration"],
    )

    print(f"\n{'=' * 45}")
    print(f"  MIAMI 3PL — TODAY ({datetime.now().strftime('%Y-%m-%d')})")
    print(f"{'=' * 45}")

    if response.rows:
        vals = [v.value for v in response.rows[0].metric_values]
        print(f"  Active Users         {fmt_num(vals[0])}")
        print(f"  New Users            {fmt_num(vals[1])}")
        print(f"  Sessions             {fmt_num(vals[2])}")
        print(f"  Page Views           {fmt_num(vals[3])}")
        print(f"  Avg Session          {fmt_dur(vals[4])}")
    else:
        print("  No visitors yet today.")

    print(f"{'=' * 45}")
    return response


def cmd_realtime():
    """Real-time active users."""
    prop_id = get_property_id()
    response = run_realtime(prop_id)

    print(f"\n{'=' * 50}")
    print(f"  MIAMI 3PL — REAL-TIME ({datetime.now().strftime('%H:%M:%S')})")
    print(f"{'=' * 50}")

    total = sum(safe_int(r.metric_values[0].value) for r in response.rows) if response.rows else 0
    print(f"  Active Users NOW:  {total}")

    if response.rows:
        print(f"\n  {'Page':<35} {'Users':>6}")
        print(f"  {'─' * 35} {'─' * 6}")
        for row in sorted(response.rows, key=lambda r: safe_int(r.metric_values[0].value), reverse=True):
            page = row.dimension_values[0].value[:35]
            users = row.metric_values[0].value
            print(f"  {page:<35} {users:>6}")
    else:
        print("  No active users at this moment.")

    print(f"{'=' * 50}")
    return response


def cmd_visitors(days=30):
    """Daily visitors breakdown."""
    prop_id = get_property_id()
    response = run_report(
        prop_id, f"{days}daysAgo", "today",
        ["date"],
        ["activeUsers", "newUsers", "sessions", "screenPageViews"],
        limit=days + 1,
    )

    print(f"\n{'=' * 65}")
    print(f"  MIAMI 3PL — DAILY VISITORS (Last {days} Days)")
    print(f"{'=' * 65}")
    print(f"  {'Date':<12} {'Users':>7} {'New':>7} {'Sessions':>9} {'PageViews':>10}")
    print(f"  {'─' * 12} {'─' * 7} {'─' * 7} {'─' * 9} {'─' * 10}")

    total_u = total_n = total_s = total_p = 0

    if response.rows:
        rows = sorted(response.rows, key=lambda r: r.dimension_values[0].value)
        for row in rows:
            d = row.dimension_values[0].value
            date_fmt = f"{d[:4]}-{d[4:6]}-{d[6:]}"
            vals = [v.value for v in row.metric_values]
            u, n, s, p = safe_int(vals[0]), safe_int(vals[1]), safe_int(vals[2]), safe_int(vals[3])
            total_u += u; total_n += n; total_s += s; total_p += p
            print(f"  {date_fmt:<12} {u:>7,} {n:>7,} {s:>9,} {p:>10,}")

        print(f"  {'─' * 12} {'─' * 7} {'─' * 7} {'─' * 9} {'─' * 10}")
        print(f"  {'TOTAL':<12} {total_u:>7,} {total_n:>7,} {total_s:>9,} {total_p:>10,}")
        print(f"  {'AVG/DAY':<12} {total_u / max(len(rows), 1):>7.1f}")
    else:
        print("  No data for this period.")

    print(f"{'=' * 65}")
    return response


def cmd_pages(limit=20, days=30):
    """Top pages by views."""
    prop_id = get_property_id()
    response = run_report(
        prop_id, f"{days}daysAgo", "today",
        ["pagePath"],
        ["screenPageViews", "activeUsers", "averageSessionDuration"],
        limit=limit, order_by_metric="screenPageViews",
    )

    print(f"\n{'=' * 70}")
    print(f"  MIAMI 3PL — TOP PAGES (Last {days} Days)")
    print(f"{'=' * 70}")
    print(f"  {'#':>3}  {'Page':<35} {'Views':>7} {'Users':>7} {'Avg Time':>9}")
    print(f"  {'─' * 3}  {'─' * 35} {'─' * 7} {'─' * 7} {'─' * 9}")

    if response.rows:
        for i, row in enumerate(response.rows, 1):
            page = row.dimension_values[0].value[:35]
            vals = [v.value for v in row.metric_values]
            print(f"  {i:>3}  {page:<35} {safe_int(vals[0]):>7,} {safe_int(vals[1]):>7,} {fmt_dur(vals[2]):>9}")

    print(f"{'=' * 70}")
    return response


def cmd_sources(limit=20, days=30):
    """Top traffic sources."""
    prop_id = get_property_id()
    response = run_report(
        prop_id, f"{days}daysAgo", "today",
        ["sessionSource", "sessionMedium"],
        ["sessions", "activeUsers", "engagementRate"],
        limit=limit, order_by_metric="sessions",
    )

    print(f"\n{'=' * 70}")
    print(f"  MIAMI 3PL — TRAFFIC SOURCES (Last {days} Days)")
    print(f"{'=' * 70}")
    print(f"  {'#':>3}  {'Source / Medium':<30} {'Sessions':>9} {'Users':>7} {'Engage%':>8}")
    print(f"  {'─' * 3}  {'─' * 30} {'─' * 9} {'─' * 7} {'─' * 8}")

    if response.rows:
        for i, row in enumerate(response.rows, 1):
            sm = f"{row.dimension_values[0].value} / {row.dimension_values[1].value}"[:30]
            vals = [v.value for v in row.metric_values]
            print(f"  {i:>3}  {sm:<30} {safe_int(vals[0]):>9,} {safe_int(vals[1]):>7,} {fmt_pct(safe_float(vals[2]) * 100):>8}")

    print(f"{'=' * 70}")
    return response


def cmd_events(limit=20, days=30):
    """Top events."""
    prop_id = get_property_id()
    response = run_report(
        prop_id, f"{days}daysAgo", "today",
        ["eventName"],
        ["eventCount", "totalUsers"],
        limit=limit, order_by_metric="eventCount",
    )

    print(f"\n{'=' * 55}")
    print(f"  MIAMI 3PL — TOP EVENTS (Last {days} Days)")
    print(f"{'=' * 55}")
    print(f"  {'#':>3}  {'Event':<30} {'Count':>9} {'Users':>7}")
    print(f"  {'─' * 3}  {'─' * 30} {'─' * 9} {'─' * 7}")

    if response.rows:
        for i, row in enumerate(response.rows, 1):
            event = row.dimension_values[0].value[:30]
            vals = [v.value for v in row.metric_values]
            print(f"  {i:>3}  {event:<30} {safe_int(vals[0]):>9,} {safe_int(vals[1]):>7,}")

    print(f"{'=' * 55}")
    return response


def cmd_countries(limit=20, days=30):
    """Top countries."""
    prop_id = get_property_id()
    response = run_report(
        prop_id, f"{days}daysAgo", "today",
        ["country"],
        ["activeUsers", "sessions", "engagementRate"],
        limit=limit, order_by_metric="activeUsers",
    )

    print(f"\n{'=' * 60}")
    print(f"  MIAMI 3PL — TOP COUNTRIES (Last {days} Days)")
    print(f"{'=' * 60}")
    print(f"  {'#':>3}  {'Country':<25} {'Users':>7} {'Sessions':>9} {'Engage%':>8}")
    print(f"  {'─' * 3}  {'─' * 25} {'─' * 7} {'─' * 9} {'─' * 8}")

    if response.rows:
        for i, row in enumerate(response.rows, 1):
            country = row.dimension_values[0].value[:25]
            vals = [v.value for v in row.metric_values]
            print(f"  {i:>3}  {country:<25} {safe_int(vals[0]):>7,} {safe_int(vals[1]):>9,} {fmt_pct(safe_float(vals[2]) * 100):>8}")

    print(f"{'=' * 60}")
    return response


def cmd_devices(days=30):
    """Device category breakdown."""
    prop_id = get_property_id()
    response = run_report(
        prop_id, f"{days}daysAgo", "today",
        ["deviceCategory"],
        ["activeUsers", "sessions", "screenPageViews", "averageSessionDuration"],
        limit=10, order_by_metric="activeUsers",
    )

    print(f"\n{'=' * 65}")
    print(f"  MIAMI 3PL — DEVICE BREAKDOWN (Last {days} Days)")
    print(f"{'=' * 65}")
    print(f"  {'Device':<15} {'Users':>7} {'Sessions':>9} {'PageViews':>10} {'Avg Time':>9}")
    print(f"  {'─' * 15} {'─' * 7} {'─' * 9} {'─' * 10} {'─' * 9}")

    total_users = 0
    device_data = []
    if response.rows:
        for row in response.rows:
            vals = [v.value for v in row.metric_values]
            u = safe_int(vals[0])
            total_users += u
            device_data.append((
                row.dimension_values[0].value.capitalize(),
                u, safe_int(vals[1]), safe_int(vals[2]), vals[3],
            ))

        for device, u, s, p, dur in device_data:
            pct = (u / total_users * 100) if total_users > 0 else 0
            bar = "█" * int(pct / 5)
            print(f"  {device:<15} {u:>7,} {s:>9,} {p:>10,} {fmt_dur(dur):>9}")
            print(f"  {'':15} {pct:>6.1f}% {bar}")

    print(f"{'=' * 65}")
    return response


def cmd_compare(days=7):
    """Compare current period vs previous period."""
    prop_id = get_property_id()
    metrics = ["activeUsers", "newUsers", "sessions", "screenPageViews",
               "averageSessionDuration", "bounceRate", "engagementRate"]

    current = run_report(prop_id, f"{days}daysAgo", "today", [], metrics)
    previous = run_report(prop_id, f"{days * 2}daysAgo", f"{days + 1}daysAgo", [], metrics)

    print(f"\n{'=' * 65}")
    print(f"  MIAMI 3PL — PERIOD COMPARISON ({days} Days)")
    print(f"{'=' * 65}")
    print(f"  {'Metric':<22} {'Current':>10} {'Previous':>10} {'Change':>10}")
    print(f"  {'─' * 22} {'─' * 10} {'─' * 10} {'─' * 10}")

    labels = ["Active Users", "New Users", "Sessions", "Page Views",
              "Avg Session", "Bounce Rate", "Engagement"]

    c_vals = [v.value for v in current.rows[0].metric_values] if current.rows else ["0"] * 7
    p_vals = [v.value for v in previous.rows[0].metric_values] if previous.rows else ["0"] * 7

    for i, label in enumerate(labels):
        if i == 4:  # duration
            c_fmt = fmt_dur(c_vals[i])
            p_fmt = fmt_dur(p_vals[i])
        elif i >= 5:  # rates
            c_fmt = fmt_pct(safe_float(c_vals[i]) * 100)
            p_fmt = fmt_pct(safe_float(p_vals[i]) * 100)
        else:
            c_fmt = fmt_num(c_vals[i])
            p_fmt = fmt_num(p_vals[i])

        delta = fmt_delta(c_vals[i], p_vals[i])
        print(f"  {label:<22} {c_fmt:>10} {p_fmt:>10} {delta:>10}")

    print(f"{'=' * 65}")


def cmd_report(days=30):
    """Full comprehensive report."""
    print(f"\n{'═' * 65}")
    print(f"  MIAMI 3PL — FULL ANALYTICS REPORT")
    print(f"  Period: Last {days} days | Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"  Website: https://megalopolisms.github.io/miamialliance3pl/")
    print(f"  GA4: {GA4_MEASUREMENT_ID} | Property: {get_property_id()}")
    print(f"{'═' * 65}")

    cmd_overview(days)
    cmd_visitors(min(days, 14))
    cmd_pages(10, days)
    cmd_sources(10, days)
    cmd_events(10, days)
    cmd_countries(10, days)
    cmd_devices(days)

    print(f"\n{'═' * 65}")
    print(f"  END OF REPORT")
    print(f"{'═' * 65}")


# ══════════════════════════════════════════════════════════
# JSON OUTPUT
# ══════════════════════════════════════════════════════════

def to_json(response, dim_names, met_names):
    """Convert GA4 response to list of dicts."""
    rows = []
    if response and response.rows:
        for row in response.rows:
            entry = {}
            for i, dim in enumerate(dim_names):
                entry[dim] = row.dimension_values[i].value if i < len(row.dimension_values) else None
            for i, met in enumerate(met_names):
                entry[met] = row.metric_values[i].value if i < len(row.metric_values) else None
            rows.append(entry)
    return rows


def cmd_json(subcmd, args):
    """Output command results as JSON for Symbio parsing."""
    prop_id = get_property_id()

    handlers = {
        "overview": lambda: _json_overview(prop_id, args),
        "visitors": lambda: _json_visitors(prop_id, args),
        "pages": lambda: _json_pages(prop_id, args),
        "sources": lambda: _json_sources(prop_id, args),
        "events": lambda: _json_events(prop_id, args),
        "countries": lambda: _json_countries(prop_id, args),
        "today": lambda: _json_today(prop_id),
        "realtime": lambda: _json_realtime(prop_id),
    }

    if subcmd in handlers:
        handlers[subcmd]()
    else:
        print(json.dumps({"error": f"Unknown: {subcmd}", "available": list(handlers.keys())}))


def _json_overview(prop_id, args):
    days = parse_int_arg(args, 30)
    mets = ["activeUsers", "newUsers", "sessions", "screenPageViews",
            "averageSessionDuration", "bounceRate", "engagedSessions", "engagementRate"]
    r = run_report(prop_id, f"{days}daysAgo", "today", [], mets)
    print(json.dumps({"period": f"last_{days}_days", "data": to_json(r, [], mets)}, indent=2))


def _json_visitors(prop_id, args):
    days = parse_int_arg(args, 30)
    dims, mets = ["date"], ["activeUsers", "newUsers", "sessions", "screenPageViews"]
    r = run_report(prop_id, f"{days}daysAgo", "today", dims, mets, limit=days + 1)
    print(json.dumps({"period": f"last_{days}_days", "daily": to_json(r, dims, mets)}, indent=2))


def _json_pages(prop_id, args):
    limit = parse_int_arg(args, 20)
    dims, mets = ["pagePath"], ["screenPageViews", "activeUsers"]
    r = run_report(prop_id, "30daysAgo", "today", dims, mets, limit=limit, order_by_metric="screenPageViews")
    print(json.dumps({"pages": to_json(r, dims, mets)}, indent=2))


def _json_sources(prop_id, args):
    limit = parse_int_arg(args, 20)
    dims, mets = ["sessionSource", "sessionMedium"], ["sessions", "activeUsers"]
    r = run_report(prop_id, "30daysAgo", "today", dims, mets, limit=limit, order_by_metric="sessions")
    print(json.dumps({"sources": to_json(r, dims, mets)}, indent=2))


def _json_events(prop_id, args):
    limit = parse_int_arg(args, 20)
    dims, mets = ["eventName"], ["eventCount", "totalUsers"]
    r = run_report(prop_id, "30daysAgo", "today", dims, mets, limit=limit, order_by_metric="eventCount")
    print(json.dumps({"events": to_json(r, dims, mets)}, indent=2))


def _json_countries(prop_id, args):
    limit = parse_int_arg(args, 20)
    dims, mets = ["country"], ["activeUsers", "sessions"]
    r = run_report(prop_id, "30daysAgo", "today", dims, mets, limit=limit, order_by_metric="activeUsers")
    print(json.dumps({"countries": to_json(r, dims, mets)}, indent=2))


def _json_today(prop_id):
    mets = ["activeUsers", "newUsers", "sessions", "screenPageViews"]
    r = run_report(prop_id, "today", "today", [], mets)
    print(json.dumps({"date": datetime.now().strftime("%Y-%m-%d"), "data": to_json(r, [], mets)}, indent=2))


def _json_realtime(prop_id):
    response = run_realtime(prop_id)
    rows = []
    if response.rows:
        for row in response.rows:
            rows.append({
                "page": row.dimension_values[0].value,
                "activeUsers": safe_int(row.metric_values[0].value),
            })
    total = sum(r["activeUsers"] for r in rows)
    print(json.dumps({"timestamp": datetime.now().isoformat(), "activeUsers": total, "pages": rows}, indent=2))


# ══════════════════════════════════════════════════════════
# CLI ENTRY POINT
# ══════════════════════════════════════════════════════════

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(0)

    cmd = sys.argv[1].lower()
    args = sys.argv[2:]

    commands = {
        "setup": lambda: cmd_setup(),
        "overview": lambda: cmd_overview(parse_int_arg(args, 30)),
        "today": lambda: cmd_today(),
        "realtime": lambda: cmd_realtime(),
        "visitors": lambda: cmd_visitors(parse_int_arg(args, 30)),
        "pages": lambda: cmd_pages(parse_int_arg(args, 20)),
        "sources": lambda: cmd_sources(parse_int_arg(args, 20)),
        "events": lambda: cmd_events(parse_int_arg(args, 20)),
        "countries": lambda: cmd_countries(parse_int_arg(args, 20)),
        "devices": lambda: cmd_devices(),
        "compare": lambda: cmd_compare(parse_int_arg(args, 7)),
        "report": lambda: cmd_report(parse_int_arg(args, 30)),
        "json": lambda: cmd_json(args[0] if args else "overview", args[1:]),
    }

    if cmd in commands:
        commands[cmd]()
    else:
        print(f"Unknown command: {cmd}")
        print(f"Available: {', '.join(sorted(commands.keys()))}")
        sys.exit(1)


if __name__ == "__main__":
    main()
