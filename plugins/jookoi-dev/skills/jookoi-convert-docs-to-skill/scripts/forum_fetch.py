"""Politely fetch threads and category listings from a Discourse forum as JSON. Get the owner's OK first.

One request per item, a fixed delay between requests, Retry-After honoured on 429.
Items already on disk are skipped, so the script can be re-run after an interruption.

Usage:
  python -I scripts/forum_fetch.py <base-url> <out-dir> topics <id> [<id> ...]
  python -I scripts/forum_fetch.py <base-url> <out-dir> listing <category-path> [pages]   e.g. support/11 2
  python -I scripts/forum_fetch.py <base-url> <out-dir> solved <category-path> <max>      topics with an accepted answer, from saved listings

Writes <out-dir>/t/<id>.json and <out-dir>/c/<category-path>/<page>.json.
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request

BASE = ""  # set from the command line, e.g. https://forum.example.com
DELAY_SECONDS = 10
USER_AGENT = "skill-research/1.0 (personal, low-rate)"


def fetch_json(url):
    for attempt in range(6):
        request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            if error.code == 429:
                wait = int(error.headers.get("Retry-After") or 30) + 5
                print(f"  429, waiting {wait}s", flush=True)
                time.sleep(wait)
                continue
            if error.code in (403, 404):
                print(f"  {error.code}, skipped", flush=True)
                return None
            raise
    print("  gave up after repeated 429", flush=True)
    return None


def save(path, payload):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as out:
        json.dump(payload, out, ensure_ascii=False)


def fetch_all(jobs):
    """jobs: list of (url, path). Skips existing paths, sleeps between real requests."""
    pending = [(url, path) for url, path in jobs if not os.path.exists(path)]
    print(f"{len(jobs) - len(pending)} already on disk, {len(pending)} to fetch", flush=True)
    for index, (url, path) in enumerate(pending):
        print(f"[{index + 1}/{len(pending)}] {url}", flush=True)
        payload = fetch_json(url)
        if payload is not None:
            save(path, payload)
        if index + 1 < len(pending):
            time.sleep(DELAY_SECONDS)


def main():
    global BASE
    if len(sys.argv) < 4:
        sys.exit(__doc__)
    BASE, out_dir, mode, *args = sys.argv[1:]
    BASE = BASE.rstrip("/")
    if mode == "topics":
        fetch_all([(f"{BASE}/t/{topic_id}.json", os.path.join(out_dir, "t", f"{topic_id}.json")) for topic_id in args])
    elif mode == "listing":
        category, pages = args[0], int(args[1]) if len(args) > 1 else 1
        fetch_all([(f"{BASE}/c/{category}.json?page={page}", os.path.join(out_dir, "c", category, f"{page}.json")) for page in range(pages)])
    elif mode == "solved":
        category, limit = args[0], int(args[1])
        listing_dir = os.path.join(out_dir, "c", category)
        topics = []
        for name in sorted(os.listdir(listing_dir)):
            listing = json.load(open(os.path.join(listing_dir, name), encoding="utf-8"))
            topics += listing.get("topic_list", {}).get("topics", [])
        solved = [t for t in topics if t.get("has_accepted_answer") and not t.get("pinned")]
        solved.sort(key=lambda t: -t.get("views", 0))
        fetch_all([(f"{BASE}/t/{t['id']}.json", os.path.join(out_dir, "t", f"{t['id']}.json")) for t in solved[:limit]])
    else:
        sys.exit(f"unknown mode {mode}")


if __name__ == "__main__":
    main()
