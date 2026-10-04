#!/usr/bin/env python3
"""Tests for tools/geo_check.py. ADDED 2026-10-04 (geo-a-onsite).

run: python3 tools/test_geo_check.py      (standard library unittest, Python 3.9+)
"""

from __future__ import annotations

import io
import json
import os
import shutil
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import geo_check as g  # noqa: E402

GOOD_RULES = """Allow: /
Disallow: /portal/
Disallow: /admin/
Disallow: /*.md$
Allow: /ai/*.md$
Disallow: /*.py$
Disallow: /firebase.json
"""

HOURS_MD = "- Hours: Monday-Friday 8AM-6PM EST, Saturday 9AM-2PM EST\n"
# 8AM -> 08:00, 6PM -> 18:00, 9AM -> 09:00, 2PM -> 14:00 (12-hour clock + 12 for PM)
WANT = {
    ("Monday", "08:00", "18:00"),
    ("Tuesday", "08:00", "18:00"),
    ("Wednesday", "08:00", "18:00"),
    ("Thursday", "08:00", "18:00"),
    ("Friday", "08:00", "18:00"),
    ("Saturday", "09:00", "14:00"),
}
SPEC_OK = [
    {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        "opens": "08:00",
        "closes": "18:00",
    },
    {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": "Saturday",
        "opens": "09:00",
        "closes": "14:00",
    },
]


def robots_text(agents, rules=GOOD_RULES, star_extra=""):
    parts = ["User-agent: *\n" + rules + star_extra]
    parts += ["User-agent: %s\n%s" % (a, rules) for a in agents]
    return "\n".join(parts)


def page(body, ld=None, title="T"):
    lds = "".join(
        '<script type="application/ld+json">%s</script>'
        % (x if isinstance(x, str) else json.dumps(x))
        for x in (ld or [])
    )
    return "<html><head><title>%s</title>%s</head><body>%s</body></html>" % (
        title,
        lds,
        body,
    )


class Tree:
    """A throw-away site tree."""

    def __init__(self):
        self.root = tempfile.mkdtemp(prefix="geo_check_test_")

    def write(self, rel, text):
        full = os.path.join(self.root, rel)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        with open(full, "w", encoding="utf-8") as fh:
            fh.write(text)

    def close(self):
        shutil.rmtree(self.root)


def passing_tree(lead_pages=("index.html",)):
    t = Tree()
    t.write("robots.txt", robots_text(g.OWN_GROUP))
    t.write(g.HOURS_SOURCE, HOURS_MD)
    t.write("CLAUDE.md", "internal")
    t.write("admin/x.py", "pass")
    lead = "<p>Miami Alliance 3PL is a third-party logistics (3PL) warehouse in Medley, FL.</p>"
    for p in (
        "index.html",
        "services.html",
        "blog.html",
        "blog/what-is-a-3pl-warehouse.html",
    ):
        t.write(
            p,
            page(
                "<h1>H</h1>" + lead + '<a href="/services.html">s</a>',
                ld=[
                    {
                        "@context": "https://schema.org",
                        "@type": "LocalBusiness",
                        "openingHoursSpecification": SPEC_OK,
                    }
                ],
            ),
        )
    for p in ("llms.txt", "llms-full.txt", "sitemap.xml", "ai/articles.md"):
        t.write(p, "https://miamialliance3pl.com/services.html\n")
    for p in lead_pages:
        if not os.path.exists(os.path.join(t.root, p)):
            t.write(p, page("<h1>H</h1>" + lead))
    return t


