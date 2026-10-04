"""Download the full Calgary traffic incident archive (Dec 2016 onward), road inventory and the
yearly Traffic Volumes datasets (average weekday traffic; 2020 and 2021 were not published).

Writes to data/raw/ (gitignored). The dashboard pipeline (pipelines/fetch.mjs, 2023+)
and public/data/dataset.json are not touched.

Usage: .venv/bin/python fetch.py [--volumes-only]
"""

import argparse
import json
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

BASE = "https://data.calgary.ca/resource/"
RAW = Path(__file__).resolve().parent / "data" / "raw"
PAGE = 50000
VOLUMES = {2016: "6wve-2ets", 2017: "nvuz-qykn", 2018: "wwf6-cpsg", 2019: "qeqv-tb2c",
           2022: "57me-rcwr", 2023: "bjag-w7zi", 2024: "cauu-7hnw"}


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
    parser = argparse.ArgumentParser()
    parser.add_argument("--volumes-only", action="store_true", help="keep the existing incident and road snapshot")
    args = parser.parse_args()
    RAW.mkdir(parents=True, exist_ok=True)
    upper = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
    sources = {f"volumes-{year}.json": paged(dataset, {}, ":id") for year, dataset in VOLUMES.items()}
    if not args.volumes_only:
        sources["traffic.json"] = paged("35ra-9556", {"$where": f"start_dt_utc < '{upper}'"}, "start_dt_utc,id")
        sources["roads.json"] = paged("4dx8-rtm5", {"$select": "segment_id,full_name,ctp_class,line"}, "segment_id")
    for name, rows in sources.items():
        (RAW / name).write_text(json.dumps(rows))
    manifest_path = RAW / "manifest.json"
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {"counts": {}}
    manifest["counts"].pop("volumes.json", None)
    manifest["counts"].update({name: len(rows) for name, rows in sources.items()})
    manifest["volumesDownloadedAt" if args.volumes_only else "downloadedAt"] = upper + "Z"
    manifest_path.write_text(json.dumps(manifest, indent=2))
    print(manifest)


if __name__ == "__main__":
    main()
