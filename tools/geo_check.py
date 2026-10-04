#!/usr/bin/env python3
"""GEO hygiene checks for miamialliance3pl.com: what AI search crawlers can fetch and quote.

ADDED 2026-10-04 (geo-a-onsite). Standard library only; runs on Python 3.9+.

usage:
  python3 tools/geo_check.py                       # every check, repo = parent of tools/
  python3 tools/geo_check.py --only robots,links   # some checks
  python3 tools/geo_check.py --house-facts PATH    # also cross-check the hours source with house_facts.json

checks:
  jsonld  every <script type="application/ld+json"> in the public HTML parses, and every @type
          in it is a schema.org type (KNOWN_TYPES)
  robots  each crawler in OWN_GROUP has a group of its own; for that group, the "*" group and
          Googlebot, the MUST_ALLOW paths are allowed and the internal files of this tree are
          disallowed (RFC 9309 matching); no group repeats a rule line
  links   every internal href in the public HTML resolves to a file (GitHub Pages resolution)
  hours   every opening-hours statement in the JSON-LD equals the hours line of
          ai/miami-alliance-3pl-facts.md
  llms    every site URL in llms.txt, llms-full.txt and ai/*.md resolves to a file, and an
          llms.txt link whose description promises pricing points to a page that shows a $ figure
  lead    each LEAD_PAGES page names "Miami Alliance 3PL" in the first two sentences after its
          H1 (the warehouse-scope notice is not counted)

exit: 0 every check passed, 1 a check failed, 2 usage error
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from html.parser import HTMLParser
from urllib.parse import unquote, urlparse

SITE_HOSTS = ("miamialliance3pl.com", "www.miamialliance3pl.com")
ENTITY = "Miami Alliance 3PL"

# Top-level folders that are not public pages (robots.txt disallows them, nothing links to them).
PRIVATE_DIRS = (
    "portal",
    "admin",
    "functions",
    "docs",
    "tests",
    "scripts",
    "skills",
    "games",
    "node_modules",
    "tools",
    ".git",
    ".github",
)

# Every type below returned HTTP 200 at https://schema.org/<Type> on 2026-10-04T21:56Z, except
# PropertyValue (added for index.html's floor size), checked the same way at 22:17Z.
# "Warehouse" returned 404 (no such schema.org type). Add a type only after checking its page.
KNOWN_TYPES = frozenset(
    """
