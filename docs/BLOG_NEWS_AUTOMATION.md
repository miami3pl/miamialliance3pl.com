# Worthy News in the Logistics World - Automation

## Scope
- Page: `blog.html`
- Updater script: `admin/update_blog_news.py`
- Daily workflow: `.github/workflows/daily-logistics-news.yml`
- Watchdog workflow: `.github/workflows/foreman-watchdog.yml`
- Watchdog runner: `scripts/foreman_watchdog.sh`

## Daily update pipeline
1. GitHub Actions runs `daily-logistics-news.yml` on schedule (`35 13 * * *`) and on manual dispatch.
2. The workflow executes:
   - `python3 admin/update_blog_news.py --apply`
3. If `blog.html` changed, the workflow commits and pushes the update.

## Foreman watchdog (Codex + Opus)
- `codex lane`: feed fetch dry run + blog structure/freshness checks.
- `opus lane`: updater unit tests (`python3 -m unittest admin.test_update_blog_news`).
- Artifacts are uploaded in CI under `foreman-watchdog-artifacts`.

## Local runbook
```bash
# Dry run article selection
python3 admin/update_blog_news.py

# Apply latest news to blog.html
python3 admin/update_blog_news.py --apply

# Run updater unit tests
python3 -m unittest admin.test_update_blog_news

# Run codex+opus watchdog checks
bash scripts/foreman_watchdog.sh
```
