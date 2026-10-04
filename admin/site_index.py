#!/usr/bin/env python3
"""
Miami Alliance 3PL - Site Index Keeper
======================================
Keeps every index of the original articles in step with blog/*.html, whoever
published the article (the daily news job, a "/blog new" request, or a person):

  blog.html            the "N Articles" count and the CollectionPage ItemList schema
  js/lang/*.js         the translated "blog.count" strings (es, pt-br, zh)
  sitemap.xml          one <url> per article, lastmod = the article's own dateModified
  feed.xml             RSS 2.0 feed of the newest articles (new, 2026-10-04)
  ai/articles.md       the full article index for AI assistants (new, 2026-10-04)
  llms.txt             the managed "Latest Articles" block
  sitemap-ai.xml       the managed "latest articles" block of the AI sitemap

It never writes article text and never touches the daily "Industry News Feed"
section of blog.html (admin/update_blog_news.py owns that). Running it twice
changes nothing the second time.

Usage:
    python3 admin/site_index.py               # report what would change
    python3 admin/site_index.py --apply       # write the changes
    python3 admin/site_index.py --check       # exit 1 if anything is out of date (CI)
    python3 admin/site_index.py --indexnow URL [URL ...]
                                              # submit URLs to IndexNow (Bing, Yandex, ...)
    python3 admin/site_index.py --indexnow-diff BEFORE AFTER
                                              # submit the pages a git range changed

Standard library only.
"""

import argparse
import datetime as dt
import html
import json
import os
import re
import subprocess
import sys
import urllib.request
from email.utils import format_datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://miamialliance3pl.com"
BLOG_DIR = ROOT / "blog"
BLOG_HTML = ROOT / "blog.html"
SITEMAP = ROOT / "sitemap.xml"
SITEMAP_AI = ROOT / "sitemap-ai.xml"
FEED = ROOT / "feed.xml"
LLMS = ROOT / "llms.txt"
AI_INDEX = ROOT / "ai" / "articles.md"
LANG_FILES = {
    "es": (ROOT / "js/lang/es.js", "{n} Artículos"),
    "pt-br": (ROOT / "js/lang/pt-br.js", "{n} Artigos"),
    "zh": (ROOT / "js/lang/zh.js", "{n} 篇文章"),
}
ET = ZoneInfo("America/New_York")
FEED_ITEMS = 50
LLMS_LATEST = 12
AI_SITEMAP_LATEST = 10
INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow"
HOST = "miamialliance3pl.com"
TITLE_SUFFIX_RE = re.compile(r"\s*[|–—-]\s*Miami Alliance 3PL\s*$", re.I)


# --------------------------------------------------------------------------- articles


def _meta(doc, attr, name):
    m = re.search(
        r'<meta\s+%s="%s"\s+content="([^"]*)"' % (attr, re.escape(name)), doc, re.I
    ) or re.search(
        r'<meta\s+content="([^"]*)"\s+%s="%s"' % (attr, re.escape(name)), doc, re.I
    )
    return html.unescape(m.group(1)).strip() if m else ""


def _jsonld_blocks(doc):
    out = []
    for raw in re.findall(
        r'<script type="application/ld\+json">(.*?)</script>', doc, re.S | re.I
    ):
        try:
            data = json.loads(raw)
        except ValueError:
            continue
        stack = data if isinstance(data, list) else [data]
        while stack:
            d = stack.pop()
            if isinstance(d, dict):
                out.append(d)
                if isinstance(d.get("@graph"), list):
                    stack.extend(d["@graph"])
    return out


def _date(v):
    m = re.match(r"(\d{4}-\d{2}-\d{2})", str(v or ""))
    return m.group(1) if m else ""


def read_article(path):
    doc = path.read_text(encoding="utf-8", errors="replace")
    title = _meta(doc, "property", "og:title")
    if not title:
        m = re.search(r"<title>(.*?)</title>", doc, re.S | re.I)
        title = (
            TITLE_SUFFIX_RE.sub("", html.unescape(m.group(1)).strip())
            if m
            else path.stem
        )
    published = modified = ""
    section = ""
    for d in _jsonld_blocks(doc):
        if d.get("@type") in ("BlogPosting", "NewsArticle", "Article", "TechArticle"):
            published = published or _date(d.get("datePublished"))
            modified = modified or _date(d.get("dateModified"))
            section = section or str(d.get("articleSection") or "")
    published = published or _date(_meta(doc, "property", "article:published_time"))
    modified = (
        modified or _date(_meta(doc, "property", "article:modified_time")) or published
    )
    section = section or _meta(doc, "property", "article:section")
    return {
        "slug": path.name,
        "url": "%s/blog/%s" % (SITE, path.name),
        "title": title,
        "description": _meta(doc, "name", "description"),
        "published": published,
        "modified": max(modified, published) if modified else published,
        "section": section,
    }


