#!/usr/bin/env python3
"""Decide whether a freshly built channel list is safe to publish.

Usage: merge_guard.py <new.json> <committed.json> <out.json>

- Refuse the new list (keep the committed one) if it is tiny or lost more than
  40 percent of channels, which means the check run itself went wrong.
- The check runs from a US datacentre, so geo-fenced Pakistani channels can look
  dead. If Pakistan lost more than 30 percent, keep the committed Pakistan entries.
"""
import json
import sys

new_path, old_path, out_path = sys.argv[1:4]
new = json.load(open(new_path))
old = json.load(open(old_path))
n, o = len(new["l"]), len(old["l"])
print(f"new={n} committed={o}")

if n < 2000 or n < 0.6 * o:
    print("new list rejected: too small, keeping the committed list")
    json.dump(old, open(out_path, "w"), ensure_ascii=False, separators=(",", ":"))
    sys.exit(0)

new_pk = [r for r in new["l"] if r[2] == "PK"]
old_pk = [r for r in old["l"] if r[2] == "PK"]
if old_pk and len(new_pk) < 0.7 * len(old_pk):
    have = {r[0] for r in new_pk}
    keep = [r for r in old_pk if r[0] not in have]
    new["l"] += keep
    new["l"].sort(key=lambda r: r[1].lower())
    print(f"pakistan {len(new_pk)} < 70% of {len(old_pk)}: kept {len(keep)} committed entries")

json.dump(new, open(out_path, "w"), ensure_ascii=False, separators=(",", ":"))
print(f"published channels={len(new['l'])}")
