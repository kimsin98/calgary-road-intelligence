"""Build forecast units and assign incidents to them.

Units:
  segment       every road segment in the City inventory (including segments with no incidents)
  intersection  a node where 3+ non-alley segments share an endpoint (1 m grid)

An incident belongs to the nearest intersection within 76 m (250 ft, the usual intersection
influence area), otherwise to the nearest segment within 50 m (as in pipelines/prepare.mjs);
anything else is dropped. Coordinates use the dashboard's local equirectangular projection.

Assets (signals, stop/yield signs, crosswalks) are attached to the intersection within 40 m, and
pedestrian signals and crosswalks away from intersections to the segment within 30 m. Each keeps
its install date where the source has one, so the model only uses assets present at a cutoff.

Writes data/units.parquet, data/events.parquet and data/assets.parquet.
Usage: .venv/bin/python prepare.py
"""

import json

import numpy as np
import pandas as pd
import shapely
from shapely.geometry import mapping, shape

from model import DATA

SEGMENT_METRES = 50
INTERSECTION_METRES = 76
VOLUME_YEARS = (2016, 2017, 2018, 2019, 2022, 2023, 2024)  # 2020 and 2021 were not published
ASSET_NODE_METRES = 40
ASSET_SEGMENT_METRES = 30
FULL_SIGNALS = {"Traffic signal", "Traffic signal T intersection", "1/2 signal", "1/4 signal"}
PEDESTRIAN_SIGNALS = {"Pedestrian RRFB", "Overhead Flasher"}
NOT_INTERSECTION_LEGS = {"Lanes (Alleys)", "PedestrianBridge"}
CLASS_RANK = [
    "Skeletal Road", "Urban Boulevard", "Parkway", "Industrial Arterial", "Arterial Street", "Local Arterial",
    "Primary Collector", "Neighbourhood Boulevard", "Activity Center Street", "Collector", "Industrial Street",
    "Access Route", "Residential Street", "Historic Road Allowance", "Unknown",
]


def to_metres(lon, lat):
    return (np.asarray(lon) + 114.1) * 69900, (np.asarray(lat) - 51) * 111200


def to_lonlat(x, y):
    return np.asarray(x) / 69900 - 114.1, np.asarray(y) / 111200 + 51


def project(geometry):
    return shapely.transform(geometry, lambda xy: np.column_stack(to_metres(xy[:, 0], xy[:, 1])))


def build_segments(roads):
    lines = project(np.array([shape(r["line"]) for r in roads]))
    midpoints = shapely.line_interpolate_point(shapely.line_merge(lines), 0.5, normalized=True)
    lon, lat = to_lonlat(shapely.get_x(midpoints), shapely.get_y(midpoints))
    segments = pd.DataFrame(
        {
            "unit_id": [f"road:{r['segment_id']}" for r in roads],
            "kind": "segment",
            "name": [r.get("full_name") for r in roads],
            "road_class": [r.get("ctp_class") or "Unknown" for r in roads],
            "length_m": shapely.length(lines),
            "lon": lon,
            "lat": lat,
            "geometry": [json.dumps(mapping(shape(r["line"]))) for r in roads],
        }
    )
    # Weekday volume per year from the nearest count section within 30 m of the segment midpoint.
    # Years without a nearby count (including the unpublished 2020–2021) stay missing.
    for year in VOLUME_YEARS:
        volumes = json.loads((DATA / f"raw/volumes-{year}.json").read_text())
        geometry = [shape(v.get("multilinestring") or v["the_geom"]) for v in volumes]
        tree = shapely.STRtree(project(np.array(geometry)))
        (seg, section), _ = tree.query_nearest(midpoints, max_distance=30, return_distance=True, all_matches=False)
        segments[f"volume_{year}"] = np.nan
        segments.loc[seg, f"volume_{year}"] = [float(volumes[i]["volume"]) for i in section]
    return segments, lines


def build_intersections(roads, segments):
    rows = []
    for i, r in enumerate(roads):
        if r.get("ctp_class") in NOT_INTERSECTION_LEGS:
            continue
        for line in shape(r["line"]).geoms:
            c = np.asarray(line.coords)
            rows += [(i, *c[0]), (i, *c[-1])]
    ends = pd.DataFrame(rows, columns=["leg", "lon", "lat"])
    x, y = to_metres(ends.lon, ends.lat)
    ends["x"], ends["y"] = np.round(x).astype(int), np.round(y).astype(int)
    legs = ends.drop_duplicates(["x", "y", "leg"]).groupby(["x", "y"]).leg.agg(list)
    legs = legs[legs.map(len) >= 3]

    rank = {c: i for i, c in enumerate(CLASS_RANK)}
    road_class, names = segments.road_class.to_numpy(), segments.name.to_numpy()
    ordered = [sorted(l, key=lambda s: rank.get(road_class[s], len(rank))) for l in legs]
    lon, lat = to_lonlat(legs.index.get_level_values(0), legs.index.get_level_values(1))

    def busiest_leg(year):
        volume = segments[f"volume_{year}"].to_numpy()
        return [np.nanmax(volume[l]) if np.isfinite(volume[l]).any() else np.nan for l in legs]

    def label(order):
        distinct = list(dict.fromkeys(n for n in names[order] if isinstance(n, str) and n))
        return " & ".join(distinct[:2]) or None

    return pd.DataFrame(
        {
            "unit_id": [f"node:{x}:{y}" for x, y in legs.index],
            "kind": "intersection",
            "name": [label(o) for o in ordered],
            "major": [road_class[o[0]] for o in ordered],
            "minor": [road_class[o[1]] for o in ordered],
            "legs": legs.map(len).to_numpy(),
            **{f"volume_{year}": busiest_leg(year) for year in VOLUME_YEARS},
            "lon": lon,
            "lat": lat,
            "geometry": [json.dumps({"type": "Point", "coordinates": [float(a), float(b)]}) for a, b in zip(lon, lat)],
        }
    )


