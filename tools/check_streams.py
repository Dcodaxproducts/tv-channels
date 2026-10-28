#!/usr/bin/env python3
"""Health-check iptv-org streams and keep the ones a TV browser can play.

A stream is kept when:
  - it needs no custom User-Agent or Referer (a web page cannot send them),
  - its playlist answers within the timeout and starts with #EXTM3U,
  - it sends Access-Control-Allow-Origin (hls.js reads it with XHR, which
    the browser blocks without CORS).

Usage: check_streams.py <streams.json> <channels.json> <out.json>
"""
import json
import sys
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

TIMEOUT = 8
WORKERS = 80
UA = "Mozilla/5.0 (Linux; VIDAA) AppleWebKit/537.36 Chrome/77.0 Safari/537.36"


def check(stream):
    req = urllib.request.Request(
        stream["url"], headers={"User-Agent": UA, "Origin": "https://example.github.io"}
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            head = r.read(2048).decode("utf-8", "ignore")
            cors = r.headers.get("Access-Control-Allow-Origin")
            ok = head.lstrip().startswith("#EXTM3U")
            return stream, ok, cors, r.geturl()
    except Exception as e:  # dead, timeout, TLS error, 4xx/5xx
        return stream, False, None, str(e)[:60]


def main(streams_path, channels_path, out_path):
    streams = json.load(open(streams_path))
    channels = {c["id"]: c for c in json.load(open(channels_path))}

    todo = []
    for s in streams:
        ch = channels.get(s.get("channel"))
        if not ch or ch.get("closed") or ch.get("is_nsfw"):
            continue
        if s.get("user_agent") or s.get("referrer"):
            continue
        if "m3u8" not in s["url"].lower():
            continue
        s["_ch"] = ch
        todo.append(s)
    print(f"candidates: {len(todo)} of {len(streams)}", flush=True)

    kept, n, cors_ok, alive = [], 0, 0, 0
    with ThreadPoolExecutor(WORKERS) as pool:
        futs = [pool.submit(check, s) for s in todo]
        for f in as_completed(futs):
            s, ok, cors, _ = f.result()
            n += 1
            alive += ok
            if ok and cors in ("*",) or (ok and cors and cors != "null"):
                cors_ok += 1
                ch = s["_ch"]
                kept.append(
                    {
                        "id": ch["id"],
                        "name": ch["name"],
                        "country": ch.get("country"),
                        "cat": ch.get("categories") or [],
                        "q": s.get("quality"),
                        "url": s["url"],
                    }
                )
            if n % 500 == 0:
                print(f"  {n}/{len(todo)} alive={alive} playable={cors_ok}", flush=True)

    json.dump(kept, open(out_path, "w"), ensure_ascii=False)
    print(f"done: tested={n} alive={alive} playable_in_browser={cors_ok}", flush=True)


if __name__ == "__main__":
    main(*sys.argv[1:4])