AboutPage AggregateRating Answer Article BlogPosting Brand BreadcrumbList City CollectionPage
ContactPage ContactPoint Country DigitalDocument EntryPoint FAQPage GeoCoordinates ImageObject
ItemList ListItem LocalBusiness LocationFeatureSpecification NewsArticle Offer OfferCatalog
OpeningHoursSpecification Organization Person Place PostalAddress PriceSpecification Product
ProfessionalService PropertyValue QuantitativeValue Question Rating Review SearchAction Service
ServiceChannel SpeakableSpecification State Thing WebApplication WebPage WebSite
""".split()
)

# Crawlers that must have a robots.txt group of their own, each documented by its vendor
# (fetched 2026-10-04): OpenAI platform.openai.com/docs/bots; Anthropic support.claude.com
# article 8896518; Perplexity docs.perplexity.ai/guides/bots; Google developers.google.com/
# search/docs/crawling-indexing/google-common-crawlers; Apple support.apple.com/en-us/119829;
# DuckDuckGo duckduckgo.com/duckduckgo-help-pages/results/duckassistbot; Mistral docs.mistral.ai/robots.
OWN_GROUP = (
    "OAI-SearchBot",
    "ChatGPT-User",
    "GPTBot",
    "Claude-SearchBot",
    "Claude-User",
    "ClaudeBot",
    "PerplexityBot",
    "Perplexity-User",
    "Google-Extended",
    "Applebot",
    "Applebot-Extended",
    "Bingbot",
    "DuckAssistBot",
    "MistralAI-User",
)

MUST_ALLOW = (
    "/",
    "/index.html",
    "/services.html",
    "/blog.html",
    "/llms.txt",
    "/llms-full.txt",
    "/ai/articles.md",
    "/ai/miami-alliance-3pl-facts.md",
    "/sitemap.xml",
    "/blog/what-is-a-3pl-warehouse.html",
)

# Root-level files with these extensions are internal notes and scripts, never public answers.
INTERNAL_ROOT_EXT = (".md", ".py")
INTERNAL_ROOT_FILES = ("firebase.json", "firestore.rules", "firestore.indexes.json")

# Commercial pages whose opening already names the company, plus the two this package fixed
# (services.html, amazon-fba-prep-miami.html). faq, quote, about, contact, 3pl-for-factories,
# gaming and mercadolibre still open without it: listed in the audit, not enforced here.
LEAD_PAGES = (
    "index.html",
    "services.html",
    "amazon-3pl-miami.html",
    "amazon-fba-prep-miami.html",
    "latam-distribution-miami.html",
    "wholesale-3pl.html",
    "twic-portmiami-port-everglades-pickup-delivery.html",
    "tiktok-shop-fulfillment-miami.html",
    "dropshipping-fulfillment-miami.html",
    "3pl-for-brands.html",
)

HOURS_SOURCE = "ai/miami-alliance-3pl-facts.md"
HOURS_RX = re.compile(
    r"Monday-Friday\s+(\d{1,2})(AM|PM)-(\d{1,2})(AM|PM)\s+EST(?:,|\s+and)\s+"
    r"Saturday\s+(\d{1,2})(AM|PM)-(\d{1,2})(AM|PM)\s+EST"
)
WEEK = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
ABBR = {
    "Mo": "Monday",
    "Tu": "Tuesday",
    "We": "Wednesday",
    "Th": "Thursday",
    "Fr": "Friday",
    "Sa": "Saturday",
    "Su": "Sunday",
}

BLOCK_TAGS = {
    "p",
    "div",
    "li",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "tr",
    "td",
    "th",
    "section",
    "article",
    "header",
    "footer",
    "nav",
    "aside",
    "ul",
    "ol",
    "br",
    "summary",
    "details",
}
SKIP_TAGS = {"script", "style", "template", "svg", "noscript", "head"}


class UsageError(Exception):
    pass


# --------------------------------------------------------------------------- tree helpers


def public_html(root):
    """Repo-relative paths of the public HTML pages, sorted."""
    out = []
    for dp, dn, fn in os.walk(root):
        rel = os.path.relpath(dp, root)
        top = rel.split(os.sep)[0]
        if top in PRIVATE_DIRS:
            dn[:] = []
            continue
        for f in fn:
            if f.endswith(".html"):
                out.append(
                    f if rel == "." else os.path.join(rel, f).replace(os.sep, "/")
                )
    return sorted(out)


def read(root, rel):
    with open(os.path.join(root, rel), encoding="utf-8", errors="replace") as fh:
        return fh.read()


def resolve_href(page, href):
    """Site path an href points to, or None when it leaves the site or is not a page link."""
    h = href.strip()
    if not h or h.startswith(("#", "mailto:", "tel:", "javascript:", "data:", "sms:")):
        return None
    u = urlparse(h)
    if u.scheme in ("http", "https"):
        if u.netloc not in SITE_HOSTS:
            return None
        path = u.path or "/"
    elif u.scheme:
        return None
    else:
        if not u.path:
            return None
        path = u.path
        if not path.startswith("/"):
            base = os.path.dirname(page)
            joined = os.path.normpath(os.path.join("/", base, path)).replace(
                os.sep, "/"
            )
            path = joined + ("/" if path.endswith("/") and joined != "/" else "")
    return unquote(path)


def path_exists(root, path):
    """GitHub Pages: /x serves x, x.html or x/index.html; /x/ serves x/index.html."""
    p = path.lstrip("/")
    if p == "":
        return os.path.isfile(os.path.join(root, "index.html"))
    if path.endswith("/"):
        return os.path.isfile(os.path.join(root, p, "index.html"))
    return any(
        os.path.isfile(os.path.join(root, c))
        for c in (p, p + ".html", p + "/index.html")
    )


class Page(HTMLParser):
    """Links, JSON-LD blocks and the no-JavaScript text of one page."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links = []  # (href, line)
        self.ld = []  # (line, raw json text)
        self.chunks = []  # visible text pieces; "\n" marks a block boundary
        self.h1_end = None  # index in chunks where the first </h1> closed
        self._skip = 0
        self._ld = None
        self._ld_line = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "a" and a.get("href"):
            self.links.append((a["href"], self.getpos()[0]))
        if tag == "script" and (a.get("type") or "").lower() == "application/ld+json":
            self._ld = []
            self._ld_line = self.getpos()[0]
        if tag in SKIP_TAGS:
            self._skip += 1
        if tag in BLOCK_TAGS:
            self.chunks.append("\n")

    def handle_startendtag(self, tag, attrs):
        if tag in BLOCK_TAGS:
            self.chunks.append("\n")

    def handle_endtag(self, tag):
        if tag == "script" and self._ld is not None:
            self.ld.append((self._ld_line, "".join(self._ld)))
            self._ld = None
        if tag in SKIP_TAGS and self._skip:
            self._skip -= 1
        if tag in BLOCK_TAGS:
            self.chunks.append("\n")
        if tag == "h1" and self.h1_end is None:
            self.h1_end = len(self.chunks)

    def handle_data(self, data):
        if self._ld is not None:
            self._ld.append(data)
        elif not self._skip:
            self.chunks.append(data)


