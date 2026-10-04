import { loadSnapshot } from "../domain/loadSnapshot";
import type { Dataset, TrafficEvent } from "../domain/types";
import { useCallback, useEffect, useState } from "react";
import { validateDataset, validateWeather } from "../domain/dataset.mjs";
import { attachWeather } from "../weather.mjs";
export function useDataset() {
  const [data, setData] = useState<Dataset | null>(null),
    [error, setError] = useState(""),
    [warning, setWarning] = useState(""),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const read = (url: string) => loadSnapshot(url, controller.signal);
    setError("");
    setWarning("");
    Promise.allSettled([
      read("/data/dataset.json.gz").then(validateDataset),
      read("/data/weather.json.gz").then(validateWeather),
    ]).then(([traffic, weather]) => {
      if (controller.signal.aborted) return;
      if (traffic.status === "rejected") {
        setError(String(traffic.reason));
        return;
      }
      const fallback = {
        audit: {
          hours: 0,
          station: "Unavailable",
          tempMissing: 0,
          visibilityMissing: 0,
        },
        hours: [],
      };
      const observed =
        weather.status === "fulfilled" ? weather.value : fallback;
      if (weather.status === "rejected")
        setWarning(
          "Weather data unavailable. Traffic analysis remains available; weather filters have no observations.",
        );
      const events = attachWeather(traffic.value.events, observed.hours);
      setData({
        ...traffic.value,
        events,
        weather: {
          ...observed,
          matched: events.filter((e: TrafficEvent) => e.weather).length,
        },
      });
    });
    return () => controller.abort();
  }, [attempt]);
  return {
    data,
    error,
    warning,
    retry: useCallback(() => setAttempt((v) => v + 1), []),
  };
}
