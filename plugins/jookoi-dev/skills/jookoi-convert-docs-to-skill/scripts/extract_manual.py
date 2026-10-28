"""Extract a PDF manual into plain-text sections for research and git diffing. Needs: pip install pymupdf.

One file per top-level bookmark, its sub-bookmarks as markdown headings. Text is cut at the
exact bookmark position (page + y), so several sections on one page split correctly.
INDEX.md lists every file with its bookmark path, page and size, so readers can budget.

Usage: python -I scripts/extract_manual.py <manual.pdf> <out-dir>
"""
import os
import re
import sys

try:
    import pymupdf
except ImportError:
    sys.exit("PyMuPDF is missing: pip install pymupdf")


def slugify(title):
    return re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:60] or "section"


def page_blocks(page):
    """Text blocks in reading order, with lone bullet glyphs merged into the following block."""
    blocks = []
    pending_bullet = False
    for x0, y0, x1, y1, text, *_ in page.get_text("blocks", sort=True):
        text = text.strip()
        if not text:
            continue
        if text == "•":
            pending_bullet = True
            continue
        if pending_bullet:
            text = "- " + text
            pending_bullet = False
        blocks.append((y0, re.sub(r"[ \t]+\n", "\n", text)))
    return blocks


def main(pdf_path, out_dir):
    document = pymupdf.open(pdf_path)
    toc = []
    for order, (level, title, page_number, dest) in enumerate(document.get_toc(simple=False)):
        if page_number < 1:
            continue
        y = dest.get("to").y if dest.get("to") is not None else 0
        toc.append({"order": order, "level": level, "title": title.strip(), "page": page_number - 1, "y": y})

    blocks_by_page = {}

    def blocks(page_index):
        if page_index not in blocks_by_page:
            blocks_by_page[page_index] = page_blocks(document[page_index])
        return blocks_by_page[page_index]

    positions = sorted(toc, key=lambda e: (e["page"], e["y"], e["order"]))
    for index, entry in enumerate(positions):
        end = positions[index + 1] if index + 1 < len(positions) else {"page": len(document) - 1, "y": 1e9}
        parts = []
        for page_index in range(entry["page"], end["page"] + 1):
            for y, text in blocks(page_index):
                after_start = page_index > entry["page"] or y >= entry["y"] - 2
                before_end = page_index < end["page"] or y < end["y"] - 2
                if after_start and before_end:
                    parts.append(text)
        if parts and parts[0].splitlines()[0].strip() == entry["title"]:
            parts[0] = "\n".join(parts[0].splitlines()[1:])
        entry["text"] = "\n\n".join(p for p in parts if p.strip())

    os.makedirs(out_dir, exist_ok=True)
    for stale in os.listdir(out_dir):
        if stale.endswith(".txt"):
            os.remove(os.path.join(out_dir, stale))

    index_lines = ["# Manual extract index", "", f"Source: `{os.path.basename(pdf_path)}`, {len(document)} pages.", "",
                   "| File | Page | Chars | Bookmark path |", "|---|---|---|---|"]
    chapter, chapter_entries, file_number = None, [], 0

    def flush():
        nonlocal file_number
        if not chapter:
            return
        file_number += 1
        name = f"{file_number:04d}-{slugify(chapter['title'])}.txt"
        body = []
        for e in chapter_entries:
            if e["level"] > 1 or e is not chapter:
                body.append("#" * min(e["level"], 6) + " " + e["title"])
            if e["text"]:
                body.append(e["text"])
        content = f"# {chapter['title']}\n(page {chapter['page'] + 1})\n\n" + "\n\n".join(body).strip() + "\n"
        with open(os.path.join(out_dir, name), "w", encoding="utf-8", newline="\n") as out:
            out.write(content)
        subtitles = " / ".join(e["title"] for e in chapter_entries if e["level"] == 2)[:200]
        index_lines.append(f"| {name} | {chapter['page'] + 1} | {len(content)} | {chapter['title']}" + (f" > {subtitles}" if subtitles else "") + " |")

    for entry in sorted(toc, key=lambda e: e["order"]):
        if entry["level"] == 1:
            flush()
            chapter, chapter_entries = entry, [entry]
        else:
            chapter_entries.append(entry)
    flush()

    with open(os.path.join(out_dir, "INDEX.md"), "w", encoding="utf-8", newline="\n") as out:
        out.write("\n".join(index_lines) + "\n")
    print(f"{file_number} files -> {out_dir}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
