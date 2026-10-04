# Data sources and reproducibility

Current traffic/weather snapshots retrieved October 4, 2026; road inventory and volume context retrieved October 3. No credentials required.

| Source | Original purpose | Current use |
|---|---|---|
| [Traffic Incidents](https://data.calgary.ca/Transportation-Transit/Traffic-Incidents/35ra-9556) | Archive of reported traffic disruptions | 27,805 records from UTC January 2023 to download time; reactive and proactive evidence |
| [Street Centreline](https://data.calgary.ca/Transportation-Transit/Street-Centreline/4dx8-rtm5) | Road centreline geometry | 120,567 segments; nearest-road matching and ambiguity review |
| [Traffic Volumes 2024](https://data.calgary.ca/dataset/Traffic-Volumes-for-2024/cauu-7hnw) | Average weekday traffic counts | 334 sections, associated by proximity with 2,416 locations; context only |
| [ECCC hourly weather](https://climate.weather.gc.ca/climate_data/hourly_data_e.html?StationID=50430) | Airport observations | 32,922 hours from January 2023 through October 2026; historical filters and evidence |
| [Hackathon starter](https://github.com/nagusubra/industry-hackathon-lab) | Case sample | Source comparison and case context; app uses fresh official records |
| [OpenFreeMap](https://openfreemap.org/) / OpenMapTiles / OpenStreetMap | Vector cartography | Key-free basemap, independent of analytical road matches |
| [Google Fonts](https://fonts.google.com/) | Typography | Optional DM Sans / Space Grotesk, with fallback fonts |
| [Snow-clearing routes](https://data.calgary.ca/Health-and-Safety/Snow-and-Ice-Clearing-Priority-Routes-Map/fuea-eg5z) | Existing municipal winter priorities | Planned reference; not imported or scored |

## Traffic time and counting

Paginated source queries use `start_dt_utc >= 2023-01-01` through retrieval time. Source UTC is preserved; local dates/hours/weekends use America/Edmonton with DST. Local snapshot dates are 2022-12-31 through 2026-10-03. The latest reporting day and 2026 year are incomplete.

Source count strings `1` and `1.0` both mean one report. Duplicate IDs and invalid records are screened; current snapshot has no rejected or duplicate records. Five categories are text heuristics: Collision-related, Road conditions, Signals, Stalled vehicle, Other / unverified. They are not police-confirmed classifications or severity levels.

Raw report counts stay unchanged in weighted mode. Historical weighted activity is a separate frequency input. Forecast targets explicitly distinguish all reports from collision-related reports.

## Weather time and missingness

ECCC CALGARY INTL A: station 50430, climate ID 3031092, coordinates 51.12 / -114.01. Monthly [CSV endpoint](https://climate.weather.gc.ca/climate_data/bulk_data_e.html?format=csv&stationID=50430&Year=2025&Month=1&Day=1&timeframe=1).

Source Date/Time (LST) is fixed UTC−7, including summer; conversion to UTC precedes event-hour matching. Local display uses America/Edmonton. Current-month future rows are excluded. All traffic records with local years 2023–2026 match a station hour; seven retained local-2022 boundary reports do not. A matched hour does not guarantee complete measurements.

54 hours lack temperature/visibility; 18,172 descriptions are unavailable. Nulls and short rows remain missing. Blank descriptions do not establish clear skies. Snow/rain require explicit descriptions; below freezing means temperature <0°C; low visibility means <1 km. Conditions overlap. Airport weather is not road-surface weather, and per-100-observation-hour rates are not traffic exposure or crash risk. Future weather is excluded from forecasting.

## Spatial associations

A local metre approximation at 51°N and spatial index assign the nearest segment within 50 m. 27,775 reports match roads; 30 use fallback grid cells, producing 9,661 locations. Current geometry is not a historical inventory.

Review flags: 11,757 junction, 6,976 parallel, 3,052 segment-boundary, 5,990 isolated-proximity and 30 unmatched records. Competing distance gap ≤10 m, crossing angle ≥30° and true polyline ends within 20 m are heuristic thresholds, not confidence probabilities. Assignments are preserved; flags do not prove errors or automatically change scoring. Manual ground-truth review remains pending.

Volume association uses a 30 m proximity threshold. No verified section linkage or year/hour-specific exposure is available; 2024 volume is context across the multi-year event snapshot.

## Starter differences

The comparison is specifically against the **original 2025 snapshot**, not current multi-year totals. Starter: 6,984 records; official UTC-year 2025: 7,015. One-to-one matching found 6,980 pairs, four unmatched starter and 35 unmatched official records. Normalized descriptions/quadrants/counts agreed. Mixed apparent offsets (0/+6/+7 hours), seconds and coordinate precision differ; the conversion history is unconfirmed. Seventeen early UTC-year records lie on local December 31, 2024. See `reports/starter-official-comparison.json`.

## Reproducibility and delivery

`data/manifest.json` and `data/weather-manifest.json` record hashes and weather download URLs. Raw files in `data/raw` are not committed. Rebuild using the fetch/prepare scripts documented in README. Audits are in `reports/data-audit.json`, `reports/spatial-audit.json`, and `reports/weather-audit.json`.

Source JSON stays in `public/data` for offline analysis. Build creates level-9 gzip files and deploys only those copies: ~3.56 MB traffic, ~0.45 MB weather. Browser decoding accepts raw gzip and already HTTP-decoded JSON. Parsed memory remains larger than transfer size.

## Terms and interpretation

[Calgary terms](https://data.calgary.ca/stories/s/Open-Calgary-Terms-of-Use/u45n-7awa), [ECCC terms](https://www.canada.ca/en/environment-climate-change/corporate/transparency/terms-conditions.html), [OpenStreetMap attribution](https://www.openstreetmap.org/copyright).

Report coverage and count prediction are proxies. They do not demonstrate injury prevention, causal effects, verified exposure or operational safety. Preserve provider attribution.

## Annual EB data and units

The separate annual pipeline uses the official incident archive from local 2017 onward, 120,567 road segments and 46,007 derived intersections. Events prefer an intersection within 76 m, otherwise a segment within 50 m. These units differ from the reactive dashboard's nearest-road/grid locations. Shared source IDs provide associations, not interchangeable location IDs.

Annual traffic exposure uses City yearly volume counts from 2016–2019 and 2022–2024, restricted to count years at or before each cutoff; 2020–2021 were unpublished. Coverage is approximately 23% of segments and 33% of intersections. Actual release dates and historical road geometry remain unverified. Annual EB does not use weather, time of day or event categories. See [analysis documentation](analysis/README.md) for source preparation and limitations.

The annual export carries the prepared-data fingerprint, fitted history, latest complete date, predictive intervals and source examples. Build deploys its gzip snapshot (~0.22 MB). The original starter comparison remains a 2025 provenance check and does not describe this longer archive.