class RobotsMatching(unittest.TestCase):
    def rules(self, text):
        return g.rules_for(g.parse_robots("User-agent: *\n" + text), "*")

    def test_longest_match_wins(self):
        r = self.rules(GOOD_RULES)
        self.assertFalse(g.allowed(r, "/CLAUDE.md"))  # /*.md$ (6 chars) beats / (1)
        self.assertTrue(
            g.allowed(r, "/ai/articles.md")
        )  # /ai/*.md$ (10) beats /*.md$ (6)
        self.assertTrue(g.allowed(r, "/index.html"))
        self.assertFalse(g.allowed(r, "/portal/x.html"))

    def test_tie_goes_to_allow(self):
        r = self.rules("Disallow: /a\nAllow: /a\n")
        self.assertTrue(g.allowed(r, "/a"))
        r = self.rules("Allow: /a\nDisallow: /a\n")
        self.assertTrue(g.allowed(r, "/a"))

    def test_dollar_anchors_the_end(self):
        r = self.rules("Disallow: /*.md$\n")
        self.assertFalse(g.allowed(r, "/x.md"))
        self.assertTrue(g.allowed(r, "/x.mdx"))
        self.assertTrue(g.allowed(r, "/x.md?y=1"))

    def test_empty_disallow_and_no_match_allow(self):
        self.assertTrue(g.allowed(self.rules("Disallow:\n"), "/anything"))
        self.assertTrue(g.allowed([], "/anything"))

    def test_query_rule(self):
        r = self.rules("Allow: /\nDisallow: /*?*\n")
        self.assertFalse(g.allowed(r, "/quote.html?source=x"))
        self.assertTrue(g.allowed(r, "/quote.html"))

    def test_groups_and_fallback(self):
        groups = g.parse_robots(
            "User-agent: A\nUser-agent: B\nDisallow: /x\n"
            "User-agent: *\nDisallow: /y\n# comment\nUser-agent: C\nDisallow: /z\n"
        )
        self.assertEqual(len(groups), 3)
        self.assertEqual(groups[0][0], ["a", "b"])
        self.assertFalse(g.allowed(g.rules_for(groups, "b"), "/x"))
        self.assertTrue(
            g.allowed(g.rules_for(groups, "B"), "/y")
        )  # case-insensitive token
        self.assertFalse(
            g.allowed(g.rules_for(groups, "Other"), "/y")
        )  # falls back to *
        self.assertFalse(g.allowed(g.rules_for(groups, "c"), "/z"))


class RobotsCheck(unittest.TestCase):
    def setUp(self):
        self.t = passing_tree()

    def tearDown(self):
        self.t.close()

    def test_passing(self):
        n, problems = g.check_robots(self.t.root)
        self.assertEqual(problems, [])
        # 16 agents (14 OWN_GROUP + "*" + Googlebot) x (10 MUST_ALLOW + 2 internal: /CLAUDE.md, /admin/x.py)
        self.assertEqual(len(g.OWN_GROUP), 14)
        self.assertEqual(len(g.MUST_ALLOW), 10)
        self.assertEqual(n, 16 * (10 + 2))

    def test_missing_group(self):
        self.t.write(
            "robots.txt",
            robots_text([a for a in g.OWN_GROUP if a != "Perplexity-User"]),
        )
        _, problems = g.check_robots(self.t.root)
        self.assertIn(
            "robots.txt  no group of its own for Perplexity-User (it falls back to the * group)",
            problems,
        )

    def test_internal_file_open(self):
        self.t.write(
            "robots.txt",
            robots_text(g.OWN_GROUP, rules="Allow: /\nDisallow: /admin/\n"),
        )
        _, problems = g.check_robots(self.t.root)
        self.assertTrue(
            any(
                "internal file /CLAUDE.md is allowed for 16 agent(s)" in p
                for p in problems
            )
        )
        self.assertFalse(any("/admin/x.py" in p for p in problems))

    def test_must_allow_blocked(self):
        self.t.write(
            "robots.txt", robots_text(g.OWN_GROUP, star_extra="Disallow: /llms.txt\n")
        )
        _, problems = g.check_robots(self.t.root)
        self.assertEqual(
            problems, ["robots.txt  /llms.txt is disallowed for *, Googlebot"]
        )

    def test_duplicate_rule(self):
        self.t.write(
            "robots.txt", robots_text(g.OWN_GROUP, star_extra="Disallow: /portal/\n")
        )
        _, problems = g.check_robots(self.t.root)
        self.assertEqual(
            problems,
            ["robots.txt:9  Disallow: /portal/ repeats line 3 in the group for *"],
        )

    def test_missing_file(self):
        os.remove(os.path.join(self.t.root, "robots.txt"))
        self.assertEqual(g.check_robots(self.t.root), (0, ["robots.txt  missing"]))