def parse_page(src):
    p = Page()
    p.feed(src)
    p.close()
    return p


def blocks(chunks):
    """Visible text split into whitespace-normalised blocks."""
    return [b for b in (" ".join(x.split()) for x in "".join(chunks).split("\n")) if b]


def walk_json(node, fn):
    if isinstance(node, dict):
        fn(node)
        for v in node.values():
            walk_json(v, fn)
    elif isinstance(node, list):
        for v in node:
            walk_json(v, fn)


# --------------------------------------------------------------------------- checks


def check_jsonld(root):
    problems, n = [], 0
    for rel in public_html(root):
        for line, raw in parse_page(read(root, rel)).ld:
            n += 1
            try:
                data = json.loads(raw)
            except ValueError as e:
                problems.append("%s:%d  JSON-LD does not parse: %s" % (rel, line, e))
                continue
            bad = []

            def note(d, bad=bad):
                t = d.get("@type")
                for name in [t] if isinstance(t, str) else (t or []):
                    if name not in KNOWN_TYPES:
                        bad.append(name)

            walk_json(data, note)
            for name in bad:
                problems.append(
                    "%s:%d  @type %r is not a schema.org type in KNOWN_TYPES "
                    "(check https://schema.org/%s)" % (rel, line, name, name)
                )
    return n, problems


def parse_robots(text):
    """RFC 9309 groups: [(agents lower-case list, [(kind, pattern, line)])]."""
    groups, agents, rules, last = [], [], [], None
    for i, raw in enumerate(text.splitlines(), 1):
        line = raw.split("#", 1)[0].strip()
        if ":" not in line:
            continue
        key, val = (s.strip() for s in line.split(":", 1))
        key = key.lower()
        if key == "user-agent":
            if last == "rule":
                groups.append((agents, rules))
                agents, rules = [], []
            agents.append(val.lower())
            last = "agent"
        elif key in ("allow", "disallow") and agents:
            rules.append((key, val, i))
            last = "rule"
    if agents:
        groups.append((agents, rules))
    return groups


def rules_for(groups, agent):
    """Rules a crawler obeys: every group naming its token, else every "*" group."""
    token = agent.lower()
    mine = [r for a, rs in groups if token in a for r in rs]
    if mine:
        return mine
    return [r for a, rs in groups if "*" in a for r in rs]


def _pattern_rx(pattern):
    end = pattern.endswith("$")
    body = pattern[:-1] if end else pattern
    return re.compile(
        "".join(".*" if c == "*" else re.escape(c) for c in body) + ("$" if end else "")
    )


