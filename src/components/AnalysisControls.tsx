import type { AnalysisConfig } from "../domain/types";
import { WEATHER_OPTIONS } from "../weather.mjs";
export function AnalysisControls({
  tab,
  config,
  setConfig,
  data,
  controlVisibility,
  plan,
  savePlan,
  change,
}: {
  tab: string;
  config: AnalysisConfig;
  setConfig: (config: AnalysisConfig) => void;
  data: any;
  controlVisibility: ReturnType<typeof import("../domain/pages").pageControls>;
  plan: any;
  savePlan: () => void;
  change: any;
}) {
  return (
    <>
      {" "}
      <div
        hidden={["Forward outlook", "Data & method"].includes(tab)}
        className={`page-controls ${tab === "Evidence" ? "evidence-controls" : ""}`}
      >
        <details className="dashboard-controls">
          <summary>Analysis controls</summary>
          <div className="panel-heading">
            Analysis controls <span>01</span>
          </div>
          <div className="panel-subtitle">CONFIGURE THE MISSION</div>
          <div className="control-scope">
            <h3>Evidence scope</h3>
            {controlVisibility.dates && (
              <>
                <label>Date window</label>
                <div className="dates">
                  <input
                    aria-label="Start date"
                    type="date"
                    min={data.audit.first}
                    max={data.audit.last}
                    value={config.start}
                    onChange={(e) =>
                      e.target.value &&
                      setConfig({
                        ...config,
                        start: e.target.value,
                        end:
                          e.target.value > config.end
                            ? e.target.value
                            : config.end,
                      })
                    }
                  />
                  <input
                    aria-label="End date"
                    type="date"
                    min={config.start}
                    max="2025-12-31"
                    value={config.end}
                    onChange={(e) =>
                      e.target.value &&
                      setConfig({ ...config, end: e.target.value })
                    }
                  />
                </div>
              </>
            )}
            {controlVisibility.period && (
              <>
                <label>Time of day · Calgary local</label>
                <select
                  value={config.period}
                  onChange={(e) =>
                    setConfig({ ...config, period: e.target.value })
                  }
                >
                  {[
                    "All hours",
                    "Morning peak",
                    "Evening peak",
                    "Night",
                    "Weekend",
                  ].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </>
            )}
            {controlVisibility.category && (
              <>
                <label>Event type</label>
                <select
                  value={config.category}
                  onChange={(e) =>
                    setConfig({ ...config, category: e.target.value })
                  }
                >
                  {["All types", ...Object.keys(data.audit.categories)].map(
                    (s) => (
                      <option key={s}>{s}</option>
                    ),
                  )}
                </select>
              </>
            )}
            {controlVisibility.weather && (
              <>
                <label>Weather context</label>
                <select
                  aria-label="Weather condition"
                  value={config.weather}
                  onChange={(e) =>
                    setConfig({ ...config, weather: e.target.value })
                  }
                >
                  {WEATHER_OPTIONS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <p className="hint">
                  Airport hourly observations; below freezing does not mean road
                  ice.
                </p>
              </>
            )}
          </div>
          <div
            className="control-priority"
            hidden={!controlVisibility.capacity}
          >
            <h3>Ranking & capacity</h3>
            {controlVisibility.capacity && (
              <>
                <label>
                  Inspection capacity <b>{config.capacity} locations</b>
                </label>
                <input
                  aria-label="Inspection capacity"
                  type="range"
                  min="5"
                  max="40"
                  value={config.capacity}
                  onChange={(e) =>
                    setConfig({ ...config, capacity: +e.target.value })
                  }
                />
              </>
            )}
            {controlVisibility.weights && (
              <>
                <label>Priority mix</label>
                <p className="hint">
                  Transparent, adjustable signals. Scores indicate priority
                  within this view.
                </p>
                {["Event frequency", "Recent growth", "Recurring dates"].map(
                  (s, i) => (
                    <div className="weight" key={s}>
                      <label>
                        {s}
                        <b>{Math.round(config.weights[i] * 100)}</b>
                      </label>
                      <input
                        aria-label={s}
                        type="range"
                        min="0"
                        max="100"
                        value={config.weights[i] * 100}
                        onChange={(e) => {
                          const w = [...config.weights];
                          w[i] = +e.target.value / 100;
                          setConfig({ ...config, weights: w });
                        }}
                      />
                    </div>
                  ),
                )}
                {controlVisibility.weights && plan.weightFallback && (
                  <p className="notice">
                    No active scoring weights. Using the event-count baseline.
                  </p>
                )}
                {controlVisibility.weights && !plan.complete && (
                  <p className="notice">
                    Recent growth is disabled: select at least 60 days for
                    equal-window comparison.
                  </p>
                )}
              </>
            )}
            {controlVisibility.save && (
              <>
                <button className="primary" onClick={savePlan}>
                  Save current plan for comparison
                </button>
                {change && (
                  <div className="comparison">
                    <strong>
                      {change.entered.length} in · {change.exited.length} out
                    </strong>
                    <p>
                      {change.retained} locations retained from saved plan.
                      Adjust Analysis controls above to compare.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="source-note">
            SOURCE QUALITY
            <div>
              {(data.audit.matchRate * 100).toFixed(1)}% within 50 m of a road
            </div>
            <p>
              Nearest-road approximation; parallel roads and intersections need
              review. Events include unverified reports.
            </p>
          </div>
        </details>
      </div>
    </>
  );
}
