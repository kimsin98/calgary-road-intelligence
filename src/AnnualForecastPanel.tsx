import { suggestImprovement, type SiteControl } from "./domain/countermeasures";
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
  observedReports?:number|null;
  roadClass?:string; minorRoadClass?:string|null; signalized?:boolean; stopSigns?:number; yieldSigns?:number; crosswalks?:number;
  relatedDashboardLocationIds?: string[];
  reportEvidence?: { id: string; date: string; description: string }[];
}
interface AnnualData {
  mode?: string;
  historySelection?: string;
  observation?: {through:string; complete:boolean; totalReports?:number; top20Reports?:number}|null;
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
  const [revealed,setRevealed]=useState(false);
  const [entries,setEntries]=useState<{cutoff:string;url:string}[]>([]),[draft,setDraft]=useState("latest"),[url,setUrl]=useState("/data/forecast-annual.json.gz");
  useEffect(()=>{fetch("/data/annual-replays/index.json").then(r=>{if(!r.ok)throw Error();return r.json()}).then(v=>setEntries(v.entries)).catch(()=>setError("Annual replay index unavailable."))},[]);
  useEffect(() => {
    setData(null);setError("");setSelected(null);setRevealed(false);
    const c = new AbortController();
    loadSnapshot(url, c.signal)
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
  }, [url]);
  const controls=<div className="forecast-controls"><label>Annual evidence cutoff<select aria-label="Annual cutoff" value={draft} onChange={e=>setDraft(e.target.value)}><option value="latest">Latest · future forecast</option>{entries.map(e=><option key={e.cutoff} value={e.url}>{e.cutoff} · historical replay</option>)}</select></label><button onClick={()=>setUrl(draft=== "latest"?"/data/forecast-annual.json.gz":draft)}>Apply annual cutoff</button></div>;
  if (error) return <>{controls}<p role="alert">{error}</p></>;
  if (!data) return <>{controls}<p role="status">Loading precomputed annual outlook…</p></>;
  const future = !data.observation;
  const siteControl = (r:AnnualUnit):SiteControl|undefined => r.signalized===undefined?undefined:{kind:r.kind as SiteControl["kind"],name:r.name,roadClass:r.roadClass??null,minorRoadClass:r.minorRoadClass??null,legs:0,signalized:r.signalized,stopSigns:r.stopSigns??0,yieldSigns:r.yieldSigns??0,crosswalks:r.crosswalks??0};
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
      {controls}
      {data.observation&&<p className="notice">Historical replay · observed through {data.observation.through}. {data.observation.complete?"Full 365-day observation window available.":"Partial observation window; this is not a complete annual backtest."} Forecast covers 365 days. {data.historySelection}</p>}
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
      <section className="algorithm-note" aria-label="Algorithm and rationale">
        <span className="outlook-eyebrow">ALGORITHM / WHY THIS MODEL</span>
        <h3>Empirical Bayes · next 12 months</h3>
        <p>A site-characteristic Poisson safety performance function provides the prior; empirical Bayes blends it with each location’s own history. A negative-binomial posterior provides predictive count intervals. The five-year history window was selected by historical annual backtests.</p>
        <p><strong>Why EB:</strong> annual report counts are overdispersed and many inventory locations have no prior reports. Shrinkage reduces reliance on noisy individual histories and allows ranking never-reported sites using road characteristics and partial traffic-volume data. Reproduced annual backtests show lower average deviance than the ridge comparator; yearly rankings and simple baselines remain visible below.</p>
        <p>The model assumes broadly stable rates. Traffic reports are not confirmed crashes; historical geometry and volume publication dates remain unverified.</p>
      </section>
      <p>
        Evidence through {data.dataThrough} · forecast {data.horizon.start} ~{" "}
        {data.horizon.end} · history {data.history.start} ~ {data.history.end}.
      </p>
      <button onClick={() => downloadJson(data, "calgary-annual-outlook.json")}>
        Export annual outlook
      </button>
      <ForecastMap result={preview} />
      {data.observation&&<button onClick={()=>setRevealed(v=>!v)}>{revealed?"Hide annual outcomes":"Reveal annual outcomes"}</button>}
      {revealed&&data.observation&&<p>Observed through {data.observation.through}: {data.observation.totalReports??"unavailable"} reports; forecast Top20 captures {data.observation.top20Reports??"unavailable"}. {data.observation.complete?"Complete window.":"Partial window; full-year expected counts are not directly comparable."}</p>}
      <table>
        <thead>
          <tr>
            <th>Location</th>
            <th>Expected reports</th>
            <th>90% predictive interval</th>
            <th>Own-history / similar-sites prior</th>
            {future&&<th>Suggested improvement · review candidate</th>}
            {revealed&&<th>Observed reports</th>}
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
              {future&&<td className="suggestion-cell">{suggestImprovement(siteControl(r))?<button onClick={()=>setSelected(r.id)}>{suggestImprovement(siteControl(r))!.action}</button>:"No supported treatment match"}<small>Verify mapped facilities and study applicability</small></td>}
              {revealed&&<td>{r.observedReports??"Unavailable"}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      {focus && (
        <section>
          <h3>{focus.name ?? focus.id} · annual-unit evidence</h3>
          {future&&<section aria-label="Annual candidate improvement"><h4>Candidate improvement · expert review required</h4>{suggestImprovement(siteControl(focus))?<><p>{suggestImprovement(siteControl(focus))!.action}</p><p>{suggestImprovement(siteControl(focus))!.source}</p><p>External study CMF: {suggestImprovement(siteControl(focus))!.cmf}. It applies to crashes in the study population, not predicted reductions in traffic reports. Verify mapped assets, local geometry and engineering warrants.</p></>:<p>No supported treatment match. Facility absence and treatment suitability cannot be established from nearby mapped records alone.</p>}</section>}
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
        <p>Global calendar-year research results; this table does not score the currently selected rolling forecast.</p>
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