def card_slugs(blog_doc):
    """Slugs of the article cards in the hub grid, in page order."""
    return re.findall(r'<a href="blog/([a-z0-9-]+\.html)" class="blog-card">', blog_doc)


def card_names(blog_doc):
    names = {}
    for slug, body in re.findall(
        r'<a href="blog/([a-z0-9-]+\.html)" class="blog-card">(.*?)</a>', blog_doc, re.S
    ):
        m = re.search(r"<h3>(.*?)</h3>", body, re.S)
        if m:
            names[slug] = html.unescape(re.sub(r"\s+", " ", m.group(1))).strip()
    return names


REDIRECT_RE = re.compile(r'http-equiv="refresh"|<meta\s+name="robots"\s+content="noindex', re.I)


def is_redirect(path):
    """A redirect stub or a noindex page is not an article: no card, no feed item, and it
    must not be listed in the sitemap (a sitemap lists canonical, indexable pages only)."""
    try:
        head = path.read_text(encoding="utf-8", errors="replace")[:4000]
    except OSError:
        return False
    return bool(REDIRECT_RE.search(head))


def load_articles():
    arts = {}
    for p in sorted(BLOG_DIR.glob("*.html")):
        if not is_redirect(p):
            arts[p.name] = read_article(p)
    return arts


def redirect_urls():
    return {"%s/blog/%s" % (SITE, p.name) for p in BLOG_DIR.glob("*.html") if is_redirect(p)}


def newest_first(arts, order):
    """Newest datePublished first; ties keep the hub's card order."""
    rank = {s: i for i, s in enumerate(order)}
    return sorted(
        arts.values(),
        key=lambda a: (a["published"] or "0000-00-00", -rank.get(a["slug"], 10_000)),
        reverse=True,
    )


# --------------------------------------------------------------------------- writers


class Change:
    def __init__(self):
        self.files = {}  # path -> new text
        self.notes = []

    def set(self, path, old, new, note):
        if new != old:
            self.files[path] = new
            self.notes.append("%s: %s" % (path.relative_to(ROOT), note))


def fix_blog_hub(chg, arts):
    doc = BLOG_HTML.read_text(encoding="utf-8")
    new = doc
    order = card_slugs(doc)
    names = card_names(doc)
    n = len(order)
    new = re.sub(
        r'(<span class="article-count" data-i18n="blog\.count">)\d+ Articles(</span>)',
        r"\g<1>%d Articles\g<2>" % n,
        new,
    )
    # CollectionPage -> mainEntity ItemList: every carded article, in card order.
    m = re.search(
        r'(<script type="application/ld\+json">\s*)(\{\s*"@context"[^<]*?"@type":\s*"CollectionPage".*?)(\s*</script>)',
        new,
        re.S,
    )
    if m:
        try:
            data = json.loads(m.group(2))
        except ValueError:
            data = None
        if isinstance(data, dict):
            items = [
                {
                    "@type": "ListItem",
                    "position": i + 1,
                    "url": "%s/blog/%s" % (SITE, s),
                    "name": names.get(s) or (arts.get(s) or {}).get("title") or s,
                }
                for i, s in enumerate(order)
            ]
            data.setdefault("mainEntity", {"@type": "ItemList"})
            data["mainEntity"]["@type"] = "ItemList"
            data["mainEntity"]["numberOfItems"] = len(items)
            data["mainEntity"]["itemListElement"] = items
            # Same layout the hand-written block always had: plain json.dumps(indent=4),
            # so a run only shows the lines that really changed.
            body = json.dumps(data, indent=4, ensure_ascii=False)
            new = new[: m.start(2)] + body + new[m.end(2) :]
    chg.set(BLOG_HTML, doc, new, "count=%d, ItemList=%d" % (n, n))
    for lang, (path, fmt) in LANG_FILES.items():
        if not path.exists():
            continue
        t = path.read_text(encoding="utf-8")
        t2 = re.sub(
            r'("blog\.count":\s*")[^"]*(")',
            lambda mm: mm.group(1) + fmt.format(n=n) + mm.group(2),
            t,
            count=1,
        )
        chg.set(path, t, t2, "blog.count=%d (%s)" % (n, lang))
    missing = sorted(set(arts) - set(order))
    if missing:
        chg.notes.append(
            "blog.html: articles on disk with no hub card: %s" % ", ".join(missing)
        )
    return order


