export function DataMethodPage() {
  return (
    <div className="method">
      <h2>Data sources & methodology</h2>
      <p>
        Analysis uses fixed public-data snapshots. Traffic records are converted
        from UTC to America/Edmonton; nearest-road associations and report
        categories are approximate, not confirmed collision or road-safety
        labels.
      </p>
      <h3>External data sources</h3>
      <div className="source-cards">
        {[
          [
            "Traffic Incidents",
            "City of Calgary",
            "https://data.calgary.ca/Transportation-Transit/Traffic-Incidents/35ra-9556",
            "27,805 reports from UTC January 2023 through October 2026. Primary event evidence, ranking and forecasting. Includes generic and unverified traffic disruptions.",
          ],
          [
            "Street Centreline",
            "City of Calgary",
            "https://data.calgary.ca/Transportation-Transit/Street-Centreline/4dx8-rtm5",
            "120,567 road segments. Spatial association and road geometry; current inventory does not certify historical road identity.",
          ],
          [
            "Traffic Volumes 2024",
            "City of Calgary",
            "https://data.calgary.ca/dataset/Traffic-Volumes-for-2024/cauu-7hnw",
            "334 count sections. Nearby average-weekday traffic context only; proximity linkage and year mismatch prevent treating it as verified event exposure.",
          ],
          [
            "Hourly Historical Weather",
            "Environment and Climate Change Canada",
            "https://climate.weather.gc.ca/climate_data/hourly_data_e.html?StationID=50430",
            "2023–2026 snapshot: 32,922 hours at CALGARY INTL A, station 50430. Temperature, reported weather and visibility; source MST timestamps are converted to UTC before event matching. Airport observations are not road-surface measurements.",
          ],
          [
            "Hackathon Starter Dataset",
            "IEEE case repository",
            "https://github.com/nagusubra/industry-hackathon-lab/tree/main/01-energy-and-infrastructure-systems/Case%205%20-%20Autonomous%20Calgary%20Collision-Hotspot%20Ranking%20Agent",
            "6,984 records in the case starter CSV. Used to inspect the case and compare source records; current analysis uses the official snapshot.",
          ],
          [
            "Vector Basemap",
            "OpenFreeMap / OpenMapTiles / OpenStreetMap",
            "https://openfreemap.org/",
            "Key-free map tiles, labels and buildings. Display context, independent of the official road-association dataset; requires network access.",
          ],
          [
            "Interface Fonts",
            "Google Fonts",
            "https://fonts.google.com/",
            "DM Sans and Space Grotesk provide interface typography. External font delivery is optional; local fallback fonts remain available. No analytical data is supplied.",
          ],
          [
            "Snow-Clearing Priority Routes",
            "City of Calgary · planned reference",
            "https://data.calgary.ca/Health-and-Safety/Snow-and-Ice-Clearing-Priority-Routes-Map/fuea-eg5z",
            "Proposed winter reference layer. Not currently imported or used in rankings; underlying downloadable data still needs verification.",
          ],
        ].map(([name, provider, url, description]) => (
          <article key={name}>
            <span>{provider}</span>
            <a href={url} target="_blank" rel="noreferrer">
              {name} ↗
            </a>
            <p>{description}</p>
          </article>
        ))}
      </div>
      <h3>Why totals differ from the starter dataset</h3>
      <p>
        The historical comparison below concerns the 2025 subset only. The app
        now includes 2023–2026 reports, so its full totals are not directly
        comparable to the starter. The starter has 6,984 records; the original
        official UTC-year 2025 snapshot has 7,015. A one-to-one comparison
        matched 6,980 starter records by location, nearby coordinates and time
        offsets. After whitespace normalization, matched descriptions, quadrants
        and counts agree. Four starter records and 35 official records remained
        unmatched; this does not mean all 35 are newly added events.
      </p>
      <p>
        Seventeen official records occur in early UTC January 1 but still fall
        on local December 31, 2024. A local-2025 view of that original snapshot
        excludes them, producing 6,998 displayed events. The 4,100 locations are
        our road/grid aggregation of that view, not a location count supplied by
        the starter.
      </p>
      <p>
        Starter timestamps have mixed apparent time conventions: 1,538 matched
        records differ from official UTC by 7 hours, 3,114 by 6 hours, and 2,328
        share the same hour. This is consistent with local winter/summer time
        for some records and UTC-like values for others, but the underlying
        conversion history is unconfirmed. Official timestamps are
        minute-resolution; starter values retain seconds. Coordinates also
        differ slightly in decimal precision. The official explicit UTC field is
        used for time filtering and weather joins.
      </p>
      <h3>Scoring and interpretation</h3>
      <p>
        Forecast fitting uses 2023–2025 histories and internal 2025 tuning; 2026
        is held out for evaluation. The default map scope is the latest 90 days.
        Weather observations cover January 2023 through October 2026; missing
        station measurements remain explicitly unavailable. Frequency uses
        normalized log count; recent growth compares two 30-day windows with
        smoothing; recurrence uses distinct event dates. Forecasts estimate
        report counts, not crash probabilities. Road matching, incomplete
        reporting and sparse location histories limit the conclusions.
      </p>
      <p>
        <a
          href="https://data.calgary.ca/stories/s/Open-Calgary-Terms-of-Use/u45n-7awa"
          target="_blank"
          rel="noreferrer"
        >
          Calgary open-data terms ↗
        </a>{" "}
        ·{" "}
        <a
          href="https://www.canada.ca/en/environment-climate-change/corporate/transparency/terms-conditions.html"
          target="_blank"
          rel="noreferrer"
        >
          ECCC terms ↗
        </a>{" "}
        ·{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          OpenStreetMap attribution ↗
        </a>
      </p>
    </div>
  );
}