class Links(unittest.TestCase):
    def setUp(self):
        self.t = Tree()
        self.t.write("b.html", "x")
        self.t.write("c/index.html", "x")
        self.t.write("blog/p.html", "x")

    def tearDown(self):
        self.t.close()

    def test_resolution(self):
        root = self.t.root
        self.assertTrue(
            g.path_exists(root, g.resolve_href("a.html", "b"))
        )  # /b -> b.html
        self.assertTrue(
            g.path_exists(root, g.resolve_href("a.html", "c/"))
        )  # /c/ -> c/index.html
        self.assertTrue(
            g.path_exists(root, g.resolve_href("a.html", "c"))
        )  # /c -> c/index.html
        self.assertTrue(g.path_exists(root, g.resolve_href("blog/p.html", "../b.html")))
        self.assertTrue(
            g.path_exists(root, g.resolve_href("blog/p.html", "p.html?x=1#y"))
        )
        self.assertTrue(
            g.path_exists(
                root, g.resolve_href("a.html", "https://miamialliance3pl.com/b")
            )
        )
        self.assertFalse(
            g.path_exists(root, g.resolve_href("a.html", "b/"))
        )  # no b/index.html
        for href in (
            "#top",
            "mailto:a@b.c",
            "tel:1",
            "https://other.example/x",
            "javascript:void(0)",
            "",
        ):
            self.assertIsNone(g.resolve_href("a.html", href))

    def test_check(self):
        self.t.write(
            "a.html", page('<a href="b.html">ok</a>\n<a href="gone.html">bad</a>')
        )
        n, problems = g.check_links(self.t.root)
        self.assertEqual(n, 2)
        self.assertEqual(
            problems, ["a.html:2  link gone.html -> /gone.html does not exist"]
        )

    def test_private_dirs_skipped(self):
        self.t.write("portal/x.html", page('<a href="gone.html">bad</a>'))
        self.assertEqual(g.check_links(self.t.root), (0, []))