URL_BLOCK_RE = re.compile(r"\s*<url>\s*<loc>([^<]+)</loc>(.*?)</url>", re.S)


def fix_sitemap(chg, arts, today):
    doc = SITEMAP.read_text(encoding="utf-8")
    new = doc
    present = set()

    def repl(m):
        loc = m.group(1).strip()
        present.add(loc)
        inner = m.group(2)
        want = None
        slug = loc.rsplit("/", 1)[-1]
        if loc.startswith(SITE + "/blog/") and slug in arts:
            want = arts[slug]["modified"] or arts[slug]["published"]
        elif loc == SITE + "/blog.html":
            want = max(
                (a["published"] for a in arts.values() if a["published"]), default=""
            )
        if want:
            cur = re.search(r"<lastmod>([^<]+)</lastmod>", inner)
            if cur and cur.group(1) < want:
                inner = inner.replace(cur.group(0), "<lastmod>%s</lastmod>" % want)
        return (
            m.group(0).replace(m.group(2), inner) if inner != m.group(2) else m.group(0)
        )

    new = URL_BLOCK_RE.sub(repl, new)
    dead = redirect_urls()
    removed = 0
    for loc in sorted(dead & present):
        new, n = re.subn(r"\n?\s*<url>\s*<loc>%s</loc>.*?</url>" % re.escape(loc), "", new, flags=re.S)
        removed += n
    add = []
    for slug, a in sorted(arts.items(), key=lambda kv: kv[1]["published"] or ""):
        if a["url"] not in present:
            add.append(
                "  <url>\n    <loc>%s</loc>\n    <lastmod>%s</lastmod>\n"
                "    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>\n"
                % (a["url"], a["modified"] or a["published"] or today)
            )
    if add:
        new = new.replace("</urlset>", "".join(add) + "</urlset>", 1)
    chg.set(SITEMAP, doc, new, "%d article url(s) added, %d redirect url(s) removed" % (len(add), removed))


def _rfc822(day):
    d = dt.datetime.strptime(day, "%Y-%m-%d").replace(hour=8, tzinfo=ET)
    return format_datetime(d)


def build_feed(arts, order, today):
    items = [a for a in newest_first(arts, order) if a["slug"] in set(order)][
        :FEED_ITEMS
    ]
    last = items[0]["published"] if items else today
    out = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">',
        "  <channel>",
        "    <title>Miami Alliance 3PL Blog: 3PL Services in Miami, Fulfillment and Logistics</title>",
        "    <link>%s/blog.html</link>" % SITE,
        '    <atom:link href="%s/feed.xml" rel="self" type="application/rss+xml" />'
        % SITE,
        "    <description>Guides and logistics news from Miami Alliance 3PL, a 3PL warehouse in Medley, Florida: "
        "3PL services in Miami, ecommerce fulfillment, Amazon FBA prep, wholesale distribution and Latin America trade.</description>",
        "    <language>en-us</language>",
        "    <lastBuildDate>%s</lastBuildDate>" % _rfc822(last),
        "    <generator>admin/site_index.py</generator>",
    ]
    for a in items:
        out += [
            "    <item>",
            "      <title>%s</title>" % html.escape(a["title"], quote=False),
            "      <link>%s</link>" % a["url"],
            '      <guid isPermaLink="true">%s</guid>' % a["url"],
            "      <pubDate>%s</pubDate>" % _rfc822(a["published"] or today),
            "      <dc:creator>Miami Alliance 3PL</dc:creator>",
        ]
        if a["section"]:
            out.append(
                "      <category>%s</category>" % html.escape(a["section"], quote=False)
            )
        out += [
            "      <description>%s</description>"
            % html.escape(a["description"], quote=False),
            "    </item>",
        ]
    out += ["  </channel>", "</rss>", ""]
    return "\n".join(out)