def assign_events(segments, lines, intersections):
    raw = pd.DataFrame(json.loads((DATA / "raw/traffic.json").read_text()))
    lon, lat = pd.to_numeric(raw.longitude, errors="coerce"), pd.to_numeric(raw.latitude, errors="coerce")
    inside = lon.between(-114.5, -113.8) & lat.between(50.8, 51.3)
    events = raw.loc[inside, ["id", "start_dt_utc", "description"]].assign(lon=lon[inside], lat=lat[inside])
    events = events.drop_duplicates("id")
    utc = pd.to_datetime(events.start_dt_utc, utc=True, errors="coerce")
    events = events[utc.notna()].assign(utc=utc[utc.notna()]).drop(columns="start_dt_utc")
    events["date"] = events.utc.dt.tz_convert("America/Edmonton").dt.strftime("%Y-%m-%d")
    points = project(shapely.points(events.lon, events.lat))

    unit = np.full(len(events), None, dtype=object)
    (e, s), _ = shapely.STRtree(lines).query_nearest(points, max_distance=SEGMENT_METRES, return_distance=True,
                                                     all_matches=False)
    unit[e] = segments.unit_id.to_numpy()[s]
    node_xy = shapely.points(*to_metres(intersections.lon, intersections.lat))
    (e, n), _ = shapely.STRtree(node_xy).query_nearest(points, max_distance=INTERSECTION_METRES,
                                                       return_distance=True, all_matches=False)
    unit[e] = intersections.unit_id.to_numpy()[n]
    events["unit_id"] = unit
    return events[events.unit_id.notna()].reset_index(drop=True)


def asset_points(rows):
    def lonlat(point):
        return (json.loads(point.replace("'", '"')) if isinstance(point, str) else point)["coordinates"]

    if not rows:
        return shapely.points(np.empty((0, 2)))
    xy = np.array([lonlat(r["point"]) for r in rows])
    return shapely.points(*to_metres(xy[:, 0], xy[:, 1]))


def build_assets(segments, lines, intersections):
    """One row per asset: unit_id, asset type and install date (None if the source has no date)."""
    node_tree = shapely.STRtree(shapely.points(*to_metres(intersections.lon, intersections.lat)))
    line_tree = shapely.STRtree(lines)
    node_ids, segment_ids = intersections.unit_id.to_numpy(), segments.unit_id.to_numpy()

    def attach(rows, asset, installed, segments_too=False):
        points, unit = asset_points(rows), np.full(len(rows), None, dtype=object)
        if segments_too:
            (i, j), _ = line_tree.query_nearest(points, max_distance=ASSET_SEGMENT_METRES, return_distance=True,
                                                all_matches=False)
            unit[i] = segment_ids[j]
        (i, j), _ = node_tree.query_nearest(points, max_distance=ASSET_NODE_METRES, return_distance=True,
                                            all_matches=False)
        unit[i] = node_ids[j]
        return pd.DataFrame({"unit_id": unit, "asset": asset, "installed": installed})

    load = lambda name: [r for r in json.loads((DATA / f"raw/{name}.json").read_text()) if r.get("point")]
    date_of = lambda r: (r.get("instdate") or "")[:10] or None
    signals, signs, crosswalks = load("signals"), load("signs"), load("crosswalks")
    parts = []
    for asset, types, segments_too in (("signal", FULL_SIGNALS, False), ("pedestrian_signal", PEDESTRIAN_SIGNALS, True)):
        rows = [r for r in signals if r.get("int_type") in types]
        parts.append(attach(rows, asset, [date_of(r) for r in rows], segments_too))
    for blade in ("Stop", "Yield"):
        rows = [r for r in signs if r.get("blade_type") == blade]
        parts.append(attach(rows, f"{blade.lower()}_sign", [date_of(r) for r in rows]))
    parts.append(attach(crosswalks, "crosswalk", None, segments_too=True))
    school = [r for r in crosswalks if r.get("crosswalk_type") == "SCHOOL"]
    parts.append(attach(school, "school_crosswalk", None, segments_too=True))
    assets = pd.concat(parts, ignore_index=True)
    return assets[assets.unit_id.notna()].reset_index(drop=True)


def main():
    roads = [r for r in json.loads((DATA / "raw/roads.json").read_text()) if r.get("line")]
    segments, lines = build_segments(roads)
    intersections = build_intersections(roads, segments)
    events = assign_events(segments, lines, intersections)
    units = pd.concat([segments, intersections], ignore_index=True)
    assets = build_assets(segments, lines, intersections)
    units.to_parquet(DATA / "units.parquet")
    events.to_parquet(DATA / "events.parquet")
    assets.to_parquet(DATA / "assets.parquet")
    print(
        f"{len(segments)} segments, {len(intersections)} intersections; {len(events)} incidents assigned, "
        f"{(events.unit_id.str.startswith('node:')).mean():.0%} to intersections; "
        f"{events.date.min()} to {events.date.max()}"
    )
    print("assets attached:", assets.asset.value_counts().to_dict())


if __name__ == "__main__":
    main()