def allowed(rules, path):
    """Longest matching pattern wins; an Allow wins a tie; no match = allowed (RFC 9309 2.2.2)."""
    best_len, verdict = -1, True
    for kind, pattern, _ in rules:
        if pattern == "":
            continue
        if _pattern_rx(pattern).match(path):
            if len(pattern) > best_len or (
                len(pattern) == best_len and kind == "allow"
            ):
                best_len, verdict = len(pattern), (kind == "allow")
    return verdict


def internal_paths(root):
    """Paths that must be disallowed: root notes/scripts/config + one file per private folder."""
    out = []
    for f in sorted(os.listdir(root)):
        full = os.path.join(root, f)
        if os.path.isfile(full) and (
            f.endswith(INTERNAL_ROOT_EXT) or f in INTERNAL_ROOT_FILES
        ):
            out.append("/" + f)
    for d in ("portal", "admin", "functions", "docs", "tests", "scripts", "skills"):
        top = os.path.join(root, d)
        if os.path.isdir(top):
            for dp, dn, fn in sorted(os.walk(top)):
                files = sorted(fn)
                if files:
                    out.append(
                        "/"
                        + os.path.relpath(os.path.join(dp, files[0]), root).replace(
                            os.sep, "/"
                        )
                    )
                    break
    return out


def check_robots(root):
    path = os.path.join(root, "robots.txt")
    if not os.path.isfile(path):
        return 0, ["robots.txt  missing"]
    groups = parse_robots(read(root, "robots.txt"))
    problems = []
    named = {a for agents, _ in groups for a in agents}
    for agent in OWN_GROUP:
        if agent.lower() not in named:
            problems.append(
                "robots.txt  no group of its own for %s (it falls back to the * group)"
                % agent
            )
    internal = internal_paths(root)
    checked = 0
    blocked, open_ = {}, {}  # path -> agents that get it wrong
    for agent in OWN_GROUP + ("*", "Googlebot"):
        rules = rules_for(groups, agent)
        for p in MUST_ALLOW:
            checked += 1
            if not allowed(rules, p):
                blocked.setdefault(p, []).append(agent)
        for p in internal:
            checked += 1
            if allowed(rules, p):
                open_.setdefault(p, []).append(agent)
    for p in MUST_ALLOW:
        if p in blocked:
            problems.append(
                "robots.txt  %s is disallowed for %s" % (p, ", ".join(blocked[p]))
            )
    for p in internal:
        if p in open_:
            problems.append(
                "robots.txt  internal file %s is allowed for %d agent(s): %s"
                % (p, len(open_[p]), ", ".join(open_[p]))
            )
    for agents, rules in groups:
        seen = {}
        for kind, pattern, line in rules:
            key = (kind, pattern)
            if key in seen:
                problems.append(
                    "robots.txt:%d  %s: %s repeats line %d in the group for %s"
                    % (line, kind.title(), pattern, seen[key], ", ".join(agents))
                )
            else:
                seen[key] = line
    return checked, problems


def check_links(root):
    problems, n = [], 0
    for rel in public_html(root):
        for href, line in parse_page(read(root, rel)).links:
            target = resolve_href(rel, href)
            if target is None:
                continue
            n += 1
            if not path_exists(root, target):
                problems.append(
                    "%s:%d  link %s -> %s does not exist" % (rel, line, href, target)
                )
    return n, problems


def _clock(h, ampm):
    h = int(h) % 12 + (12 if ampm == "PM" else 0)
    return "%02d:00" % h


def hours_from_text(text, where):
    m = HOURS_RX.search(text)
    if not m:
        raise UsageError(
            "%s: no 'Monday-Friday hAM-hPM EST, Saturday hAM-hPM EST' line" % where
        )
    wk_o, wk_c, sa_o, sa_c = (_clock(m.group(i), m.group(i + 1)) for i in (1, 3, 5, 7))
    want = {(d, wk_o, wk_c) for d in WEEK[:5]}
    want.add(("Saturday", sa_o, sa_c))
    return want


