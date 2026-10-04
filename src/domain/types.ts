import type { MultiLineString } from "geojson";
export type AnalysisConfig = {
  start: string;
  end: string;
  period: string;
  category: string;
  weather: string;
  capacity: number;
  weights: number[];
};
export interface WeatherHour {
  utc: string;
  temperature: number | null;
  condition: string;
  temp: number | null;
  visibility: number | null;
  [field: string]: unknown;
}
export interface TrafficEvent {
  id: string;
  utc: string;
  date: string;
  hour: number;
  weekend: boolean;
  lon: number;
  lat: number;
  location: string;
  name: string;
  reportedLocation: string;
  category: string;
  description: string;
  distance: number;
  count: number;
  weather?: WeatherHour | null;
  matchQuality?: {
    status: string;
    reason: string;
    distance: number;
    gap: number;
    alternatives: unknown[];
  };
}
export interface RoadLocation {
  id: string;
  name: string;
  lon: number;
  lat: number;
  total: number;
  geometry: MultiLineString | null;
  volume?: {
    vehiclesPerWeekday: number;
    distance: number;
    [field: string]: unknown;
  };
  matchQuality?: {
    total: number;
    needsReview: number;
    statuses: Record<string, number>;
    maxDistance: number;
  };
}
export interface RankedLocation extends RoadLocation {
  count: number;
  recent: number;
  previous: number;
  days: number;
  records: TrafficEvent[];
  growth: number;
  features: number[];
  contributions: number[];
  score: number;
  lowEvidence: boolean;
  baseline: number;
  position: number;
}
export interface RankedPlan {
  rows: RankedLocation[];
  baseline: RankedLocation[];
  top: RankedLocation[];
  baselineTop: RankedLocation[];
  selected: number;
  complete: boolean;
  weightFallback: boolean;
}
export interface Dataset {
  events: TrafficEvent[];
  locations: RoadLocation[];
  audit: {
    downloadedAt: string;
    events: number;
    first: string;
    last: string;
    [field: string]: unknown;
  };
  weather: {
    hours: WeatherHour[];
    matched: number;
    audit: Record<string, unknown>;
  };
}
export type WorkerInput = {
  events: TrafficEvent[];
  locations: RoadLocation[];
  config: AnalysisConfig;
};
export type OptimizationResult = {
  weights: number[];
  filters: {
    period: string;
    category: string;
    weather: string;
    capacity: number;
  };
  candidates: unknown[];
  validation: unknown;
  tuningTotal: number;
  version: string;
};
export type SavedPlan<T> = {
  config: AnalysisConfig;
  plan: T;
  datasetVersion: string;
  createdAt: string;
};
export interface ForecastRow {
  id: string;
  name: string;
  lon: number;
  lat: number;
  count: number;
  recent: number;
  days: number;
  x: number[];
  target: number | null;
  baseline: number;
  predicted: number;
}
export interface ForecastChange {
  id: string;
  name: string;
  forecastRank: number | null;
  reactiveRank: number | null;
  direction: "entered" | "exited";
  explanation: string;
}
export interface ForecastResult {
  crossValidation: {
    strategy: string;
    selectedLambda: number;
    selectionMetric: string;
    trials: {
      lambda: number;
      validationDeviance: number;
      folds: {
        trainYears: number[];
        validationYear: number;
        deviance: number;
        windows: {
          cutoff: string;
          modelCoverage: number;
          baselineCoverage: number;
        }[];
      }[];
    }[];
  };
  mode: "backtest" | "future";
  dataEnd: string;
  rows: ForecastRow[];
  cutoff: string;
  horizon: number;
  end: string;
  capacity: number;
  version: string;
  lambda: number;
  top: ForecastRow[];
  features: string[];
  coefficients: number[];
  diagnostics: { iterations: number; converged: boolean; gradientNorm: number };
  unseenFutureEvents: number | null;
  comparison: {
    start: string;
    retained: number;
    rateRetained: number;
    changes: ForecastChange[];
    reactiveTop: RankedLocation[];
  };
  evaluation: {
    total: number;
    knownLocations: number;
    zeroMAE: number;
    modelExpected: number;
    modelDeviance: number;
    baselineDeviance: number;
    modelMAE: number;
    baselineMAE: number;
    modelCoverage: number;
    baselineCoverage: number;
    reactiveCoverage: number;
    rows: ForecastRow[];
  } | null;
}
export interface ForecastInput {
  events: TrafficEvent[];
  locations: RoadLocation[];
  config: {
    cutoff: string;
    horizon: number;
    capacity: number;
    mode: "backtest" | "future";
    dataEnd: string;
  };
}

export interface PointMotion {
  row: RankedLocation;
  visibility: number;
  targetVisibility: number;
  priority: number;
  targetPriority: number;
  flashAt: number;
  flash: number;
  dirty?: boolean;
}
