#!/usr/bin/env python3
"""
Miami Alliance 3PL - Daily Blog News Updater
============================================
Fetches current logistics/supply-chain news and updates blog.html.

Usage:
    python3 update_blog_news.py               # Dry run
    python3 update_blog_news.py --apply       # Update blog.html
    python3 update_blog_news.py --cron        # Non-interactive (for schedulers)
    python3 update_blog_news.py --apply --push
"""

import argparse
import html
import re
import subprocess
import sys
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
BLOG_HTML = PROJECT_ROOT / "blog.html"

RSS_FEEDS = [
    {
        "url": "https://www.freightwaves.com/feed",
        "name": "FreightWaves",
        "category": "freight",
    },
    {
        "url": "https://www.supplychaindive.com/feeds/news/",
        "name": "Supply Chain Dive",
        "category": "supply-chain",
    },
    {
        "url": "https://www.dcvelocity.com/rss/",
        "name": "DC Velocity",
        "category": "warehousing",
    },
    {
        "url": "https://www.ttnews.com/rss.xml",
        "name": "Transport Topics",
        "category": "freight",
    },
]

CATEGORY_TAGS = {
    "freight": ("tag-freight", "Freight"),
    "ports": ("tag-ports", "Ports"),
    "ecommerce": ("tag-ecommerce", "E-Commerce"),
    "supply-chain": ("tag-supply-chain", "Supply Chain"),
    "technology": ("tag-technology", "Technology"),
    "warehousing": ("tag-warehousing", "Warehousing"),
    "3pl": ("tag-3pl", "3PL"),
    "last-mile": ("tag-last-mile", "Last-Mile"),
}

CATEGORY_KEYWORDS = {
    "freight": [
        "freight",
        "trucking",
        "truckload",
        "ltl",
        "carrier",
        "shipping rate",
        "drayage",
        "intermodal",
        "linehaul",
    ],
    "ports": ["port", "container", "teu", "maritime", "ocean", "vessel", "harbor"],
    "ecommerce": [
        "e-commerce",
        "ecommerce",
        "amazon",
        "shopify",
        "d2c",
        "online retail",
        "fulfillment center",
    ],
    "technology": [
        "robot",
        "automation",
        "artificial intelligence",
        "wms",
        "tms",
        "software",
        "platform",
    ],
    "warehousing": [
        "warehouse",
        "storage",
        "inventory",
        "distribution center",
        "cold chain",
        "fulfillment",
    ],
    "3pl": ["3pl", "third-party logistics", "logistics provider", "outsourc"],
    "last-mile": ["last mile", "last-mile", "delivery", "parcel", "ups", "fedex", "usps"],
    "supply-chain": ["supply chain", "procurement", "sourcing", "import", "export", "customs"],
}

LOGISTICS_RELEVANCE_KEYWORDS = sorted(
    {kw for keywords in CATEGORY_KEYWORDS.values() for kw in keywords}
    | {
        "supply-chain",
        "distribution",
        "cross-border",
        "nearshoring",
        "rail",
        "air cargo",
        "ocean freight",
        "demand planning",
        "yard",
        "dock",
        "tariff",
    }
)

US_RELEVANCE_KEYWORDS = [
    "u.s.",
    "u.s",
    "united states",
    "american",
    "north america",
    "federal",
    "customs and border protection",
    "supreme court",
    "white house",
    "congress",
    "department of transportation",
    "u.s. treasury",
    "fmc",
    "fmcsa",
    "miami",
    "florida",
    "texas",
    "california",
    "georgia",
    "new york",
    "new jersey",
    "illinois",
    "ohio",
    "south carolina",
    "north carolina",
    "portmiami",
    "port of los angeles",
    "port of long beach",
    "port of savannah",
    "port of houston",
]

MAX_ARTICLES = 9  # Grid cards; one more article is used as featured.
MAX_SUMMARY_LEN = 280
MAX_SOURCE_SHARE = 3
RECENT_DAYS = 10
MIN_RELEVANCE_SCORE = 2


def clean_html(text):
    """Strip HTML tags and normalize whitespace."""
    clean = re.sub(r"<[^>]+>", " ", text or "")
    clean = html.unescape(clean)
    clean = re.sub(r"\s+", " ", clean).strip()
    return clean


def truncate(text, max_len=MAX_SUMMARY_LEN):
    """Truncate text to max_len at a word boundary."""
    if len(text) <= max_len:
        return text
    truncated = text[:max_len].rsplit(" ", 1)[0]
    return truncated.rstrip(".,;:") + "..."


def normalize_text(value):
    """Normalize free text for keyword matching."""
    return re.sub(r"\s+", " ", (value or "")).strip().lower()


