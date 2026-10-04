import { useEffect, useState } from "react";
import type { GeoJSONSource } from "maplibre-gl";
import type {
  Dataset,
  RankedPlan,
  RankedLocation,
  PointMotion,
} from "../domain/types";
import type { RefObject, Dispatch, SetStateAction } from "react";
type Row = RankedLocation;
export function useEventMap({
  data,
  active,
  container,
  map,
  plan,
  mapReady,
  setMapReady,
  setMapNotice,
  setSelected,
  pointMotion,
  fadeFrame,
  mapShell,
}: {
  data: Dataset | null;
  active: boolean;
  container: RefObject<HTMLDivElement | null>;
  map: RefObject<import("maplibre-gl").Map | null>;
  plan: RankedPlan | null;
  mapReady: boolean;
  setMapReady: Dispatch<SetStateAction<boolean>>;
  setMapNotice: Dispatch<SetStateAction<string>>;
  setSelected: Dispatch<SetStateAction<string>>;
  pointMotion: RefObject<Map<string, PointMotion>>;
  fadeFrame: RefObject<number>;
  mapShell: RefObject<HTMLDivElement | null>;
}) {
  const [maplibregl, setLibrary] = useState<
    typeof import("maplibre-gl") | null
  >(null);
  useEffect(() => {
    if (!active || maplibregl) return;
    let cancelled = false;
    import("maplibre-gl")
      .then((module) => {
        if (!cancelled) setLibrary(module.default);
      })
      .catch(() =>
        setMapNotice(
          "Map engine could not load. Reload or return to Map preview to retry.",
        ),
      );
    return () => {
      cancelled = true;
    };
  }, [active, maplibregl]);
  useEffect(() => {
    if (!maplibregl || !data || !container.current || map.current) return;
    const m = new maplibregl.Map({
      container: container.current,
      center: [-114.075, 51.065],
      zoom: 10.1,
      pitch: 0,
      bearing: 0,
      maxPitch: 70,
      attributionControl: { compact: true },
      style: "/maps/calgary-dark.json",
    });
    map.current = m;
    m.on("error", (e: any) => {
      if (e.sourceId === "openmaptiles")
        setMapNotice(
          "Basemap unavailable · local road and event layers remain available",
        );
    });
    m.addControl(new maplibregl.NavigationControl(), "bottom-left");
    m.on("load", () => {
      m.addLayer({
        id: "buildings-3d",
        type: "fill-extrusion",
        source: "openmaptiles",
        "source-layer": "building",
        minzoom: 13,
        paint: {
          "fill-extrusion-color": "#4b7387",
          "fill-extrusion-height": [
            "coalesce",
            ["get", "render_height"],
            ["get", "height"],
            8,
          ],
          "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
          "fill-extrusion-opacity": 0.7,
          "fill-extrusion-vertical-gradient": true,
        },
      });
      const roads = {
        type: "FeatureCollection",
        features: data.locations
          .filter((l) => l.geometry)
          .map((l) => ({
            type: "Feature",
            geometry: l.geometry,
            properties: {},
          })),
      };
      m.addSource("roads", { type: "geojson", data: roads as any });
      m.addLayer({
        id: "roads",
        type: "line",
        source: "roads",
        paint: {
          "line-color": "#5d889a",
          "line-width": 1,
          "line-opacity": 0.25,
        },
      });
      m.addSource("hotspots", {
        type: "geojson",
        promoteId: "id",
        data: { type: "FeatureCollection", features: [] },
      });
      const visibility = [
        "coalesce",
        ["feature-state", "visibility"],
        1,
      ] as any;
      const priority = ["coalesce", ["feature-state", "priority"], 0] as any;
      const flash = ["coalesce", ["feature-state", "flash"], 0] as any;
      const size = [
        "interpolate",
        ["linear"],
        ["coalesce", ["feature-state", "count"], ["get", "count"]],
        1,
        4,
        50,
        12,
      ] as any;
      m.addLayer({
        id: "halo",
        type: "circle",
        source: "hotspots",
        paint: {
          "circle-radius": ["*", size, 1.8],
          "circle-color": "#ffbf69",
          "circle-opacity": ["*", visibility, priority, 0.18],
          "circle-blur": 0.7,
        },
      });
      m.addLayer({
        id: "dots",
        type: "circle",
        source: "hotspots",
        paint: {
          "circle-radius": size,
          "circle-color": [
            "interpolate",
            ["linear"],
            flash,
            0,
            "#64c8ed",
            1,
            "#d5f7ff",
          ],
          "circle-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10,
            ["*", visibility, ["+", 0.38, ["*", flash, 0.62]]],
            14,
            ["*", visibility, ["+", 0.75, ["*", flash, 0.25]]],
          ],
          "circle-stroke-width": 0,
        },
      });
      m.addLayer({
        id: "priority-dots",
        type: "circle",
        source: "hotspots",
        paint: {
          "circle-radius": size,
          "circle-color": [
            "interpolate",
            ["linear"],
            flash,
            0,
            "#ffbf69",
            1,
            "#fff5cb",
          ],
          "circle-opacity": ["*", visibility, priority],
          "circle-stroke-opacity": ["*", visibility, priority],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffe3a6",
        },
      });
      m.on("click", (e: any) => {
        const hits = m.queryRenderedFeatures(e.point, {
          layers: ["priority-dots", "dots"],
        });
        const hit =
          hits.find(
            (f: any) =>
              f.layer.id === "priority-dots" &&
              (m.getFeatureState({ source: "hotspots", id: f.properties.id })
                .priority ?? 0) > 0.5,
          ) ?? hits.find((f: any) => f.layer.id === "dots");
        if (hit) setSelected(String(hit.properties?.id));
      });
      m.on(
        "mouseenter",
        "priority-dots",
        () => (m.getCanvas().style.cursor = "pointer"),
      );
      m.on(
        "mouseleave",
        "priority-dots",
        () => (m.getCanvas().style.cursor = ""),
      );
      m.on(
        "mouseenter",
        "dots",
        () => (m.getCanvas().style.cursor = "pointer"),
      );
      m.on("mouseleave", "dots", () => (m.getCanvas().style.cursor = ""));
      setMapReady(true);
    });
    return () => {
      m.remove();
      map.current = null;
    };
  }, [data, maplibregl]);
  useEffect(() => {
    if (!plan || !mapReady) return;
    const m = map.current;
    if (!m) return;
    const now = performance.now();
    const motions = pointMotion.current;
    const initial = motions.size === 0;
    let geometryChanged = initial;
    const top = new Set(plan.top.map((r: Row) => r.id));
    const ids = new Set(plan.rows.map((r: Row) => r.id));
    const removed = [...motions.keys()].filter((id) => !ids.has(id));
    if (removed.length > 150) {
      for (const id of removed) {
        motions.delete(id);
        geometryChanged = true;
        m.removeFeatureState({ source: "hotspots", id });
      }
    } else for (const id of removed) motions.get(id)!.targetVisibility = 0;
    for (const r of plan.rows) {
      const priority = top.has(r.id) ? 1 : 0;
      const previous = motions.get(r.id);
      if (!previous) {
        geometryChanged = true;
        motions.set(r.id, {
          row: r,
          visibility: initial ? 1 : 0,
          targetVisibility: 1,
          priority: initial ? priority : 0,
          targetPriority: priority,
          flashAt: initial ? now - 1200 : now,
          flash: initial ? 0 : 1,
        });
      } else {
        if (
          previous.targetVisibility === 0 ||
          previous.targetPriority !== priority ||
          previous.row.count < r.count
        ) {
          previous.flashAt = now;
          previous.dirty = true;
        }
        if (previous.row.count !== r.count) previous.dirty = true;
        previous.row = r;
        previous.targetVisibility = 1;
        previous.targetPriority = priority;
      }
    }
    for (const [id, v] of motions) {
      if (v.targetVisibility === 0 && v.visibility < 0.01) {
        motions.delete(id);
        geometryChanged = true;
      }
    }
    if (geometryChanged)
      (m.getSource("hotspots") as GeoJSONSource).setData({
        type: "FeatureCollection",
        features: [...motions.values()].map((v) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [v.row.lon, v.row.lat] },
          properties: { id: v.row.id, count: v.row.count },
        })),
      });
    if (initial)
      for (const [id, v] of motions)
        m.setFeatureState(
          { source: "hotspots", id },
          { visibility: 1, priority: v.priority, flash: 0, count: v.row.count },
        );
  }, [plan, mapReady]);
  useEffect(() => {
    if (!mapReady) return;
    const m = map.current;
    if (!m) return;
    let last = performance.now();
    const animate = (now: number) => {
      if (map.current !== m) return;
      if (document.hidden || mapShell.current?.closest("[hidden]")) {
        last = now;
        fadeFrame.current = requestAnimationFrame(animate);
        return;
      }
      if (now - last < 50) {
        fadeFrame.current = requestAnimationFrame(animate);
        return;
      }
      const dt = Math.min(100, now - last);
      last = now;
      const blend = 1 - Math.exp(-dt / 180);
      for (const [id, v] of pointMotion.current) {
        if (
          !v.dirty &&
          Math.abs(v.targetVisibility - v.visibility) < 0.01 &&
          Math.abs(v.targetPriority - v.priority) < 0.01 &&
          v.flash === 0
        )
          continue;
        v.dirty = false;
        v.visibility += (v.targetVisibility - v.visibility) * blend;
        v.priority += (v.targetPriority - v.priority) * blend;
        v.flash = Math.max(0, 1 - (now - v.flashAt) / 800);
        if (Math.abs(v.targetVisibility - v.visibility) < 0.01)
          v.visibility = v.targetVisibility;
        if (Math.abs(v.targetPriority - v.priority) < 0.01)
          v.priority = v.targetPriority;
        m.setFeatureState(
          { source: "hotspots", id },
          {
            visibility: v.visibility,
            priority: v.priority,
            flash: v.flash,
            count: v.row.count,
          },
        );
      }
      fadeFrame.current = requestAnimationFrame(animate);
    };
    fadeFrame.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(fadeFrame.current);
  }, [mapReady]);
}
