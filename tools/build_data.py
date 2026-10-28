#!/usr/bin/env python3
"""Join health-checked streams with channel names, logos and country names.

Usage: build_data.py <working.json> <logos.json> <countries.json> <out.json>

Output (compact, one array per channel):
  {"c": {"PK": "Pakistan", ...},
   "l": [[id, name, country, group, logo|"", quality, [url, ...]], ...]}
"""
import json
import re
import sys

GROUPS = {
    "news": "news", "business": "news", "weather": "news", "legislative": "news",
    "sports": "sports", "outdoor": "sports",
    "entertainment": "entertainment", "comedy": "entertainment", "series": "entertainment",
    "lifestyle": "entertainment", "cooking": "entertainment", "shop": "entertainment",
    "kids": "kids", "animation": "kids", "family": "kids",
    "movies": "movies", "classic": "movies",
    "music": "music",
    "religious": "faith",
    "documentary": "learn", "education": "learn", "science": "learn",
    "culture": "learn", "travel": "learn",
}


def group_of(cats):
    for c in cats:
        if c in GROUPS:
            return GROUPS[c]
    return "more"


def qnum(q):
    m = re.match(r"(\d+)", q or "")
    return int(m.group(1)) if m else 0


def pick_logo(options):
    """Prefer https, a still format, and a width near 400px (light on a weak TV)."""
    ok = [o for o in options if o["url"].startswith("https://")
          and (o.get("format") or "").upper() in ("PNG", "SVG", "WEBP", "JPEG", "AVIF")]
    if not ok:
        return ""
    ok.sort(key=lambda o: (o.get("feed") is not None, abs((o.get("width") or 400) - 400)))
    return ok[0]["url"]


def main(working, logos, countries, out):
    streams = json.load(open(working))
    logo_by = {}
    for l in json.load(open(logos)):
        if l.get("in_use", True):
            logo_by.setdefault(l["channel"], []).append(l)
    names = {c["code"]: c["name"] for c in json.load(open(countries))}

    by_id = {}
    for s in streams:
        by_id.setdefault(s["id"], []).append(s)

    rows = []
    for cid, ss in by_id.items():
        ss.sort(key=lambda s: (s["url"].startswith("http://"), -qnum(s["q"])))
        first = ss[0]
        urls = []
        for s in ss:
            if s["url"] not in urls:
                urls.append(s["url"])
        rows.append([
            cid, first["name"], first["country"] or "", group_of(first["cat"]),
            pick_logo(logo_by.get(cid, [])), first["q"] or "", urls[:3],
        ])
    rows.sort(key=lambda r: r[1].lower())
    used = {r[2] for r in rows}
    json.dump({"c": {k: v for k, v in names.items() if k in used}, "l": rows},
              open(out, "w"), ensure_ascii=False, separators=(",", ":"))
    with_logo = sum(1 for r in rows if r[4])
    print(f"channels={len(rows)} with_logo={with_logo} countries={len(used)}")


if __name__ == "__main__":
    main(*sys.argv[1:5])
