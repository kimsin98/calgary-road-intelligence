import { LocationPicker } from "../LocationPicker";
import { MatchQuality } from "../MatchQuality";
import { LocationCharts } from "../DecisionPanels";
import type {
  AnalysisConfig,
  RankedLocation,
  RankedPlan,
} from "../domain/types";
type Row = RankedLocation;
export function EvidencePage({
  selected,
  focus,
  plan,
  setSelected,
  config,
  activeConfig,
}: {
  selected: string | null;
  focus: RankedLocation | null;
  plan: RankedPlan;
  setSelected: (id: string) => void;
  config: AnalysisConfig;
  activeConfig: AnalysisConfig;
}) {
  return (
    <>
      {" "}
      {selected && !focus && (
        <div className="decision-panel notice">
          <h2>Selected location is outside this view</h2>
          <p>
            {selected} has no records matching the current date and filters.
            Adjust the analysis scope or choose another location below.
          </p>
        </div>
      )}
      {
        <LocationPicker
          rows={plan.rows}
          selected={selected || focus?.id}
          onSelect={setSelected}
        />
      }
      {focus && (
        <div className="evidence">
          <div>
            <div className="eyebrow">SELECTED LOCATION</div>
            <h2>{focus.name}</h2>
            <p>
              {focus.count} events across {focus.days} dates ·{" "}
              {focus.lowEvidence ? "Limited evidence" : "Repeated observations"}
            </p>
            {focus.volume && (
              <p className="volume-note">
                Nearby 2024 section:{" "}
                {focus.volume.vehiclesPerWeekday.toLocaleString()} vehicles /
                weekday · {focus.volume.distance} m away. Proximity only; verify
                section linkage.
              </p>
            )}
            <div className="contributions">
              {["Frequency", "Growth", "Recurrence"].map((s, i) => (
                <div key={s}>
                  <span>{s}</span>
                  <div className="bar">
                    <i style={{ width: `${focus.contributions[i]}%` }} />
                  </div>
                  <b>{focus.contributions[i].toFixed(1)}</b>
                </div>
              ))}
            </div>
          </div>
          <div className="records">
            {[...focus.records]
              .sort((a, b) => b.utc.localeCompare(a.utc))
              .slice(0, 3)
              .map((e) => (
                <article key={e.id}>
                  <time>
                    {e.date} · {String(e.hour).padStart(2, "0")}:00 MT
                  </time>
                  <strong>{e.reportedLocation}</strong>
                  <p>{e.description}</p>
                  <small className="record-weather">
                    {e.weather
                      ? `Airport: ${e.weather.temp === null ? "temperature unavailable" : e.weather.temp + " °C"} · ${e.weather.description || "weather description unavailable"} · ${e.weather.visibility === null ? "visibility unavailable" : e.weather.visibility + " km visibility"}`
                      : "No matching airport observation"}
                  </small>
                </article>
              ))}
          </div>
        </div>
      )}
      {focus && <MatchQuality row={focus} />}
      {focus && (
        <LocationCharts
          row={focus}
          start={config.start}
          end={activeConfig.end}
        />
      )}
    </>
  );
}
