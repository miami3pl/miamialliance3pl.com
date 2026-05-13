#!/usr/bin/env python3
"""Unit tests for admin/update_blog_news.py."""

import unittest
from datetime import datetime, timedelta

from admin import update_blog_news as news


class UpdateBlogNewsTests(unittest.TestCase):
    def test_clean_html_strips_tags_and_entities(self):
        raw = "<p>U.S. &amp; Florida <strong>warehousing</strong> update</p>"
        self.assertEqual(news.clean_html(raw), "U.S. & Florida warehousing update")

    def test_truncate_respects_word_boundary(self):
        text = "one two three four five"
        shortened = news.truncate(text, max_len=11)
        self.assertEqual(shortened, "one two...")

    def test_auto_categorize_detects_ports(self):
        category = news.auto_categorize(
            "Port of Houston expands container capacity",
            "U.S. maritime operators increase TEU throughput",
        )
        self.assertEqual(category, "ports")

    def test_relevance_scoring_prefers_logistics_topics(self):
        logistics_score = news.logistics_relevance_score(
            "U.S. warehouse automation expands",
            "3PL operators add inventory and fulfillment capacity in Miami.",
        )
        off_topic_score = news.logistics_relevance_score(
            "Music festival lineup announced",
            "Headliners were announced for the event.",
        )
        self.assertGreater(logistics_score, off_topic_score)
        self.assertGreaterEqual(logistics_score, 2)

    def test_us_relevance_detects_domestic_signals(self):
        score = news.us_relevance_score(
            "Florida logistics demand grows",
            "U.S. importers increase throughput at PortMiami.",
        )
        self.assertGreaterEqual(score, 2)

    def test_select_articles_limits_source_share_and_dedupes(self):
        now = datetime.now()
        articles = []

        for index in range(6):
            articles.append(
                {
                    "title": f"Freight update {index // 2}",
                    "description": "U.S. freight trucking logistics warehouse update",
                    "date": now - timedelta(hours=index),
                    "source": "Source A",
                    "category": "freight",
                    "link": "https://example.com/a",
                    "relevance_score": 5,
                    "us_score": 3,
                }
            )

        for index in range(4):
            articles.append(
                {
                    "title": f"Port expansion {index}",
                    "description": "Port of Houston container supply chain expansion",
                    "date": now - timedelta(hours=12 + index),
                    "source": f"Source {index}",
                    "category": "ports",
                    "link": "https://example.com/b",
                    "relevance_score": 4,
                    "us_score": 2,
                }
            )

        selected = news.select_articles(articles, limit=6)

        self.assertEqual(len(selected), 6)
        source_a_count = sum(1 for article in selected if article["source"] == "Source A")
        self.assertLessEqual(source_a_count, news.MAX_SOURCE_SHARE)

        title_keys = [news.build_title_key(article["title"]) for article in selected]
        self.assertEqual(len(title_keys), len(set(title_keys)))


if __name__ == "__main__":
    unittest.main()