class Hours(unittest.TestCase):
    def test_source_line(self):
        self.assertEqual(g.hours_from_text(HOURS_MD, "x"), WANT)
        self.assertEqual(
            g.hours_from_text(
                "Monday-Friday 8AM-6PM EST and Saturday 9AM-2PM EST.", "x"
            ),
            WANT,
        )

    def test_noon_and_midnight(self):
        got = g.hours_from_text(
            "Monday-Friday 12AM-12PM EST, Saturday 11AM-1PM EST", "x"
        )
        self.assertIn(("Monday", "00:00", "12:00"), got)  # 12AM = 00:00, 12PM = 12:00
        self.assertIn(("Saturday", "11:00", "13:00"), got)  # 1PM = 13:00

    def test_source_without_line(self):
        with self.assertRaises(g.UsageError):
            g.hours_from_text("Hours: by appointment", "x")

    def test_node_forms(self):
        self.assertIsNone(g.hours_from_node({"name": "x"}))
        self.assertEqual(
            g.hours_from_node({"openingHoursSpecification": SPEC_OK}), WANT
        )
        self.assertEqual(
            g.hours_from_node({"openingHours": ["Mo-Fr 8:00-18:00", "Sa 09:00-14:00"]}),
            WANT,
        )
        self.assertEqual(
            g.hours_from_node({"openingHours": "Mo-Fr 08:00-18:00"}),
            WANT - {("Saturday", "09:00", "14:00")},
        )
        self.assertEqual(
            g.hours_from_node(
                {
                    "openingHoursSpecification": {
                        "dayOfWeek": "https://schema.org/Saturday",
                        "opens": "09:00",
                        "closes": "14:00",
                    }
                }
            ),
            {("Saturday", "09:00", "14:00")},
        )
        self.assertIn(
            ("unparsed", "by appointment", ""),
            g.hours_from_node({"openingHours": "by appointment"}),
        )
        self.assertIn(
            ("unparsed", "Xx-Fr 08:00-18:00", ""),
            g.hours_from_node({"openingHours": "Xx-Fr 08:00-18:00"}),
        )

    def test_check(self):
        t = passing_tree()
        try:
            self.assertEqual(g.check_hours(t.root), (4, []))
            t.write(
                "blog/x.html",
                page(
                    "<h1>x</h1>",
                    ld=[
                        {
                            "@type": "LocalBusiness",
                            "name": "N",
                            "openingHours": "Mo-Fr 08:00-18:00",
                        }
                    ],
                ),
            )
            n, problems = g.check_hours(t.root)
            self.assertEqual(n, 5)
            self.assertEqual(
                problems,
                [
                    "blog/x.html:1  'N' hours differ from %s: missing "
                    "[('Saturday', '09:00', '14:00')], extra []" % g.HOURS_SOURCE
                ],
            )
        finally:
            t.close()

    def test_house_facts_cross_check(self):
        t = passing_tree()
        try:
            hf = os.path.join(t.root, "hf.json")
            with open(hf, "w") as fh:
                json.dump(
                    {
                        "facts": [
                            {
                                "id": "hours",
                                "text": "Business hours: Monday-Friday 8AM-6PM EST "
                                "and Saturday 9AM-2PM EST.",
                            }
                        ]
                    },
                    fh,
                )
            self.assertEqual(g.check_hours(t.root, hf)[1], [])
            with open(hf, "w") as fh:
                json.dump(
                    {
                        "facts": [
                            {
                                "id": "hours",
                                "text": "Monday-Friday 8AM-5PM EST and Saturday 9AM-2PM EST",
                            }
                        ]
                    },
                    fh,
                )
            self.assertEqual(
                g.check_hours(t.root, hf)[1],
                [
                    "%s  hours differ from house_facts.json 'hours' fact"
                    % g.HOURS_SOURCE
                ],
            )
        finally:
            t.close()


class JsonLd(unittest.TestCase):
    def test_check(self):
        t = Tree()
        try:
            t.write("a.html", page("x", ld=[{"@type": ["LocalBusiness", "Place"]}]))
            self.assertEqual(g.check_jsonld(t.root), (1, []))
            t.write(
                "b.html",
                page(
                    "x",
                    ld=['{"@type": "Place",}', {"@graph": [{"@type": "Warehouse"}]}],
                ),
            )
            n, problems = g.check_jsonld(t.root)
            self.assertEqual(n, 3)
            self.assertEqual(len(problems), 2)
            self.assertTrue(problems[0].startswith("b.html:1  JSON-LD does not parse"))
            self.assertIn("@type 'Warehouse' is not a schema.org type", problems[1])
        finally:
            t.close()

    def test_known_types_exclude_warehouse(self):
        self.assertNotIn("Warehouse", g.KNOWN_TYPES)
        self.assertIn("PropertyValue", g.KNOWN_TYPES)


class Llms(unittest.TestCase):
    def test_check(self):
        t = passing_tree()
        try:
            t.write("prep.html", page("<h1>Prep</h1><p>FBA prep in Miami.</p>"))
            t.write("priced.html", page("<h1>P</h1><p>Labels $0.30 per unit.</p>"))
            t.write(
                "llms.txt",
                "- [Prep](https://miamialliance3pl.com/prep.html): labels and prep pricing.\n"
                "- [Priced](https://miamialliance3pl.com/priced.html): prep pricing.\n"
                "- [Plain](https://miamialliance3pl.com/prep.html): labels.\n"
                "See https://miamialliance3pl.com/gone.html.\n",
            )
            n, problems = g.check_llms(t.root)
            self.assertEqual(
                problems,
                [
                    "llms.txt:4  https://miamialliance3pl.com/gone.html. does not exist in the tree",
                    "llms.txt:1  promises pricing but prep.html shows no $ figure without JavaScript",
                ],
            )
        finally:
            t.close()

    def test_price_only_in_script_does_not_count(self):
        t = passing_tree()
        try:
            t.write("prep.html", page("<h1>Prep</h1><script>var p='$0.30';</script>"))
            t.write(
                "llms.txt",
                "- [Prep](https://miamialliance3pl.com/prep.html): pricing.\n",
            )
            self.assertEqual(len(g.check_llms(t.root)[1]), 1)
        finally:
            t.close()


