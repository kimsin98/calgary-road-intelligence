import { useMemo } from "react";
import { summarizeWeather } from "./weather.mjs";
export function WeatherPanel({ data, config }: any) {
  const rows = useMemo(
    () => summarizeWeather(data.events, data.weather.hours, config),
    [data, config],
  );
  const audit = data.weather.audit;
  return (
    <div className="decision-panel">
      <div className="decision-heading">
        <h2>Weather observations</h2>
        <span>CALGARY INTL A · hourly observations</span>
      </div>
      <p>
        Airport observations matched by UTC hour. These describe city-wide
        weather context, not conditions at an individual road. Choose a weather
        condition in Analysis controls above to update the ranking.
      </p>
      <table>
        <thead>
          <tr>
            <th>Condition</th>
            <th>Events</th>
            <th>Observed hours</th>
            <th>Events / 100 hours</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r: any) => (
            <tr key={r.condition}>
              <td>{r.condition}</td>
              <td>{r.events}</td>
              <td>{r.hours}</td>
              <td>
                {r.condition === "Weather unavailable"
                  ? "—"
                  : r.per100Hours === null
                    ? "—"
                    : r.per100Hours.toFixed(1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">
        Counts use the selected date, time-of-day and event type, before the
        weather filter. Conditions overlap: a cold snowy hour can appear in both
        rows. Hours are weather-observation exposure, not traffic volume; these
        rates do not measure crash probability or establish cause. Blank weather
        descriptions do not imply clear skies.
      </p>
      <p>
        {audit.hours.toLocaleString()} station hours · {audit.tempMissing}{" "}
        missing temperatures · {audit.visibilityMissing} missing visibility
        observations · {data.weather.matched.toLocaleString()} /{" "}
        {data.events.length.toLocaleString()} events matched to a station hour.
      </p>
      <a
        href="https://climate.weather.gc.ca/climate_data/hourly_data_e.html?StationID=50430"
        target="_blank"
        rel="noreferrer"
      >
        Environment and Climate Change Canada station data ↗
      </a>
    </div>
  );
}
