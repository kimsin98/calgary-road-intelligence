# Calgary Road Disruption Intelligence

## Goal
Help road operations teams decide where to inspect first through both reactive and proactive analysis, following Rahul and Gaurav's feedback.

## Reactive Analysis — Core Workflow

- Summarize historical traffic events and recurring hotspots.
- Rank the Top 20 inspection locations and explain priorities with source evidence.
- Compare plans across weights, capacity, time periods, and weather conditions.

## Proactive Analysis — Additional Demo

- Use evidence available at a historical cutoff to identify locations needing attention in the next 7 or 30 days.
- Compare a smoothed historical event-rate baseline with recent-trend signals.
- Show an experimental forward-looking ranking, its differences from the reactive shortlist, and uncertainty.
- Treat selected future weather as a scenario, not a known forecast.
- Validate across historical cutoffs using later records, with separate tuning and test windows.

## Intended Value and Limitations
Support earlier inspection planning alongside retrospective review. Limited reporting, one-year history, uncertain road matches, and missing traffic exposure make proactive analysis experimental—not a validated crash-probability estimate. Historical weather filtering alone is not prediction.

In the pitch, explain these limits and future improvements: multi-year data, confirmed collision/severity records, better location matching, traffic exposure, weather forecasts, and operational feedback.

## Additional Data Sources

- [Calgary Street Centreline](https://data.calgary.ca/Transportation-Transit/Street-Centreline/4dx8-rtm5): Road matching and ambiguity checks.
- [Calgary Traffic Volumes 2024](https://data.calgary.ca/dataset/Traffic-Volumes-for-2024/cauu-7hnw): Traffic-volume context.
- [ECCC Historical Weather](https://climate.weather.gc.ca/historical_data/search_historic_data_e.html): Historical weather patterns and scenario evidence.
- [Calgary Snow-Clearing Priority Routes](https://data.calgary.ca/Health-and-Safety/Snow-and-Ice-Clearing-Priority-Routes-Map/fuea-eg5z): Reference existing winter priorities.

Forecast validation: use expanding-year cross-validation (2023→2024; 2023–2024→2025) to select regularization, refit on 2023–2025, and reserve 2026 for independent rolling 7/30-day evaluation. Compare with historical count priorities; publish all fold and holdout results rather than assuming the model improves ranking.
