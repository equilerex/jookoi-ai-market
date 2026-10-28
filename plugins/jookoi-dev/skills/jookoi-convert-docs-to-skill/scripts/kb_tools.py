"""Tools for a distilled knowledge base (kb) of `## slug | title` entries.

  python -I scripts/kb_tools.py prep <extract-dir> <first> <last> <out.txt>   clean extract files in a number range into one text file for a drafter
  python -I scripts/kb_tools.py index <kb-dir>                                 lint kb entries and rebuild <kb-dir>/INDEX.md
"""
import os
import re
import sys

EXTRACT = ''  # set from the command line
KB = ''


def clean(text):
    text = re.sub(r'\n\(page \d+\)\n', '\n', text)
    lines = text.split('\n')
    out = []
    for line in lines:
        s = line.strip()
        if not s:
            if out and out[-1] != '':
                out.append('')
            continue
        # join hard-wrapped continuation lines into the previous paragraph line
        if out and out[-1] and not s.startswith(('-', '#', '*', '|')) and not re.match(r'^\d+[.)] ', s) and not out[-1].startswith('#'):
            out[-1] += ' ' + s
        else:
            out.append(s)
    return '\n'.join(out)


def prep(first, last, dest):
    names = sorted(f for f in os.listdir(EXTRACT) if f[:4].isdigit() and first <= int(f[:4]) <= last)
    with open(dest, 'w', encoding='utf-8') as handle:
        for name in names:
            body = open(os.path.join(EXTRACT, name), encoding='utf-8').read()
            handle.write('\n=== %s ===\n%s\n' % (name[:-4], clean(body)))
    print('%d files -> %s (%d KB)' % (len(names), dest, os.path.getsize(dest) // 1000))


ENTRY = re.compile(r'^## ([a-z0-9._-]+) \| (.+)$')


def index():
    rows, seen, problems = [], {}, []
    for name in sorted(os.listdir(KB)):
        if not re.match(r'^\d\d-.*\.md$', name):
            continue
        current = None
        for number, line in enumerate(open(os.path.join(KB, name), encoding='utf-8'), 1):
            line = line.rstrip('\n')
            match = ENTRY.match(line)
            if match:
                slug, title = match.groups()
                if slug in seen:
                    problems.append('duplicate slug %s (%s:%d and %s)' % (slug, name, number, seen[slug]))
                seen[slug] = '%s:%d' % (name, number)
                current = {'slug': slug, 'title': title, 'file': name, 'ui': '', 'words': '', 'lines': 0}
                rows.append(current)
            elif line.startswith('## '):
                problems.append('bad entry header %s:%d: %s' % (name, number, line[:60]))
            elif current is not None:
                current['lines'] += 1
                if line.startswith('ui: '):
                    current['ui'] = line[4:]
                elif line.startswith('user-words: '):
                    current['words'] = line[12:]
    for row in rows:
        if row['lines'] > 70:
            problems.append('long entry %s (%d lines)' % (row['slug'], row['lines']))
        if not row['ui']:
            problems.append('no ui: %s' % row['slug'])
    with open(os.path.join(KB, 'INDEX.md'), 'w', encoding='utf-8', newline='\n') as handle:
        handle.write('# kb index\n\nslug | title | ui | user-words | file\n\n')
        for row in rows:
            handle.write('%s | %s | %s | %s | %s\n' % (row['slug'], row['title'], row['ui'], row['words'], row['file']))
    size = sum(os.path.getsize(os.path.join(KB, f)) for f in os.listdir(KB) if f.endswith('.md'))
    print('%d entries, %d KB total' % (len(rows), size // 1000))
    for problem in problems:
        print('PROBLEM:', problem)


if __name__ == '__main__':
    if sys.argv[1] == 'prep':
        EXTRACT = sys.argv[2]
        prep(int(sys.argv[3]), int(sys.argv[4]), sys.argv[5])
    elif sys.argv[1] == 'index':
        KB = sys.argv[2]
        index()