def keyword_hits(text, keywords):
    """Count unique keyword hits in text."""
    normalized = normalize_text(text)
    return sum(1 for kw in keywords if kw in normalized)


def logistics_relevance_score(title, description, categories_text=""):
    """Score how logistics-relevant an article is."""
    score = keyword_hits(
        f"{title} {description} {categories_text}",
        LOGISTICS_RELEVANCE_KEYWORDS,
    )
    return score


def us_relevance_score(title, description, categories_text=""):
    """Score U.S. relevance so feed favors domestic logistics coverage."""
    score = keyword_hits(
        f"{title} {description} {categories_text}",
        US_RELEVANCE_KEYWORDS,
    )
    return score


def parse_date(date_str):
    """Parse feed date into datetime."""
    formats = [
        "%a, %d %b %Y %H:%M:%S %z",
        "%a, %d %b %Y %H:%M:%S %Z",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%S.%f%z",
        "%Y-%m-%d",
    ]
    for fmt in formats:
        try:
            return datetime.strptime((date_str or "").strip(), fmt)
        except (TypeError, ValueError):
            continue
    return datetime.now()


def format_date(dt):
    """Format datetime for page display."""
    return dt.strftime("%b %d, %Y")


def auto_categorize(title, description, default="supply-chain"):
    """Select the best category based on keyword matches."""
    combined = normalize_text(f"{title} {description}")
    scores = {}
    for category, keywords in CATEGORY_KEYWORDS.items():
        hits = sum(1 for kw in keywords if kw in combined)
        if hits:
            scores[category] = hits
    return max(scores, key=scores.get) if scores else default


def normalize_link(url):
    """Allow only HTTP(S) links."""
    value = (url or "").strip()
    if value.startswith("https://") or value.startswith("http://"):
        return value
    return ""


def build_title_key(title):
    """Dedup key for similar headlines."""
    return re.sub(r"[^a-z0-9]", "", normalize_text(title))[:64]


