import { useEffect, useState } from "react";
import { loadSnapshot } from "./domain/loadSnapshot";
import { downloadJson } from "./domain/download";
import { ForecastMap } from "./components/ForecastMap";
import type { ForecastMapInput } from "./components/ForecastMap";
interface AnnualUnit {
  id: string;
  name: string | null;
  kind: string;
  lon: number;
  lat: number;
  expected: number;
  low90: number;
  high90: number;
  priorWeight: number;
  historyReports: number;
  last365Reports: number;
  ridgeRank: number;
  rank: number;
  relatedDashboardLocationIds?: string[];
  reportEvidence?: { id: string; date: string; description: string }[];
}
interface AnnualData {
  version: string;
  dataThrough: string;
  generatedAt: string;
  horizon: { start: string; end: string };
  history: { start: string; end: string };
  caveats: string[];
  units: AnnualUnit[];
  backtest: {
    years: {
      year: number;
      total: number;
      scoredThrough: string;
      lastYear: { top20OfOracle: number };
      historicalRate: { top20OfOracle: number };
      eb: { top20OfOracle: number };
      ridge: { top20OfOracle: number };
    }[];
  };
}
export function AnnualForecastPanel() {
  const [data, setData] = useState<AnnualData | null>(null),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    const c = new AbortController();
    loadSnapshot("/data/forecast-annual.json.gz", c.signal)
      .then((value) => {
        const d = value as AnnualData;
        if (!d?.horizon || !Array.isArray(d.units))
          throw Error("Invalid annual forecast");
        setData(d);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(String(e));
      });
    return () => c.abort();
  }, []);
  if (error) return <p role="alert">{error}</p>;
  if (!data) return <p>Loading precomputed annual outlook…</p>;
  const focus = data.units.find((r) => r.id === selected);
  const preview: ForecastMapInput = {
    historyLabel: "fitted history",
    cutoff: data.dataThrough,
    end: data.horizon.end,
    objective: "all",
    top: data.units.slice(0, 20).map((r) => ({
      ...r,
      name: r.name ?? r.id,
      predicted: r.expected,
      count: r.historyReports,
    })),
    rows: data.units.map((r) => ({
      ...r,
      name: r.name ?? r.id,
      predicted: r.expected,
      count: r.historyReports,
    })),
  };
  return (
    <div className="decision-panel">
      <div className="decision-heading">
        <h2>Annual planning outlook</h2>
        <span>EXPERIMENTAL / EMPIRICAL BAYES</span>
      </div>
      <p className="notice">
        Precomputed 12-month report outlook, not crash probability. Independent
        road/intersection units differ from the short-term dashboard; shortlist
        overlap is not directly comparable. Weather, time-of-day and event-type
        controls do not apply.
      </p>
      <p>
        Evidence through {data.dataThrough} · forecast {data.horizon.start} ~{" "}
        {data.horizon.end} · history {data.history.start} ~ {data.history.end}.
      </p>
      <button onClick={() => downloadJson(data, "calgary-annual-outlook.json")}>
        Export annual outlook
      </button>
      <ForecastMap result={preview} />
      <table>
        <thead>
          <tr>
            <th>Location</th>
            <th>Expected reports</th>
            <th>90% predictive interval</th>
            <th>Own-history / similar-sites prior</th>
          </tr>
        </thead>
        <tbody>
          {data.units.slice(0, 20).map((r) => (
            <tr key={r.id}>
              <td>
                <button onClick={() => setSelected(r.id)}>
                  {r.name ?? r.id}
                </button>
                <small>
                  {r.kind} · {r.id}
                </small>
              </td>
              <td>{r.expected.toFixed(1)}</td>
              <td>
                {r.low90} ~ {r.high90}
              </td>
              <td>
                {Math.round((1 - r.priorWeight) * 100)}% /{" "}
                {Math.round(r.priorWeight * 100)}%
                <small>Ridge rank {r.ridgeRank}</small>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {focus && (
        <section>
          <h3>{focus.name ?? focus.id} · annual-unit evidence</h3>
          <p>
            {focus.historyReports} reports in fitted history;{" "}
            {focus.last365Reports} in last 365 days. Records below belong to
            this annual unit, not the dashboard's nearest-road grouping.
          </p>
          <p>
            Associated dashboard locations (shared source IDs; distinct units):{" "}
            {focus.relatedDashboardLocationIds?.join(", ") ||
              "None in current snapshot"}
          </p>
          {focus.reportEvidence?.length ? (
            focus.reportEvidence.map((e) => (
              <article key={e.id}>
                <strong>{e.date}</strong>
                <p>{e.description}</p>
                <small>Source ID: {e.id}</small>
              </article>
            ))
          ) : (
            <p>Source examples are unavailable in this export.</p>
          )}
        </section>
      )}
      <details>
        <summary>Annual backtest</summary>
        <p>
          Top20 coverage as a fraction of the hindsight-optimal Top20, not the
          fraction of all reports or a safety improvement.
        </p>
        <table>
          <thead>
            <tr>
              <th>Year</th>
              <th>Scored through</th>
              <th>EB</th><th>Ridge</th><th>Last-year count</th><th>Historical rate</th>
            </tr>
          </thead>
          <tbody>
            {data.backtest.years.map((r) => (
              <tr key={r.year}>
                <td>{r.year}</td>
                <td>{r.scoredThrough}</td>
                {[r.eb, r.ridge, r.lastYear, r.historicalRate].map((m, i) => (
                  <td key={i}>{(m.top20OfOracle * 100).toFixed(1)}%</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      <details>
        <summary>Assumptions and limitations</summary>
        {data.caveats.map((c) => (
          <p key={c}>{c}</p>
        ))}
        <p>
          Historical road inventory and release-time availability are not
          verified. Annual model evidence does not validate the dashboard's
          learned event-type weights.
        </p>
      </details>
    </div>
  );
}
