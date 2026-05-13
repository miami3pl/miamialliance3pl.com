# Miami3PL GA4 API Setup

## Status: OPERATIONAL (Connected 2026-03-03)

| Field                    | Value                                                                           |
| ------------------------ | ------------------------------------------------------------------------------- |
| **Measurement ID**       | `G-KTW0F25ZM1`                                                                  |
| **GA4 Property ID**      | `526065876`                                                                     |
| **GA4 Account**          | `accounts/385690352` (Miami Alliance 3PL)                                       |
| **Service Account**      | `firebase-adminsdk-fbsvc@miamialliance3pl.iam.gserviceaccount.com`              |
| **Service Account Role** | Admin (account + property level)                                                |
| **Firebase Key**         | `/Users/yuri/Dropbox/mcp-servers/MCP-51-miami3pl/firebase-key.json`             |
| **GA Client**            | `/Users/yuri/Dropbox/mcp-servers/MCP-51-miami3pl/project/admin/ga_client.py`    |
| **Property Cache**       | `/Users/yuri/Dropbox/mcp-servers/MCP-51-miami3pl/project/admin/.ga_property_id` |

## APIs Enabled

- Google Analytics Data API (`analyticsdata.googleapis.com`) — **ENABLED**
- Google Analytics Admin API (`analyticsadmin.googleapis.com`) — **ENABLED**

## Connection History

- **2026-03-03**: Fixed stale property ID cache (`516445948` → `526065876`). Old property was from initial Firebase linking; real GA4 property `526065876` was created 2026-02-26 under `accounts/385690352`. All commands now operational.
- **2026-02-26**: GA4 property created, gtag deployed on 20+ pages, `ga_client.py` written, `/ga` skill created.

## Architecture

```
Website (HTML)  →  gtag.js (G-KTW0F25ZM1)  →  GA4 Property 526065876
                                                        ↑
ga_client.py  →  Firebase Service Account (OAuth2)  →  GA4 Data API v1beta
                                                        ↑
/analytics3pl  →  Claude Code skill  →  ga_client.py  →  (same)
```

- **Auth**: Firebase service account → OAuth2 (no API keys — FENCE API0 compliant)
- **Packages**: `google-analytics-data` v0.20.0 + `google-analytics-admin` v0.27.0
- **Frontend**: `js/analytics.js` — custom event tracking (quotes, PDFs, forms, logins, chat)

## Quick Commands

```bash
cd /Users/yuri/Dropbox/mcp-servers/MCP-51-miami3pl/project/admin

python3 ga_client.py setup          # Verify connection
python3 ga_client.py today          # Today's visitors
python3 ga_client.py overview       # 30-day summary
python3 ga_client.py realtime       # Who's on the site RIGHT NOW
python3 ga_client.py visitors 7     # Daily breakdown (7 days)
python3 ga_client.py pages          # Top 20 pages by views
python3 ga_client.py sources        # Top traffic sources
python3 ga_client.py events         # Top events
python3 ga_client.py countries      # Top countries
python3 ga_client.py devices        # Desktop vs mobile vs tablet
python3 ga_client.py report         # Full comprehensive report
python3 ga_client.py json overview  # JSON output for Symbio
```

Or use `/analytics3pl` in Claude Code.

## Accounts with Access

| User                                                               | Role  | Level              |
| ------------------------------------------------------------------ | ----- | ------------------ |
| `pandasllc@gmail.com`                                              | Admin | Account            |
| `yuri@megalopolisms.com`                                           | Admin | Account            |
| `firebase-adminsdk-fbsvc@miamialliance3pl.iam.gserviceaccount.com` | Admin | Account + Property |

## Tracked Events (analytics.js)

| Event                        | Trigger             |
| ---------------------------- | ------------------- |
| `generate_lead`              | Quote calculation   |
| `file_download`              | PDF quote download  |
| `form_submit` / `form_error` | Form interactions   |
| `login`                      | User authentication |
| `sign_up`                    | Registration        |
| `select_content`             | CTA button clicks   |
| `chat_open` / `chat_message` | Support chat        |

## Pages with gtag (20+)

index.html, blog.html, login.html, services.html, about.html, contact.html, and all portal/\* pages (dashboard, admin-panel, admin-billing, shipments, tracking, inventory, customers, contracts, billing, pricing, pickups, storage-log, team, changelog, invoice-template).

## Troubleshooting

| Error                   | Fix                                                             |
| ----------------------- | --------------------------------------------------------------- |
| Permission Denied (403) | Service account not added to GA4 property, or wrong property ID |
| Property not found      | Run `setup` to re-discover. Check `.ga_property_id` cache       |
| Stale property ID       | Delete `.ga_property_id` and run `setup` to auto-discover       |
| No data                 | Zero visitors for period (check GA4 console directly)           |
| API not enabled         | Enable at Google Cloud Console (links above)                    |
