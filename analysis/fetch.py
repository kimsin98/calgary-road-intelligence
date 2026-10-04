"""Download the full Calgary traffic incident archive (Dec 2016 onward), road inventory and volumes.

Writes to data/raw/ (gitignored). The dashboard pipeline (pipelines/fetch.mjs, 2023+)
and public/data/dataset.json are not touched.

Usage: .venv/bin/python fetch.py
"""

import json
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

BASE = "https://data.calgary.ca/resource/"
RAW = Path(__file__).resolve().parent / "data" / "raw"
PAGE = 50000


def get(dataset, params):
    url = BASE + dataset + ".json?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=300) as response:
        return json.load(response)


def paged(dataset, params, order):
    rows = []
    while True:
        page = get(dataset, {**params, "$limit": PAGE, "$offset": len(rows), "$order": order})
        rows += page
        print(f"  {dataset}: {len(rows)}")
        if len(page) < PAGE:
            return rows


def main():
    RAW.mkdir(parents=True, exist_ok=True)
    upper = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
    sources = {
        "traffic.json": paged("35ra-9556", {"$where": f"start_dt_utc < '{upper}'"}, "start_dt_utc,id"),
        "roads.json": paged("4dx8-rtm5", {"$select": "segment_id,full_name,ctp_class,line"}, "segment_id"),
        "volumes.json": paged("cauu-7hnw", {}, ":id"),
    }
    for name, rows in sources.items():
        (RAW / name).write_text(json.dumps(rows))
    manifest = {"downloadedAt": upper + "Z", "counts": {name: len(rows) for name, rows in sources.items()}}
    (RAW / "manifest.json").write_text(json.dumps(manifest, indent=2))
    print(manifest)


if __name__ == "__main__":
    main()
