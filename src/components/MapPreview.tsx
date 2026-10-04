import type { RankedLocation, RankedPlan } from "../domain/types";
import type { RefObject, Dispatch, SetStateAction, ReactNode } from "react";
type Row = RankedLocation;
export function MapPreview({
  tab,
  mapShell,
  expanded,
  fullscreen,
  mapNotice,
  container,
  setExpanded,
  toggleFullscreen,
  timeline,
  plan,
  focus,
  setSelected,
  setTab,
  map,
}: {
  tab: string;
  mapShell: RefObject<HTMLDivElement | null>;
  container: RefObject<HTMLDivElement | null>;
  expanded: boolean;
  fullscreen: boolean;
  mapNotice: string;
  setExpanded: Dispatch<SetStateAction<boolean>>;
  toggleFullscreen: () => void;
  timeline: ReactNode;
  plan: RankedPlan;
  focus: RankedLocation | null;
  setSelected: (id: string) => void;
  setTab: (tab: string) => void;
  map: RefObject<import("maplibre-gl").Map | null>;
}) {
  return (
    <div className="preview-content" hidden={tab !== "Map preview"}>
      <div
        ref={mapShell}
        className={`map-shell ${expanded ? "map-expanded" : ""} ${fullscreen ? "map-fullscreen" : ""}`}
      >
        <div className="map-title">
          <span>
            <i /> CALGARY EVENT NETWORK
          </span>
          {mapNotice && <p role="alert">{mapNotice}</p>}
        </div>
        <div ref={container} className="map" />
        <div className="map-actions">
          <button
            aria-label="Toggle map webpage fullscreen"
            onClick={() => setExpanded((v: boolean) => !v)}
          >
            {expanded ? "↙ Restore layout" : "↗ Expand map"}
          </button>
          <button
            aria-label="Toggle map browser fullscreen"
            onClick={toggleFullscreen}
          >
            {fullscreen ? "⤡ Exit fullscreen" : "⛶ Fullscreen"}
          </button>
        </div>
        {(expanded || fullscreen) && timeline}
        <div className="map-hud">
          <span className="hud-item">
            <span className="orange-dot" /> {plan.top.length} priority locations
          </span>
          <span className="hud-item">
            <span className="teal-dot" /> Other locations
          </span>
        </div>
      </div>
      {!expanded && !fullscreen && timeline}
      <aside className="shortlist">
        <div className="panel-heading">
          Inspection shortlist <span>{plan.top.length}</span>
        </div>
        <div className="panel-subtitle">RANKED FOR REVIEW</div>
        <div className="list-caption">
          PRIORITY <span>CHANGE VS COUNT RANK</span>
        </div>
        {plan.top.map((r: Row) => (
          <button
            className={`list-row ${focus?.id === r.id ? "chosen" : ""}`}
            key={r.id}
            onClick={() => {
              setSelected(r.id);
              if (tab !== "Map preview") setTab("Evidence");
              map.current?.flyTo({
                center: [r.lon, r.lat],
                zoom: 14.5,
                speed: 0.9,
              });
            }}
          >
            <span className="rank-number">
              {String(r.position).padStart(2, "0")}
            </span>
            <div>
              <strong>{r.name}</strong>
              <small>
                {r.id.replace("road:", "Segment ")} · {r.count} events{" "}
                {r.lowEvidence ? "· low evidence" : ""}
              </small>
            </div>
            <span className="rank-score">
              {r.score.toFixed(0)}
              <small
                className={
                  r.baseline - r.position >= 0 ? "positive" : "negative"
                }
              >
                {r.baseline - r.position > 0
                  ? "↑"
                  : r.baseline - r.position < 0
                    ? "↓"
                    : "–"}
                {Math.abs(r.baseline - r.position) || ""}
              </small>
            </span>
          </button>
        ))}
        {plan.top.length === 0 && (
          <p className="empty">No recorded events match these filters.</p>
        )}
      </aside>
    </div>
  );
}