def _hhmm(v):
    m = re.match(r"(\d{1,2}):(\d{2})", str(v or ""))
    return "%02d:%s" % (int(m.group(1)), m.group(2)) if m else str(v)


def hours_from_node(node):
    """Set of (day, opens, closes) a JSON-LD node states, or None when it states none."""
    got, stated = set(), False
    spec = node.get("openingHoursSpecification")
    if spec is not None:
        stated = True
        for s in spec if isinstance(spec, list) else [spec]:
            days = s.get("dayOfWeek") if isinstance(s, dict) else None
            for d in days if isinstance(days, list) else [days]:
                got.add(
                    (
                        str(d).rsplit("/", 1)[-1],
                        _hhmm(s.get("opens")),
                        _hhmm(s.get("closes")),
                    )
                )
    text = node.get("openingHours")
    if text is not None:
        stated = True
        for item in text if isinstance(text, list) else [text]:
            m = re.match(
                r"\s*([A-Za-z,\- ]+?)\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})\s*$", str(item)
            )
            if not m:
                got.add(("unparsed", str(item), ""))
                continue
            for part in m.group(1).replace(" ", "").split(","):
                ends = part.split("-")
                if not all(e in ABBR for e in ends):
                    got.add(("unparsed", str(item), ""))
                    continue
                i, j = WEEK.index(ABBR[ends[0]]), WEEK.index(ABBR[ends[-1]])
                for d in WEEK[i : j + 1]:
                    got.add((d, _hhmm(m.group(2)), _hhmm(m.group(3))))
    return got if stated else None


def check_hours(root, house_facts=None):
    src = os.path.join(root, HOURS_SOURCE)
    if not os.path.isfile(src):
        return 0, ["%s  missing (it is the hours source)" % HOURS_SOURCE]
    want = hours_from_text(read(root, HOURS_SOURCE), HOURS_SOURCE)
    problems, n = [], 0
    if house_facts:
        with open(house_facts, encoding="utf-8") as fh:
            facts = json.load(fh)
        text = " ".join(
            f.get("text", "") for f in facts.get("facts", []) if f.get("id") == "hours"
        )
        if hours_from_text(text, house_facts) != want:
            problems.append(
                "%s  hours differ from house_facts.json 'hours' fact" % HOURS_SOURCE
            )
    for rel in public_html(root):
        for line, raw in parse_page(read(root, rel)).ld:
            try:
                data = json.loads(raw)
            except ValueError:
                continue  # reported by the jsonld check
            found = []
            walk_json(
                data,
                lambda d: found.append(d) if hours_from_node(d) is not None else None,
            )
            for node in found:
                n += 1
                got = hours_from_node(node)
                if got != want:
                    missing = sorted(want - got)
                    extra = sorted(got - want)
                    problems.append(
                        "%s:%d  %r hours differ from %s: missing %s, extra %s"
                        % (rel, line, node.get("name"), HOURS_SOURCE, missing, extra)
                    )
    return n, problems


def visible_text(src):
    return " ".join(blocks(parse_page(src).chunks))


def check_llms(root):
    problems, n = [], 0
    files = [
        f
        for f in ("llms.txt", "llms-full.txt")
        if os.path.isfile(os.path.join(root, f))
    ]
    if os.path.isdir(os.path.join(root, "ai")):
        files += [
            "ai/" + f
            for f in sorted(os.listdir(os.path.join(root, "ai")))
            if f.endswith(".md")
        ]
    url_rx = re.compile(r"https://(?:www\.)?miamialliance3pl\.com(/[^\s)<>\"\]]*)?")
    for rel in files:
        for i, line in enumerate(read(root, rel).splitlines(), 1):
            for m in url_rx.finditer(line):
                n += 1
                path = (m.group(1) or "/").rstrip(".,;:")
                if not path_exists(root, unquote(urlparse(path).path)):
                    problems.append(
                        "%s:%d  %s does not exist in the tree" % (rel, i, m.group(0))
                    )
    bullet = re.compile(
        r"^- \[[^\]]+\]\((https://miamialliance3pl\.com/[^)]*)\):\s*(.*)$"
    )
    if "llms.txt" in files:
        for i, line in enumerate(read(root, "llms.txt").splitlines(), 1):
            m = bullet.match(line)
            if not m or not re.search(r"(?i)\bpric", m.group(2)):
                continue
            target = urlparse(m.group(1)).path.lstrip("/") or "index.html"
            if target.endswith("/"):
                target += "index.html"
            full = os.path.join(root, target)
            if os.path.isfile(full) and not re.search(
                r"\$\s?\d", visible_text(read(root, target))
            ):
                problems.append(
                    "llms.txt:%d  promises pricing but %s shows no $ figure without JavaScript"
                    % (i, target)
                )
    return n, problems


