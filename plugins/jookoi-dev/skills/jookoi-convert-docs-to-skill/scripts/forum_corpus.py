"""Build a compact corpus from an HTTrack capture of a Discourse forum, plus Discourse JSON.

Reads thread pages (t/<slug>/<id>.html) and category listings (c/**.html),
writes one JSON object per thread: id, title, section, tags, views, posts.
Post text is reduced to plain text, code blocks kept, quotes of earlier posts dropped.

Also reads Discourse JSON saved by forum_fetch.py (t/<id>.json).

Usage: python -I scripts/forum_corpus.py <capture-root> <out.jsonl> [--staff "Name1,Name2"] [--categories "11=Help,16=Scripts"]
  capture-root = folder that contains t/ and c/ (HTTrack capture or forum_fetch output)
  An existing out.jsonl is merged, not replaced: new captures only add threads and posts.
"""
import glob
import html
import json
import os
import re
import sys

# Filled from --staff and --categories. Discourse JSON also marks staff posts itself.
STAFF = set()
CATEGORY_NAMES = {}

POST_RE = re.compile(
    r"<div id='post_(\d+)'.*?itemprop=\"name\">(.*?)</span>.*?datetime='([^']+)'"
    r".*?<div class='post' itemprop=\"text\">(.*?)</div>\s*<div itemprop=\"interactionStatistic\""
    r".*?userInteractionCount\" content=\"(\d+)\"",
    re.S,
)
LISTING_RE = re.compile(
    r"href='[^']*/t/[^/']+/(\d+)(?:\.html)?'[^>]*raw-topic-link'>.*?class='views' title='views'>(\d+)<",
    re.S,
)


def to_text(fragment):
    fragment = re.sub(r"<aside class=\"quote.*?</aside>", "", fragment, flags=re.S)
    fragment = re.sub(r"<pre><code[^>]*>(.*?)</code></pre>", lambda m: "\n```\n" + m.group(1) + "\n```\n", fragment, flags=re.S)
    fragment = re.sub(r"<img [^>]*>", "[img]", fragment)
    fragment = re.sub(r"<br\s*/?>|</p>|</li>|</h\d>", "\n", fragment)
    fragment = re.sub(r"<[^>]+>", "", fragment)
    fragment = html.unescape(fragment)
    return re.sub(r"\n{3,}", "\n\n", fragment).strip()


def meta(page, prop):
    m = re.search(r"itemprop='%s' content='([^']*)'" % prop, page)
    return html.unescape(m.group(1)) if m else ""


def main(root, out_path):
    views = {}
    for listing in glob.glob(os.path.join(root, "c", "**", "*.html"), recursive=True):
        page = open(listing, encoding="utf-8", errors="ignore").read()
        for topic_id, count in LISTING_RE.findall(page):
            views[topic_id] = max(views.get(topic_id, 0), int(count))

    # Scrapes are incremental: old HTML is not re-supplied, so the existing corpus is the base.
    threads = {}
    if os.path.exists(out_path):
        for line in open(out_path, encoding="utf-8"):
            thread = json.loads(line)
            threads[thread["id"]] = thread
    known_before = len(threads)
    for topic_id, count in views.items():
        if topic_id in threads:
            threads[topic_id]["views"] = max(threads[topic_id]["views"] or 0, count)

    for thread_file in glob.glob(os.path.join(root, "t", "*", "*.html")):
        page = open(thread_file, encoding="utf-8", errors="ignore").read()
        topic_id = os.path.splitext(os.path.basename(thread_file))[0]
        if not topic_id.isdigit():
            continue
        title = meta(page, "headline")
        posts = [
            {"n": int(n), "author": html.unescape(a), "staff": a in STAFF, "date": d[:10], "likes": int(likes), "text": to_text(body)}
            for n, a, d, body, likes in POST_RE.findall(page)
        ]
        thread = threads.setdefault(topic_id, {"id": topic_id, "views": None, "posts": []})
        thread.update({
            "title": title,
            "section": meta(page, "articleSection"),
            "tags": [t.strip() for t in meta(page, "keywords").split(",") if t.strip()],
        })
        if views.get(topic_id):
            thread["views"] = max(thread["views"] or 0, views[topic_id])
        known = {p["n"] for p in thread["posts"]}
        thread["posts"] += [p for p in posts if p["n"] not in known]

    # Discourse JSON from forum_fetch.py: <root>/t/<id>.json
    for thread_file in glob.glob(os.path.join(root, "t", "*.json")):
        topic = json.load(open(thread_file, encoding="utf-8"))
        topic_id = str(topic["id"])
        thread = threads.setdefault(topic_id, {"id": topic_id, "views": None, "posts": []})
        thread.update({
            "title": topic.get("title", ""),
            "section": CATEGORY_NAMES.get(topic.get("category_id"), str(topic.get("category_id"))),
            "tags": [t["name"] if isinstance(t, dict) else t for t in topic.get("tags", [])],
            "views": max(thread["views"] or 0, topic.get("views") or 0),
        })
        known = {p["n"] for p in thread["posts"]}
        for post in topic.get("post_stream", {}).get("posts", []):
            if post["post_number"] in known:
                continue
            thread["posts"].append({
                "n": post["post_number"],
                "author": post.get("username", ""),
                "staff": bool(post.get("staff")) or post.get("username") in STAFF,
                "date": post.get("created_at", "")[:10],
                "likes": next((a.get("count", 0) for a in post.get("actions_summary", []) if a.get("id") == 2), 0),
                "accepted": bool(post.get("accepted_answer")),
                "text": to_text(post.get("cooked", "")),
            })

    with open(out_path, "w", encoding="utf-8") as out:
        for thread in sorted(threads.values(), key=lambda t: -(t["views"] or 0)):
            thread["posts"].sort(key=lambda p: p["n"])
            out.write(json.dumps(thread, ensure_ascii=False) + "\n")
    print(f"{len(threads)} threads ({len(threads) - known_before} new),{sum(len(t['posts']) for t in threads.values())} posts, "
          f"{sum(1 for t in threads.values() if t['views'])} with view counts -> {out_path}")


if __name__ == "__main__":
    positional, options = [], {}
    argv = sys.argv[1:]
    while argv:
        item = argv.pop(0)
        if item.startswith("--"):
            options[item[2:]] = argv.pop(0)
        else:
            positional.append(item)
    STAFF.update(n.strip() for n in options.get("staff", "").split(",") if n.strip())
    for pair in options.get("categories", "").split(","):
        if "=" in pair:
            key, name = pair.split("=", 1)
            CATEGORY_NAMES[int(key)] = name.strip()
    main(positional[0], positional[1])
