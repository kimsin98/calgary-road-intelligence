// Proof of concept: suggest one countermeasure per forecast location from its traffic control
// (public/data/site-controls.json, written by analysis/export.py) and apply a crash modification
// factor (CMF) from the FHWA CMF Clearinghouse. CMFs are hardcoded for a handful of situations;
// they describe crash changes in other cities, so applying them to incident reports is indicative.

export interface SiteControl {
  kind: "intersection" | "segment";
  name: string | null;
  roadClass: string | null;
  minorRoadClass: string | null;
  legs: number;
  signalized: boolean;
  stopSigns: number;
  yieldSigns: number;
  crosswalks: number;
}

export interface SiteControls {
  dataThrough: string;
  controls: Record<string, SiteControl>;
}

interface Countermeasure {
  action: string;
  cmf: number;
  source: string; // CMF Clearinghouse crfid, study, star rating and setting
}

export interface Suggestion extends Countermeasure {
  current: string;
  expectedChange: number; // change in expected reports over the forecast horizon (negative = fewer)
}

const CMF: Record<"signal" | "signalVisibility" | "rampMeter" | "variableSpeed", Countermeasure> = {
  signal: {
    action: "Install traffic signal",
    cmf: 0.84,
    source: "CMF Clearinghouse #9144, Sacchia et al. 2016 (Canada), 4★: urban/suburban stop-controlled, all crashes",
  },
  signalVisibility: {
    action: "Signing and visibility improvements",
    cmf: 0.949,
    source: "CMF Clearinghouse #8927, Le et al. 2017, 4★: urban signalized intersections, all crashes",
  },
  rampMeter: {
    action: "Install ramp meter",
    cmf: 0.86,
    source: "CMF Clearinghouse #11029, Haule et al. 2021, 4★: interstate ramps, all crashes",
  },
  variableSpeed: {
    action: "Install variable speed limit",
    cmf: 0.927,
    source: "CMF Clearinghouse #11834, Chakraborty & Mahmud 2024, 4★: freeways and expressways, all crashes",
  },
};

const FREEWAY = "Skeletal Road";
const ARTERIAL = new Set([
  "Urban Boulevard",
  "Parkway",
  "Industrial Arterial",
  "Arterial Street",
  "Local Arterial",
  "Primary Collector",
]);

function describe(c: SiteControl) {
  if (c.signalized) return "Signalized";
  if (c.stopSigns > 0) return `Stop-controlled (${c.stopSigns} stop)`;
  if (c.yieldSigns > 0) return "Yield-controlled";
  return c.kind === "intersection" ? "No signal or stop/yield signs" : (c.roadClass ?? "Segment");
}

export function suggestImprovement(c: SiteControl | undefined, expected: number): Suggestion | null {
  if (!c) return null;
  let measure: Countermeasure | null = null;
  if (c.kind === "intersection") {
    // An unsignalized node with a freeway (skeletal) leg is an interchange ramp merge or terminal.
    const interchange = c.roadClass === FREEWAY;
    if (c.signalized) measure = CMF.signalVisibility;
    else if (interchange) measure = CMF.rampMeter;
    else if (c.stopSigns > 0 && ARTERIAL.has(c.roadClass ?? "") && ARTERIAL.has(c.minorRoadClass ?? ""))
      measure = CMF.signal;
  } else if (c.roadClass === FREEWAY) {
    measure = CMF.variableSpeed;
  }
  if (!measure) return null;
  return { ...measure, current: describe(c), expectedChange: expected * (measure.cmf - 1) };
}