def build_ai_index(arts, order, today):
    items = [a for a in newest_first(arts, order) if a["slug"] in set(order)]
    lines = [
        "# Miami Alliance 3PL Article Index",
        "",
        "> Every original article on the Miami Alliance 3PL blog, newest first. Miami Alliance 3PL is a "
        "third-party logistics (3PL) warehouse at 8780 NW 100th ST, Medley, FL 33178 offering 3PL services in Miami: "
        "warehousing, ecommerce fulfillment, Amazon FBA prep, wholesale distribution and Latin America logistics.",
        "",
        "Generated from blog/*.html on %s by admin/site_index.py. RSS feed: %s/feed.xml"
        % (today, SITE),
        "",
        "Articles: %d" % len(items),
        "",
    ]
    for a in items:
        desc = re.sub(r"\s+", " ", a["description"]).strip()
        lines.append(
            "- %s · [%s](%s)%s"
            % (
                a["published"] or "undated",
                a["title"],
                a["url"],
                (": " + desc) if desc else "",
            )
        )
    lines.append("")
    return "\n".join(lines)


LLMS_START = "<!-- latest-articles:start (maintained by admin/site_index.py) -->"
LLMS_END = "<!-- latest-articles:end -->"


def fix_llms(chg, arts, order, today):
    if not LLMS.exists():
        return
    doc = LLMS.read_text(encoding="utf-8")
    items = [a for a in newest_first(arts, order) if a["slug"] in set(order)][
        :LLMS_LATEST
    ]
    block = [
        LLMS_START,
        "## Latest Articles",
        "",
        "Newest original articles from the Miami Alliance 3PL blog. Full index of every article: "
        "[%s/ai/articles.md](%s/ai/articles.md). RSS: [%s/feed.xml](%s/feed.xml)."
        % (SITE, SITE, SITE, SITE),
        "",
    ]
    for a in items:
        desc = re.sub(r"\s+", " ", a["description"]).strip()
        block.append(
            "- [%s](%s): %s (published %s)"
            % (a["title"], a["url"], desc, a["published"] or "undated")
        )
    block += ["", LLMS_END]
    text = "\n".join(block)
    if LLMS_START in doc and LLMS_END in doc:
        head, rest = doc.split(LLMS_START, 1)
        _, tail = rest.split(LLMS_END, 1)
        new = head + text + tail
    elif "\n## Optional" in doc:
        new = doc.replace("\n## Optional", "\n" + text + "\n\n## Optional", 1)
    else:
        new = doc.rstrip("\n") + "\n\n" + text + "\n"
    chg.set(LLMS, doc, new, "Latest Articles block (%d)" % len(items))


AIS_START = "<!-- latest-articles:start (maintained by admin/site_index.py) -->"
AIS_END = "<!-- latest-articles:end -->"


def fix_ai_sitemap(chg, arts, order, today):
    if not SITEMAP_AI.exists():
        return
    doc = SITEMAP_AI.read_text(encoding="utf-8")
    items = [a for a in newest_first(arts, order) if a["slug"] in set(order)][
        :AI_SITEMAP_LATEST
    ]
    newest = items[0]["published"] if items else today
    parts = [
        "  " + AIS_START,
        "  <url>\n    <loc>%s/ai/articles.md</loc>\n    <lastmod>%s</lastmod>\n"
        "    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>"
        % (SITE, newest),
    ]
    for a in items:
        parts.append(
            "  <url>\n    <loc>%s</loc>\n    <lastmod>%s</lastmod>\n"
            "    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>"
            % (a["url"], a["modified"] or a["published"] or today)
        )
    parts.append("  " + AIS_END)
    text = "\n".join(parts)
    if AIS_START in doc and AIS_END in doc:
        head, rest = doc.split(AIS_START, 1)
        _, tail = rest.split(AIS_END, 1)
        # head already ends with the start marker's own indentation
        new = head + text.lstrip(" ") + tail
    else:
        new = doc.replace("</urlset>", text + "\n</urlset>", 1)
    chg.set(SITEMAP_AI, doc, new, "latest-articles block (%d)" % len(items))


