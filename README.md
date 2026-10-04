# Calgary Road Disruption Intelligence

A working historical road-inspection shortlist tool for IEEE Industry Hackathon Option B, Energy & Infrastructure Case 5.

## Run

Requires Node.js 22+.

```sh
npm install
npm run dev -- --port 5173
```

Open http://localhost:5173. The checked-in processed snapshot supports the demo without live data services. Font downloads are optional. The dark vector basemap uses OpenFreeMap / OpenStreetMap data and requires network access; local road and event overlays remain available if tiles fail.

```sh
npm run prepare:data
npm test
npm run build
npm run test:browser  # install Chromium + OS dependencies first
```

## Implemented

- Official 2025 UTC-year traffic records, converted to Calgary local time.
- Complete paginated street-centreline snapshot and 50 m nearest-road association.
- Interactive vector map, linked shortlist, source records, monthly/category charts and score contributions.
- Date, time-of-day, category, capacity and transparent scoring controls.
- Count-only baseline, detailed saved-plan comparison, rank/contribution changes, CSV and reproducible JSON report export.
- Background-worker search over 21 weight combinations; separate tuning and final validation windows.
- Three historical holdout windows with next-month record coverage comparison.
- Nearby 2024 traffic-volume context (not used as verified exposure in ranking).

Data quality, scoring definitions and source links are available inside the app. See DATA_SOURCES.md and reports/data-audit.json.

## Architecture

Official snapshots → Node preparation and spatial matching → local dataset JSON → shared analysis module → React / MapLibre workbench.

The prototype computes locally in the browser; a separate API server is unnecessary for this fixed snapshot. No LLM or ElevenLabs connection is implemented. Automatic evaluation searches a bounded weight grid in a Web Worker. Users review the evidence before applying selected weights.

## Interpretation

This ranks recorded disruptions for further review. It does not predict injuries or certify road safety. Most source descriptions are generic or unverified. Nearest-road matches can select the wrong parallel road or side of an intersection. Current geometry may differ from the 2025 inventory. Score weights are illustrative.

Default historical comparison: June and August holdouts tie the count baseline; October covers three more subsequent records. This is limited evidence, not a validated operating policy or proof of safety benefit.

## Attribution

City of Calgary: Traffic Incidents, Street Centreline, Traffic Volumes for 2024. Prepared case context and original seed: nagusubra/industry-hackathon-lab. Application and analysis code were created for this prototype; the case seed was used to inspect available fields, while the application uses fresh official records with explicit UTC fields.

## Next decisions

Before expanding, review map usability and a sample of road associations. Validate ranking priorities with an industry mentor. Strong next additions are weather joins and confidence-aware grouping around intersections. Weather, snow-route layers, speech and a live-data service are not yet implemented.

## OpenStreetMap vector basemap

MapLibre loads key-free OpenFreeMap vector tiles based on OpenStreetMap. The local style file public/maps/calgary-dark.json adapts the OpenFreeMap dark style with navy land, blue water, readable grey-blue roads and lighter labels. Hotspots and official road geometry remain separate overlay layers. Map attribution credits OpenFreeMap, OpenMapTiles and OpenStreetMap. No Google key or raster darkening is used.

Vector tiles, glyphs and sprites require network access. The app's dataset stays local. Provider information: https://openfreemap.org/ . Style source: https://tiles.openfreemap.org/styles/dark .

## Map display modes

Map controls offer Expand map (fills the webpage; Escape or Restore layout exits) and Fullscreen (browser Fullscreen API; exit using Escape or the same control). If browser fullscreen is unavailable, it falls back to webpage expansion. Fullscreen in an embedded iframe may require the parent to grant fullscreen permission. Map sizing follows container changes via ResizeObserver.

## Decision workflow

1. Open Automatic evaluation and select Evaluate candidate plans.
2. Inspect all search results and the separate December 1–30 validation.
3. Apply the selected weights; the original plan is saved automatically.
4. Plan comparison shows entered/exited/retained locations, rank and score-contribution changes.
5. Evidence shows monthly counts, categories and original records. Export report saves parameters, record IDs, the saved shortlist and all search evidence.

Search uses 90-day histories ending April 30 and July 31 with the following 30 days as tuning outcomes. November 30 history and December 1–30 outcomes are held separate from selection. Dates are fixed for the 2025 snapshot; category, time-of-day and capacity apply to each window. Ties favour count-only. Default search picks weights 0 / 0.2 / 0.8 and covers 24 vs 21 future records in validation (827 total); this single small difference is not stable proof of improvement. See reports/automatic-evaluation.json. Repeated inspection/tuning on final validation must be treated as exploratory.

Run `node tests/decisions-browser.mjs` for the decision workflow browser checks.

## Weather context

The optional-weather stage is implemented using the checked-in ECCC Calgary airport 2025 hourly snapshot. Select Below freezing, Snow reported, Rain reported, Low visibility or Weather unavailable in Analysis controls. Weather filters participate in ranking, saved comparisons, historical evaluation and bounded search. Weather context shows event counts and observed-hour exposure; selected records show the matched temperature, weather description and visibility.

Run `npm run fetch:weather` and `npm run prepare:weather` to refresh/rebuild the independent weather snapshot; see DATA_SOURCES.md for station, timestamps and caveats. Run `node tests/weather-browser.mjs` for weather interaction checks. No weather API key is required.

## Road-association review

Selected Evidence now includes geometric review flags and competing road IDs/distances. The review uses distance, segment direction and true polyline endpoints to identify ambiguity; it preserves existing assignments. Many records are at junctions or nearby parallel roads, so proximity coverage does not certify road identity. Run `npm run audit:spatial` to rebuild, `node tests/spatial-browser.mjs` to verify the panel, and inspect reports/spatial-audit.json. Manual ground-truth review and any subsequent reassignment remain pending.

## Experimental forward outlook

Open Forward outlook to generate a 7/30-day expected-report forecast at a historical cutoff. The shared regularized Poisson model trains on March–June windows and tunes on August outcomes. Reveal later events to compare count error and Top20 coverage with the smoothed rate baseline. Default model coverage is 20 vs baseline21 despite lower count MAE, so it does not establish a better inspection policy. Future weather is excluded; full-year known-location inventory and repeated test exploration limit prospective interpretation. See reports/forecast-windows.json. Run `node tests/forecast-browser.mjs` for interaction verification.


## Expanded snapshot (2026-10-04)

The current traffic snapshot contains 27,805 UTC records from January 2023 through October 2026 (Calgary local date range 2022-12-31 to 2026-10-03). Local boundary records are retained; the latest UTC date is October 4. The default analysis shows the latest 90 days, with the full snapshot available in date controls. Forecast fitting uses quarterly 2023–2024 windows plus March/June 2025, with August/September/November 2025 internal tuning. 2026 outcomes are reserved for independent backtests. Future prediction starts at the latest observed local date. Weather remains a 2025-only snapshot; 2024 volume is proximity context across years, not verified exposure. The current local date is still an incomplete reporting day. See reports/forecast-2026-evaluation.json for current evaluation; earlier reports describe older snapshots.
