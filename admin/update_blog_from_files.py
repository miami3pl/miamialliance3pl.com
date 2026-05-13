#!/usr/bin/env python3
"""
Miami Alliance 3PL - Blog Updater from Local Files
=================================================
Scans the /blog/ directory, parses metadata from each HTML file,
and updates the main blog.html page with the latest posts.

Usage:
    python3 admin/update_blog_from_files.py          # Dry run, shows discovered posts
    python3 admin/update_blog_from_files.py --apply  # Updates blog.html
"""

import argparse
import html
import json
import re
from datetime import datetime
from pathlib import Path

# Project paths
PROJECT_ROOT = Path(__file__).resolve().parent.parent
BLOG_HTML_PATH = PROJECT_ROOT / "blog.html"
BLOG_POSTS_DIR = PROJECT_ROOT / "blog"

# Regex to find the target div for blog posts
# This looks for the start of the blog grid and the start of the sidebar.
BLOG_GRID_PATTERN = r'(<!-- Main Content: Blog Article Grid -->\s*<div>\s*<div class="blog-grid">)(.*?)(</div>\s*</div>\s*<!-- Sidebar -->)'
COLLECTION_PAGE_PATTERN = r'(<!-- Structured Data - CollectionPage -->\s*<script type="application/ld\+json">\s*)(\{.*?\})(\s*</script>)'
ARTICLE_COUNT_PATTERN = r'(<span class="article-count" data-i18n="blog.count">)(.*?)(</span>)'
ALL_CATEGORY_COUNT_PATTERN = r'(<span data-i18n="blog.cat.all">All</span>\s*<span class="cat-count">)(\d+)(</span>)'

def extract_metadata(file_path: Path):
    """Extracts metadata (title, description, date, etc.) from a blog post HTML file."""
    content = file_path.read_text(encoding="utf-8")
    
    meta = {"path": file_path.name}
    
    title_match = re.search(r"<title>(.*?)</title>", content)
    if title_match:
        full_title = html.unescape(title_match.group(1).strip())
        meta['title'] = full_title.split('|')[0].strip()
        if 'Redirecting...' in meta['title']:
            print(f"Found redirecting title in {file_path.name}")
            return None


    description_match = re.search(r'<meta name="description" content="(.*?)"', content)
    if description_match:
        meta['description'] = html.unescape(description_match.group(1))

    date_match = re.search(r'<meta property="article:published_time" content="(.*?)"', content)
    if date_match:
        meta['date'] = datetime.fromisoformat(date_match.group(1).replace('Z', '+00:00'))
    else:
        # Fallback to file modification time if no date is in metadata
        stat = file_path.stat()
        meta['date'] = datetime.fromtimestamp(stat.st_mtime)

    # Add more metadata extraction as needed (e.g., category, author)
    # For now, we'll just use what we have.

    return meta

def generate_blog_card(meta):
    """Generates the HTML for a single blog card."""
    
    # This is a very basic card structure. It should be improved to match the existing style.
    # For now, this will get the content on the page.
    date_str = meta['date'].strftime("%B %d, %Y")
    iso_date = meta['date'].strftime("%Y-%m-%d")

    return f"""
                        <!-- Card: {meta.get('title', 'Untitled')} -->
                        <a href="blog/{meta['path']}" class="blog-card">
                            <div class="blog-card-image" style="background: linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%);">
                                <span class="card-icon">📄</span>
                            </div>
                            <div class="blog-card-body">
                                <div class="blog-card-meta">
                                    <time datetime="{iso_date}">{date_str}</time>
                                </div>
                                <h3>{meta.get('title', 'Untitled Post')}</h3>
                                <p>{meta.get('description', 'No summary available.')}</p>
                            </div>
                            <div class="blog-card-footer">
                                <span class="read-more">Read Article &rarr;</span>
                            </div>
                        </a>"""

def generate_collection_page_json(posts):
    """Generates CollectionPage structured data for all valid blog posts."""

    item_list = []
    for idx, post in enumerate(posts, start=1):
        item_list.append({
            "@type": "ListItem",
            "position": idx,
            "url": f"https://miamialliance3pl.com/blog/{post['path']}",
            "name": post.get("title", "Untitled Post"),
        })

    collection_page = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": "3PL & Logistics Blog",
        "description": "Expert 3PL blog covering warehouse logistics, fulfillment tips, Miami warehousing news, and supply chain guides.",
        "url": "https://miamialliance3pl.com/blog.html",
        "publisher": {
            "@type": "Organization",
            "name": "Miami Alliance 3PL",
            "url": "https://miamialliance3pl.com",
        },
        "mainEntity": {
            "@type": "ItemList",
            "itemListElement": item_list,
        },
    }

    return json.dumps(collection_page, indent=4, ensure_ascii=False)

def main():
    parser = argparse.ArgumentParser(description="Update blog.html from local blog files.")
    parser.add_argument("--apply", action="store_true", help="Apply changes to blog.html")
    args = parser.parse_args()

    print("Scanning for blog posts...")
    
    posts = []
    for post_file in BLOG_POSTS_DIR.glob("*.html"):
        try:
            metadata = extract_metadata(post_file)
            if metadata and 'title' in metadata: # Only include posts where we could parse a title
                posts.append(metadata)
        except Exception as e:
            print(f"Could not process {post_file.name}: {e}")

    # Sort posts by date, newest first
    posts.sort(key=lambda p: p['date'], reverse=True)

    print(f"Found {len(posts)} valid blog posts.")

    if not posts:
        print("No posts found, exiting.")
        return

    # Generate HTML for all blog cards
    new_grid_content = "\n".join([generate_blog_card(p) for p in posts])

    if args.apply:
        print("Applying changes to blog.html...")
        
        main_blog_html = BLOG_HTML_PATH.read_text(encoding="utf-8")
        
        # Replace the content of the blog grid
        match = re.search(BLOG_GRID_PATTERN, main_blog_html, re.DOTALL)

        if match:
            # Reconstruct the html with the new grid content
            updated_html = main_blog_html[:match.start(2)] + new_grid_content + main_blog_html[match.end(2):]

            collection_match = re.search(COLLECTION_PAGE_PATTERN, updated_html, re.DOTALL)
            if collection_match:
                collection_json = generate_collection_page_json(posts)
                updated_html = (
                    updated_html[:collection_match.start(2)]
                    + collection_json
                    + updated_html[collection_match.end(2):]
                )
            else:
                print("Warning: Could not find CollectionPage structured data block in blog.html.")

            updated_html = re.sub(
                ARTICLE_COUNT_PATTERN,
                rf"\g<1>{len(posts)} Articles\g<3>",
                updated_html,
                count=1,
                flags=re.DOTALL,
            )

            updated_html = re.sub(
                ALL_CATEGORY_COUNT_PATTERN,
                rf"\g<1>{len(posts)}\g<3>",
                updated_html,
                count=1,
                flags=re.DOTALL,
            )

            BLOG_HTML_PATH.write_text(updated_html, encoding="utf-8")
            print("Successfully updated blog.html.")
        else:
            print("Error: Could not find the blog grid section in blog.html.")
            print("Please check the BLOG_GRID_PATTERN regex in the script.")
            print("Attempted pattern:")
            print(BLOG_GRID_PATTERN)

    else:
        print("\n--- DRY RUN ---")
        print("The following posts would be added to blog.html:")
        for post in posts:
            print(f"- {post['date'].strftime('%Y-%m-%d')}: {post['title']}")
        print("\nRun with --apply to actually update the file.")

if __name__ == "__main__":
    main()
