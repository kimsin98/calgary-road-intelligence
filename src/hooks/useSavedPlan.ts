import { useEffect, useState } from "react";
import { rank } from "../analysis.mjs";
import { validateConfig } from "../domain/config.mjs";
import type {
  AnalysisConfig,
  SavedPlan,
  Dataset,
  RankedPlan,
} from "../domain/types";
const KEY = "calgary-saved-plan-v1";
export function useSavedPlan(data: Dataset | null) {
  const [snapshot, setSnapshot] = useState<SavedPlan<RankedPlan> | null>(null),
    [notice, setNotice] = useState("");
  useEffect(() => {
    if (!data) return;
    setSnapshot(null);
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const stored = JSON.parse(raw);
      validateConfig(stored.config);
      if (stored.datasetVersion !== data.audit.downloadedAt) {
        setNotice(
          "Saved plan uses a different data snapshot. Save a new plan to compare.",
        );
        return;
      }
      setSnapshot({
        ...stored,
        plan: rank(data.events, data.locations, stored.config),
      });
      setNotice("Saved comparison plan restored.");
    } catch {
      setNotice(
        "Saved plan could not be restored. Save a new plan to compare.",
      );
    }
  }, [data]);
  function save(config: AnalysisConfig) {
    if (!data) return;
    const record = {
      config: { ...config, weights: [...config.weights] },
      datasetVersion: data.audit.downloadedAt,
      createdAt: new Date().toISOString(),
    };
    setSnapshot({
      ...record,
      plan: rank(data.events, data.locations, record.config),
    });
    try {
      localStorage.setItem(KEY, JSON.stringify(record));
      setNotice("Comparison plan saved on this browser.");
    } catch {
      setNotice("Plan saved for this session; browser storage is unavailable.");
    }
  }
  function clear() {
    setSnapshot(null);
    setNotice("");
    try {
      localStorage.removeItem(KEY);
    } catch {}
  }
  return { snapshot, notice, save, clear };
}