class Lead(unittest.TestCase):
    def test_sentences(self):
        src = page(
            "<h1>Title</h1><div>99.8% Accuracy</div>"
            "<p>Selling is hard. That's where we come in. At Miami Alliance 3PL, we prep.</p>"
        )
        self.assertEqual(
            g.lead_sentences(src), ["Selling is hard.", "That's where we come in."]
        )
        self.assertEqual(len(g.lead_sentences(src, count=3)), 3)
        self.assertEqual(g.lead_sentences(page("<p>no heading</p>")), [])

    def test_check(self):
        t = Tree()
        old = g.LEAD_PAGES
        try:
            g.LEAD_PAGES = ("ok.html", "late.html", "aside.html", "gone.html")
            t.write(
                "ok.html",
                page(
                    "<h1>T</h1><p>Short line.</p><p>Miami Alliance 3PL is a 3PL warehouse in Medley, FL.</p>"
                ),
            )
            t.write(
                "late.html",
                page(
                    "<h1>T</h1><p>Selling on Amazon is hard for many brands. That is true. "
                    "Miami Alliance 3PL helps.</p>"
                ),
            )
            t.write(
                "aside.html",
                page(
                    # the notice sentence is 77 characters, over the 40-character block floor,
                    # so only the aside exclusion keeps it out of the lead
                    '<h1>T</h1><aside class="warehouse-scope container"><p>Miami Alliance 3PL '
                    "is not a CBP-bonded warehouse and is not FDA-FSMA capable.</p></aside>"
                    "<p>Service catalog for ecommerce brands everywhere.</p>"
                ),
            )
            n, problems = g.check_lead(t.root)
            self.assertEqual(n, 4)
            self.assertEqual(
                [p.split("  ")[0] for p in problems],
                ["late.html", "aside.html", "gone.html"],
            )
        finally:
            g.LEAD_PAGES = old
            t.close()


class Cli(unittest.TestCase):
    def test_usage_errors(self):
        err = io.StringIO()
        old = sys.stderr
        sys.stderr = err
        try:
            self.assertEqual(g.main(["--root", "/nonexistent/geo"]), 2)
            self.assertEqual(g.main(["--only", "robots,bogus"]), 2)
            self.assertEqual(g.main(["--only", ","]), 2)
            self.assertEqual(g.main(["--house-facts", "/nonexistent/hf.json"]), 2)
        finally:
            sys.stderr = old
        self.assertIn("unknown check(s) ['bogus']", err.getvalue())

    def test_run_pass_and_fail(self):
        old = g.LEAD_PAGES
        t = passing_tree()
        try:
            g.LEAD_PAGES = ("index.html",)
            out = io.StringIO()
            self.assertEqual(g.run(t.root, out=out), 0)
            self.assertTrue(out.getvalue().endswith("geo_check: 6/6 checks passed\n"))
            self.assertEqual(g.main(["--root", t.root, "--only", "links,lead"]), 0)
            t.write("x.html", page('<a href="gone.html">x</a>'))
            out = io.StringIO()
            self.assertEqual(g.run(t.root, only=["links"], out=out), 1)
            self.assertIn("FAIL links: 1 problem(s)", out.getvalue())
        finally:
            g.LEAD_PAGES = old
            t.close()


if __name__ == "__main__":
    unittest.main(verbosity=1)
