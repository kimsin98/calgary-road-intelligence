# Data sources and reproducibility

Snapshot retrieved October 3, 2026. No credentials required.

| Source | Original purpose | Use |
|---|---|---|
| [Traffic Incidents](https://data.calgary.ca/Transportation-Transit/Traffic-Incidents/35ra-9556) | Public archive of traffic disruptions, including signal problems, road hazards, stalled vehicles and some unverified collisions | Main evidence; 7,015 UTC-year 2025 records |
| [Street Centreline](https://data.calgary.ca/Transportation-Transit/Street-Centreline/4dx8-rtm5) | Street right-of-way centreline geometry | 120,567 segments, downloaded across three pages; nearest segment for events |
| [Traffic Volumes 2024](https://data.calgary.ca/dataset/Traffic-Volumes-for-2024/cauu-7hnw) | Average weekday two-way traffic volume | 334 sections; nearby contextual volume for 1,219 locations |
| [Prepared case seed](https://github.com/nagusubra/industry-hackathon-lab/tree/main/01-energy-and-infrastructure-systems/Case%205%20-%20Autonomous%20Calgary%20Collision-Hotspot%20Ranking%20Agent) | Hackathon sample | Inspected only; actual analysis uses official records with IDs and UTC fields |

Source portal licenses point to City of Calgary open-data terms. Preserve attribution and review current terms before distribution: https://data.calgary.ca/stories/s/Open-Calgary-Terms-of-Use/u45n-7awa

Raw snapshots are stored in data/raw. SHA-256 values are recorded in data/manifest.json for the main snapshots. To rebuild from retained raw files: npm run prepare:data. The manifest tracks source inputs; source retrieval code and the full audit are also retained.

## Time and counting

`start_dt_utc` is parsed explicitly as UTC and converted with Intl / America/Edmonton, including daylight saving. The source query covers UTC 2025; a few local dates fall on December 31, 2024 and are excluded by the default January–December 2025 UI filter. Thus the raw and displayed totals differ legitimately.

All fetched `count` values are 1. Records are deduplicated by source ID. Recurrence is the number of distinct local dates, not a count of independent causes. Event description categories are deterministic text heuristics and should be manually audited before operational use.

## Spatial matching

Distance uses a local equirectangular approximation at 51° N (69,900 m per longitude degree, 111,200 m per latitude degree). It is adequate for prototype proximity checks, not surveyed geometry. A metre-based spatial index accelerates the matching. 7,009 events are within 50 m of a road; six use 150 m fallback grid cells. High proximity coverage does not prove correct road identity. Current road inventory is not filtered to its historical 2025 state.

Volume matches use proximity within 30 m to traffic-count sections. They are displayed only as nearby context: no road-name check or verified section identity has been established, and 2024 average weekday traffic is not 2025 hourly exposure.

## Remaining limitations

Traffic Incidents is an unofficial archive hosted by the City, with possible collection gaps. It is not a complete police collision dataset. Labels such as collision-related are text classifications, not confirmed severity. Scores are comparative inspection priorities within the selected view. Historical future-record coverage is a reproducible proxy; it cannot prove fewer crashes or useful field inspections.

## Historical weather extension

Environment and Climate Change Canada, CALGARY INTL A, station ID 50430 / climate ID 3031092 (51.12, -114.01). Official hourly CSV endpoint: https://climate.weather.gc.ca/climate_data/bulk_data_e.html?format=csv&stationID=50430&Year=2025&Month=1&Day=1&timeframe=1 . Attribution and reuse terms: https://www.canada.ca/en/environment-climate-change/corporate/transparency/terms-conditions.html .

Downloaded all 12 months; 8,760 unique hourly timestamps. Source Date/Time (LST) uses fixed UTC-7, converted to UTC before matching the event's UTC hour. Local display and time-of-day filtering use America/Edmonton including DST. Raw hashes and URLs: data/weather-manifest.json. Processed snapshot: public/data/weather.json; audit: reports/weather-audit.json. Rebuild using npm run fetch:weather then npm run prepare:weather. This preparation is separate from the main event pipeline.

Eight rows have missing temperature/visibility. Short CSV rows containing only station and timestamp fields are preserved as missing observations. 4,984 weather descriptions are empty/NA; these do not establish clear weather. Hourly precipitation amount is not used. Snow and rain filters use explicit text reports; below-freezing uses temperature <0°C; low visibility uses <1 km. Conditions overlap and do not imply road ice.

6,998 of 7,015 UTC-year events match a weather hour. The unmatched 17 precede the local-year station snapshot; the default local-2025 view excludes them. One default-view event matches an hour with missing temperature. Airport weather is city-wide context, not measured conditions at each road. Station exposure hours are filtered by date and time-of-day; category filters events only. Per-100-hour counts are not traffic-normalized risk and do not imply causality.

## Competing-road screening

`npm run audit:spatial` retains original road assignments and examines alternative segment IDs within 50 m. An alternative with distance gap ≤10 m triggers a heuristic review: ≥30° direction difference is junction ambiguity; smaller direction difference is parallel ambiguity unless same-name polyline ends are both within 20 m (segment boundary). These are review labels, not confidence probabilities. Polyline interior vertices are not treated as endpoints.

Results: 3,084 junction flags, 1,750 parallel flags, 726 segment-boundary flags, 1,449 isolated proximity records and six unmatched grid records. No manual ground-truth audit has been completed. Road naming, split geometry and coordinate precision can create false flags. `reports/spatial-audit.json` contains thresholds and deterministic source-record examples. Event evidence displays up to three competing segment IDs and distances; JSON exports include per-event review evidence. Locations are not automatically reassigned, merged or penalized based on these unvalidated heuristics.
