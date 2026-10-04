// Research candidates only. CMFs describe crashes in external studies, not changes in Calgary traffic reports.
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

}

const CMF: Record<"signal" | "signalVisibility" | "variableSpeed", Countermeasure> = {
  signal: {
    action: "Review signal warrants",
    cmf: 0.84,
    source: "CMF Clearinghouse #9144, Sacchia et al. 2016 (Canada), 4★: urban/suburban stop-controlled, all crashes",
  },
  signalVisibility: {
    action: "Signing and visibility improvements",
    cmf: 0.949,
    source: "CMF Clearinghouse #8927, Le et al. 2017, 4★: urban signalized intersections, all crashes",
  },
  variableSpeed: {
    action: "Assess variable-speed feasibility",
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

export function suggestImprovement(c: SiteControl | undefined): Suggestion | null {
  if (!c) return null;
  let measure: Countermeasure | null = null;
  if (c.kind === "intersection") {
    if (c.signalized) measure = CMF.signalVisibility;
    else if (c.stopSigns > 0 && ARTERIAL.has(c.roadClass ?? "") && ARTERIAL.has(c.minorRoadClass ?? ""))
      measure = CMF.signal;
  } else if (c.roadClass === FREEWAY) {
    measure = CMF.variableSpeed;
  }
  if (!measure) return null;
  return { ...measure, current: describe(c),  };
}
