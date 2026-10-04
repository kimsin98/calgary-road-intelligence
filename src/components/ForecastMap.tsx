import { useEffect, useRef, useState } from "react";
import type { Map, GeoJSONSource } from "maplibre-gl";
import type { FeatureCollection, Point } from "geojson";
export interface ForecastMapInput {
  historyLabel?: string;
  cutoff: string;
  end: string;
  objective: "all" | "collision";
  top: { id: string }[];
  rows: {
    id: string;
    name: string;
    lon: number;
    lat: number;
    predicted: number;
    count: number;
  }[];
}

/** Isolated forecast layer: no playback, reactive filters or future outcomes. */
export function ForecastMap({ result }: { result: ForecastMapInput }) {
  const container = useRef<HTMLDivElement>(null);
  const shell = useRef<HTMLElement>(null);
  const map = useRef<Map | null>(null);
  const [opened, setOpened] = useState(false);
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    if (!opened || !container.current) return;
    let cancelled = false;
    import("maplibre-gl")
      .then(({ default: lib }) => {
        if (cancelled || !container.current) return;
        const m = new lib.Map({
          container: container.current,
          style: "/maps/calgary-dark.json",
          center: [-114.075, 51.065],
          zoom: 10.1,
          attributionControl: { compact: true },
        });
        map.current = m;
        m.addControl(new lib.NavigationControl(), "bottom-left");
        m.on("error", () =>
          setNotice(
            "Basemap may be unavailable. Forecast points remain independent of the basemap.",
          ),
        );
        m.on("load", () => {
          m.addSource("forecast", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          });
          m.addLayer({
            id: "forecast-points",
            type: "circle",
            source: "forecast",
            paint: {
              "circle-radius": 5,
              "circle-color": [
                "case",
                ["get", "priority"],
                "#ffc85a",
                "#417c9c",
              ],
              "circle-opacity": ["case", ["get", "priority"], 0.95, 0.55],
            },
          });
          update(m);
        });
        m.on("click", "forecast-points", (e) => {
          const id = e.features?.[0]?.properties?.id;
          if (typeof id === "string") setSelected(id);
        });
        m.on("mouseenter", "forecast-points", () => {
          m.getCanvas().style.cursor = "pointer";
        });
        m.on("mouseleave", "forecast-points", () => {
          m.getCanvas().style.cursor = "";
        });
      })
      .catch(() =>
        setNotice(
          "Map engine unavailable. The forecast table remains available.",
        ),
      );
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, [opened]);
  function update(m: Map) {
    const current = latest.current;
    const ids = new Set(current.top.map((r) => r.id));
    const features: FeatureCollection<Point> = {
      type: "FeatureCollection",
      features: [...current.rows]
        .sort((a, b) => Number(ids.has(a.id)) - Number(ids.has(b.id)))
        .map((r) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [r.lon, r.lat] },
          properties: { id: r.id, priority: ids.has(r.id) },
        })),
    };
    (m.getSource("forecast") as GeoJSONSource | undefined)?.setData(features);
  }
  // The load handler uses the latest result if a new prediction arrives while tiles load.
  const latest = useRef(result);
  latest.current = result;
  useEffect(() => {
    if (map.current?.getSource("forecast")) update(map.current);
    setSelected(null);
  }, [result]);
  const location = result.rows.find((r) => r.id === selected);
  return (
    <section className="forecast-map-section" ref={shell}>
      <div className="decision-heading">
        <h3>Forecast map preview</h3>
        <button onClick={() => setOpened((v) => !v)}>
          {opened ? "Close preview" : "Open forecast map"}
        </button>
      </div>
      {opened && (
        <div className="forecast-map-shell">
          <div ref={container} className="forecast-map" />
          <div className="map-title">
            <span>
              {result.objective === "collision"
                ? "COLLISION-RELATED REPORT OUTLOOK"
                : "EXPECTED REPORT ACTIVITY"}{" "}
              · {result.cutoff} ~ {result.end}
            </span>
          </div>
          <div className="map-actions">
            <button
              onClick={() =>
                shell.current
                  ?.requestFullscreen()
                  .catch(() =>
                    setNotice("Fullscreen unavailable in this browser."),
                  )
              }
            >
              ⛶ Fullscreen
            </button>
          </div>
          <div className="map-hud">
            <span className="hud-item">
              <span className="orange-dot" />
              Model Top {result.top.length}
            </span>
            <span className="hud-item">
              <span className="teal-dot" />
              Other known locations
            </span>
          </div>
        </div>
      )}
      {notice && opened && <p role="status">{notice}</p>}
      {opened && (
        <p className="notice">
          {location
            ? `${location.name} · ${location.predicted.toFixed(2)} expected reports · ${location.count} reports in ${result.historyLabel ?? "past 90 days"}`
            : "Click a point to inspect its forecast. Colours show model shortlist membership; observed future outcomes are excluded from this preview."}
        </p>
      )}
    </section>
  );
}