def fetch_feed(url, timeout=20):
    """Fetch and parse an RSS/Atom feed."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Miami3PL-BlogBot/1.2"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = resp.read()
        root = ET.fromstring(data)

        items = []
        for item in root.findall(".//item"):
            categories = [
                clean_html(category.text or "")
                for category in item.findall("category")
                if (category.text or "").strip()
            ]
            items.append(
                {
                    "title": clean_html(item.findtext("title", "")),
                    "description": clean_html(item.findtext("description", "")),
                    "pub_date": (item.findtext("pubDate", "") or "").strip(),
                    "link": normalize_link(item.findtext("link", "")),
                    "categories_text": " ".join(categories),
                }
            )

        if items:
            return [item for item in items if item["title"]]

        ns = {"atom": "http://www.w3.org/2005/Atom"}
        for entry in root.findall(".//atom:entry", ns):
            title = clean_html(entry.findtext("atom:title", "", ns))
            summary = clean_html(
                entry.findtext("atom:summary", "", ns)
                or entry.findtext("atom:content", "", ns)
            )
            updated = (
                entry.findtext("atom:updated", "", ns)
                or entry.findtext("atom:published", "", ns)
                or ""
            ).strip()
            link = ""
            for link_el in entry.findall("atom:link", ns):
                href = normalize_link(link_el.attrib.get("href", ""))
                rel = (link_el.attrib.get("rel", "") or "").lower()
                if href and (not rel or rel == "alternate"):
                    link = href
                    break
            category_tokens = []
            for category in entry.findall("atom:category", ns):
                token = clean_html(category.attrib.get("term", "") or category.attrib.get("label", ""))
                if token:
                    category_tokens.append(token)

            if title:
                items.append(
                    {
                        "title": title,
                        "description": summary,
                        "pub_date": updated,
                        "link": link,
                        "categories_text": " ".join(category_tokens),
                    }
                )
        return items
    except Exception as exc:
        print(f"  [WARN] Failed to fetch {url}: {exc}", file=sys.stderr)
        return []


def select_articles(all_articles, limit):
    """
    Select top articles using relevance + U.S. preference + source diversity.

    Returns at most `limit` articles with the first one intended as featured.
    """
    for article in all_articles:
        if article["date"].tzinfo is not None:
            article["date"] = article["date"].replace(tzinfo=None)

    all_articles.sort(
        key=lambda article: (
            article["date"],
            article.get("relevance_score", 0),
            article.get("us_score", 0),
        ),
        reverse=True,
    )

    cutoff = datetime.now() - timedelta(days=RECENT_DAYS)
    recent = [article for article in all_articles if article["date"] >= cutoff]
    recent_pool = recent if recent else all_articles

    highly_relevant = [
        article
        for article in recent_pool
        if article.get("relevance_score", 0) >= MIN_RELEVANCE_SCORE
    ]
    if len(highly_relevant) < limit:
        highly_relevant = recent_pool

    us_focused = [article for article in highly_relevant if article.get("us_score", 0) > 0]
    ranking_pool = us_focused if len(us_focused) >= limit else highly_relevant

    ranked = sorted(
        ranking_pool,
        key=lambda article: (
            article["date"],
            article.get("us_score", 0) > 0,
            article.get("relevance_score", 0),
            article.get("us_score", 0),
        ),
        reverse=True,
    )

    seen_titles = set()
    source_counts = {}
    selected = []

    for article in ranked:
        title_key = build_title_key(article["title"])
        if not title_key or title_key in seen_titles:
            continue

        source = article.get("source", "Unknown")
        if source_counts.get(source, 0) >= MAX_SOURCE_SHARE:
            continue

        seen_titles.add(title_key)
        source_counts[source] = source_counts.get(source, 0) + 1
        selected.append(article)

        if len(selected) == limit:
            break

    return selected


def generate_card_html(article, is_featured=False):
    """Generate featured or regular card HTML."""
    category = article["category"]
    tag_class, tag_label = CATEGORY_TAGS.get(category, ("tag-supply-chain", "Supply Chain"))
    date_str = format_date(article["date"])
    summary = truncate(article["description"])
    source = article.get("source", "Industry Source")
    safe_title = html.escape(article["title"])
    safe_summary = html.escape(summary)
    safe_source = html.escape(source)
    link = html.escape(article.get("link", ""))

    title_markup = safe_title
    read_more_markup = ""
    if link:
        title_markup = (
            f'<a class="article-title-link" href="{link}" target="_blank" '
            f'rel="noopener noreferrer">{safe_title}</a>'
        )
        read_more_markup = (
            f'<a class="article-read-link" href="{link}" target="_blank" '
            f'rel="noopener noreferrer">Read full article</a>'
        )

    if is_featured:
        return f"""                <article class="featured-card" data-category="{category}">
                    <div class="featured-badge">FEATURED</div>
                    <div class="featured-content">
                        <div class="article-meta">
                            <span class="category-tag {tag_class}">{tag_label}</span>
                            <span class="article-date">{date_str}</span>
                        </div>
                        <h2>{title_markup}</h2>
                        <p>{safe_summary}</p>
                        <div class="article-source">
                            <span>Source: {safe_source}</span>
                            {read_more_markup}
                        </div>
                    </div>
                </article>"""

    return f"""                    <article class="blog-card" data-category="{category}">
                        <div class="card-header">
                            <span class="category-tag {tag_class}">{tag_label}</span>
                            <span class="article-date">{date_str}</span>
                        </div>
                        <h3>{title_markup}</h3>
                        <p>{safe_summary}</p>
                        <div class="article-source">
                            <span>Source: {safe_source}</span>
                            {read_more_markup}
                        </div>
                    </article>"""


def update_blog_html(selected_articles):
    """Update blog.html featured card, grid cards, and visible date label."""
    if not BLOG_HTML.exists():
        raise FileNotFoundError(f"blog.html not found at {BLOG_HTML}")
    if not selected_articles:
        raise RuntimeError("No selected articles to render.")

    featured_html = generate_card_html(selected_articles[0], is_featured=True)
    grid_cards = "\n\n".join(generate_card_html(article) for article in selected_articles[1:])

    content = BLOG_HTML.read_text(encoding="utf-8")

    featured_pattern = (
        r'(<section class="blog-featured">\s*<div class="container">)\s*<article.*?</article>\s*'
        r"(</div>\s*</section>)"
    )
    featured_replacement = f"\\1\n{featured_html}\n            \\2"
    content, featured_count = re.subn(
        featured_pattern, featured_replacement, content, flags=re.DOTALL
    )
    if featured_count != 1:
        raise RuntimeError("Unable to update featured article block in blog.html")

    grid_pattern = r'(<div class="blog-grid">)\s*.*?\s*(</div>\s*</div>\s*</section>\s*<!-- Industry Insight)'
    grid_replacement = f"\\1\n\n{grid_cards}\n\n                \\2"
    content, grid_count = re.subn(grid_pattern, grid_replacement, content, flags=re.DOTALL)
    if grid_count != 1:
        raise RuntimeError("Unable to update blog grid block in blog.html")

    today_label = datetime.now().strftime("%B %d, %Y").replace(" 0", " ")
    content = re.sub(
        r'(<span id="blog-date">).*?(</span>)',
        rf"\1{today_label}\2",
        content,
        flags=re.DOTALL,
    )

    BLOG_HTML.write_text(content, encoding="utf-8")


def commit_and_push_if_changed(selected_count, cron_mode=False):
    """Commit/push blog changes only when there is an actual diff."""
    diff_check = subprocess.run(
        ["git", "diff", "--quiet", "--", "blog.html"],
        cwd=str(PROJECT_ROOT),
        capture_output=True,
        check=False,
    )
    if diff_check.returncode == 0:
        if not cron_mode:
            print("  No blog.html changes to commit.")
        return

    today = datetime.now().strftime("%Y-%m-%d")
    commit_message = f"Daily blog update: {today} ({selected_count} articles)"

    subprocess.run(["git", "add", "blog.html"], cwd=str(PROJECT_ROOT), check=True)
    subprocess.run(
        ["git", "commit", "-m", commit_message],
        cwd=str(PROJECT_ROOT),
        check=True,
    )
    subprocess.run(["git", "push"], cwd=str(PROJECT_ROOT), check=True)

    if not cron_mode:
        print(f"  Committed and pushed: {commit_message}")


def parse_args():
    """Parse CLI flags."""
    parser = argparse.ArgumentParser(description="Daily logistics news updater for blog.html")
    parser.add_argument("--apply", action="store_true", help="Write updated cards into blog.html")
    parser.add_argument(
        "--cron",
        action="store_true",
        help="Non-interactive mode for schedulers (implies --apply)",
    )
    parser.add_argument(
        "--push",
        action="store_true",
        help="Commit and push blog.html after update",
    )
    parser.add_argument(
        "--max-articles",
        type=int,
        default=MAX_ARTICLES,
        help="Number of grid cards (excluding featured)",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    cron_mode = args.cron
    apply_mode = args.apply or args.cron
    max_articles = max(4, args.max_articles)
    total_slots = max_articles + 1

    if not cron_mode:
        print("=" * 60)
        print("  Miami Alliance 3PL - Daily Blog News Updater")
        print("=" * 60)

    all_articles = []
    for feed in RSS_FEEDS:
        if not cron_mode:
            print(f"\n  Fetching: {feed['name']}...")

        feed_items = fetch_feed(feed["url"])
        for item in feed_items:
            category = auto_categorize(item["title"], item["description"], feed["category"])
            published_at = parse_date(item["pub_date"])
            relevance = logistics_relevance_score(
                item["title"], item["description"], item.get("categories_text", "")
            )
            us_score = us_relevance_score(
                item["title"], item["description"], item.get("categories_text", "")
            )

            all_articles.append(
                {
                    "title": item["title"],
                    "description": item["description"] or "No summary available.",
                    "date": published_at,
                    "source": feed["name"],
                    "category": category,
                    "link": item["link"],
                    "relevance_score": relevance,
                    "us_score": us_score,
                }
            )

    if not all_articles:
        print("  [ERROR] No articles fetched from any feed.", file=sys.stderr)
        sys.exit(1)

    selected = select_articles(all_articles, total_slots)
    if len(selected) < 2:
        print("  [ERROR] Not enough qualifying articles after filtering.", file=sys.stderr)
        sys.exit(1)

    if not cron_mode:
        print(f"\n  Found {len(all_articles)} total articles")
        print(f"  Selected: {len(selected)} for blog")
        print()
        for idx, article in enumerate(selected):
            marker = "[FEATURED]" if idx == 0 else f"[{idx}]"
            print(f"  {marker} {article['title'][:70]}...")
            print(
                "         "
                f"{article['category'].upper()} | {article['source']} | "
                f"{format_date(article['date'])} | "
                f"rel={article['relevance_score']} us={article['us_score']}"
            )

    if not apply_mode:
        print("\n  DRY RUN - Use --apply to write to blog.html")
        return

    try:
        update_blog_html(selected)
        if not cron_mode:
            print(f"\n  blog.html updated with {len(selected)} articles")
            print(f"  File: {BLOG_HTML}")
        else:
            print(f"[{datetime.now().isoformat()}] Blog updated: {len(selected)} articles")
    except Exception as exc:
        print(f"  [ERROR] Failed to update blog.html: {exc}", file=sys.stderr)
        sys.exit(1)

    if cron_mode or args.push:
        try:
            commit_and_push_if_changed(len(selected), cron_mode=cron_mode)
            if cron_mode:
                print(f"[{datetime.now().isoformat()}] Git push OK")
        except subprocess.CalledProcessError as exc:
            print(f"  [WARN] Git push failed: {exc}", file=sys.stderr)


if __name__ == "__main__":
    main()