def plan(today):
    chg = Change()
    arts = load_articles()
    order = fix_blog_hub(chg, arts)
    fix_sitemap(chg, arts, today)
    old_feed = FEED.read_text(encoding="utf-8") if FEED.exists() else ""
    chg.set(FEED, old_feed, build_feed(arts, order, today), "RSS feed")
    old_ai = AI_INDEX.read_text(encoding="utf-8") if AI_INDEX.exists() else ""
    new_ai = build_ai_index(arts, order, today)
    # The generated date alone is not a change.
    if re.sub(r"Generated from blog/\*\.html on \S+", "", old_ai) != re.sub(
        r"Generated from blog/\*\.html on \S+", "", new_ai
    ):
        chg.set(AI_INDEX, old_ai, new_ai, "AI article index")
    fix_llms(chg, arts, order, today)
    fix_ai_sitemap(chg, arts, order, today)
    return chg, arts, order


# --------------------------------------------------------------------------- IndexNow


def indexnow_key():
    """The key is published as /<key>.txt at the site root (IndexNow protocol)."""
    for p in sorted(ROOT.glob("*.txt")):
        if re.fullmatch(r"[0-9a-f]{32}", p.stem) and p.read_text().strip() == p.stem:
            return p.stem
    return ""


def indexnow_submit(urls):
    key = indexnow_key()
    urls = sorted({u for u in urls if u.startswith(SITE + "/") or u == SITE + "/"})
    if not key or not urls:
        print("indexnow: nothing to submit (key=%s, urls=%d)" % (bool(key), len(urls)))
        return 0
    body = json.dumps(
        {
            "host": HOST,
            "key": key,
            "keyLocation": "%s/%s.txt" % (SITE, key),
            "urlList": urls[:10000],
        }
    ).encode()
    req = urllib.request.Request(
        INDEXNOW_ENDPOINT,
        data=body,
        headers={
            "Content-Type": "application/json; charset=utf-8",
            "User-Agent": "miami3pl-site-index/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            print("indexnow: HTTP %s for %d url(s)" % (r.status, len(urls)))
            return 0 if r.status in (200, 202) else 1
    except urllib.error.HTTPError as e:
        print("indexnow: HTTP %s %s" % (e.code, e.reason))
        return 1
    except Exception as e:  # network
        print("indexnow: error %s" % e)
        return 1


def urls_for_paths(paths):
    out = set()
    for p in paths:
        p = p.strip()
        if not p or p.startswith(
            (
                ".github/",
                "admin/",
                "functions/",
                "portal/",
                "mcp/",
                "tests/",
                "scripts/",
            )
        ):
            continue
        if p.endswith(".html"):
            out.add(SITE + "/" if p == "index.html" else "%s/%s" % (SITE, p))
        elif p in ("llms.txt", "llms-full.txt", "feed.xml") or p.startswith("ai/"):
            out.add("%s/%s" % (SITE, p))
    return out


def changed_paths(before, after):
    if not before or set(before) == {"0"}:
        r = subprocess.run(
            ["git", "-C", str(ROOT), "show", "--name-only", "--format=", after],
            capture_output=True,
            text=True,
        )
    else:
        r = subprocess.run(
            ["git", "-C", str(ROOT), "diff", "--name-only", before, after],
            capture_output=True,
            text=True,
        )
    return r.stdout.splitlines()


# --------------------------------------------------------------------------- main


def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--today", default=dt.datetime.now(ET).strftime("%Y-%m-%d"))
    ap.add_argument("--indexnow", nargs="*")
    ap.add_argument("--indexnow-diff", nargs=2, metavar=("BEFORE", "AFTER"))
    a = ap.parse_args()
    if a.indexnow is not None:
        return indexnow_submit(a.indexnow)
    if a.indexnow_diff:
        return indexnow_submit(urls_for_paths(changed_paths(*a.indexnow_diff)))
    chg, arts, order = plan(a.today)
    for n in chg.notes:
        print(n)
    if not chg.files:
        print(
            "site index: up to date (%d articles, %d carded)" % (len(arts), len(order))
        )
        return 0
    if a.check:
        print("site index: %d file(s) out of date" % len(chg.files))
        return 1
    if a.apply:
        for path, text in chg.files.items():
            path.parent.mkdir(parents=True, exist_ok=True)
            tmp = path.with_suffix(path.suffix + ".tmp")
            tmp.write_text(text, encoding="utf-8")
            os.replace(tmp, path)
        print("site index: wrote %d file(s)" % len(chg.files))
    else:
        print(
            "site index: %d file(s) would change (dry run; use --apply)"
            % len(chg.files)
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