def lead_sentences(src, count=2):
    """First `count` sentences after the H1, without the warehouse-scope notice."""
    src = re.sub(r'<aside class="warehouse-scope[^"]*".*?</aside>', "", src, flags=re.S)
    p = parse_page(src)
    if p.h1_end is None:
        return []
    out = []
    for b in blocks(p.chunks[p.h1_end :]):
        if len(b) < 40:
            continue  # badges, buttons and stat labels are not sentences
        out.extend(s for s in re.split(r"(?<=[.!?])\s+", b) if s)
        if len(out) >= count:
            break
    return out[:count]


def check_lead(root):
    problems = []
    for rel in LEAD_PAGES:
        if not os.path.isfile(os.path.join(root, rel)):
            problems.append("%s  missing (listed in LEAD_PAGES)" % rel)
            continue
        lead = lead_sentences(read(root, rel))
        if not any(ENTITY in s for s in lead):
            problems.append(
                "%s  first two sentences after the H1 do not name %s: %r"
                % (rel, ENTITY, " | ".join(lead)[:220])
            )
    return len(LEAD_PAGES), problems


CHECKS = {
    "jsonld": check_jsonld,
    "robots": check_robots,
    "links": check_links,
    "hours": check_hours,
    "llms": check_llms,
    "lead": check_lead,
}


def run(root, only=None, house_facts=None, out=sys.stdout):
    """Run the named checks; return the number that failed."""
    names = only or list(CHECKS)
    failed = 0
    for name in names:
        fn = CHECKS[name]
        n, problems = fn(root, house_facts) if name == "hours" else fn(root)
        if problems:
            failed += 1
            out.write(
                "FAIL %s: %d problem(s) in %d item(s) checked\n"
                % (name, len(problems), n)
            )
            for p in problems:
                out.write("  %s\n" % p)
        else:
            out.write("PASS %s (%d item(s) checked)\n" % (name, n))
    out.write("geo_check: %d/%d checks passed\n" % (len(names) - failed, len(names)))
    return failed


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument(
        "--root",
        default=os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        help="site tree (default: the repo this script lives in)",
    )
    ap.add_argument("--only", help="comma-separated subset of: " + ",".join(CHECKS))
    ap.add_argument(
        "--house-facts", help="house_facts.json to cross-check the hours source with"
    )
    a = ap.parse_args(argv)
    try:
        if not os.path.isdir(a.root):
            raise UsageError("--root %r is not a directory" % a.root)
        only = None
        if a.only:
            only = [s.strip() for s in a.only.split(",") if s.strip()]
            unknown = [s for s in only if s not in CHECKS]
            if unknown or not only:
                raise UsageError(
                    "--only: unknown check(s) %s; choose from %s"
                    % (unknown or [a.only], ", ".join(CHECKS))
                )
        if a.house_facts and not os.path.isfile(a.house_facts):
            raise UsageError("--house-facts %r is not a file" % a.house_facts)
        return 1 if run(a.root, only, a.house_facts) else 0
    except UsageError as e:
        sys.stderr.write("geo_check: %s\n" % e)
        return 2


if __name__ == "__main__":
    sys.exit(main())
