export const project = ([lon, lat]) => [
  (lon + 114.1) * 69900,
  (lat - 51) * 111200,
];
export function segmentDistance(p, a, b) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    t = Math.max(
      0,
      Math.min(
        1,
        ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1),
      ),
    );
  return {
    distance: Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy),
    endpointDistance: Math.min(
      Math.hypot(p[0] - a[0], p[1] - a[1]),
      Math.hypot(p[0] - b[0], p[1] - b[1]),
    ),
    angle: Math.atan2(dy, dx),
  };
}
export function buildRoadIndex(roads) {
  const bins = new Map();
  for (const road of roads)
    for (const coords of road.line?.coordinates ?? []) {
      const points = coords.map(project);
      for (let i = 1; i < points.length; i++) {
        const segment = {
          a: points[i - 1],
          b: points[i],
          road,
          endpoints: [points[0], points.at(-1)],
        };
        for (
          let x = Math.floor(Math.min(segment.a[0], segment.b[0]) / 100);
          x <= Math.floor(Math.max(segment.a[0], segment.b[0]) / 100);
          x++
        )
          for (
            let y = Math.floor(Math.min(segment.a[1], segment.b[1]) / 100);
            y <= Math.floor(Math.max(segment.a[1], segment.b[1]) / 100);
            y++
          ) {
            const key = `${x},${y}`;
            if (!bins.has(key)) bins.set(key, []);
            bins.get(key).push(segment);
          }
      }
    }
  return bins;
}
export function inspectMatch(lon, lat, bins, assigned) {
  const p = project([lon, lat]),
    candidates = new Map();
  for (let x = Math.floor(p[0] / 100) - 1; x <= Math.floor(p[0] / 100) + 1; x++)
    for (
      let y = Math.floor(p[1] / 100) - 1;
      y <= Math.floor(p[1] / 100) + 1;
      y++
    )
      for (const segment of bins.get(`${x},${y}`) ?? []) {
        const metric = segmentDistance(p, segment.a, segment.b);
        metric.endpointDistance = Math.min(
          ...segment.endpoints.map((a) => Math.hypot(p[0] - a[0], p[1] - a[1])),
        );
        const id = `road:${segment.road.segment_id}`;
        if (
          metric.distance <= 50 &&
          (!candidates.has(id) || metric.distance < candidates.get(id).distance)
        )
          candidates.set(id, { id, name: segment.road.full_name, ...metric });
      }
  const sorted = [...candidates.values()].sort(
    (a, b) => a.distance - b.distance || a.id.localeCompare(b.id),
  );
  const chosen = candidates.get(assigned);
  if (!chosen)
    return {
      status: "unmatched",
      reason: "No assigned road within 50 m",
      alternatives: sorted.slice(0, 3).map(strip),
    };
  const alternate = sorted.find((r) => r.id !== assigned),
    gap = alternate ? alternate.distance - chosen.distance : null;
  let status = "isolated proximity",
    reason = "No competing road within 10 m of the assigned distance";
  if (alternate && gap <= 10) {
    const delta = Math.abs(chosen.angle - alternate.angle) % Math.PI,
      angle = (Math.min(delta, Math.PI - delta) * 180) / Math.PI;
    if (angle >= 30) {
      status = "junction ambiguity";
      reason = "Competing road crosses at ≥30° with a distance gap ≤10 m";
    } else if (
      chosen.name === alternate.name &&
      chosen.endpointDistance <= 20 &&
      alternate.endpointDistance <= 20
    ) {
      status = "segment boundary";
      reason = "Same-name segments compete near their endpoints";
    } else {
      status = "parallel ambiguity";
      reason =
        "Competing road directions differ by <30° with a distance gap ≤10 m";
    }
  }
  if (gap !== null && gap < -0.1) {
    status = "assignment review";
    reason = "A different segment is closer than the retained assignment";
  }
  return {
    status,
    reason,
    distance: round(chosen.distance),
    gap: gap === null ? null : round(gap),
    alternatives: sorted
      .filter((r) => r.id !== assigned)
      .slice(0, 3)
      .map(strip),
  };
}
const round = (n) => Math.round(n * 10) / 10;
const strip = (r) => ({ id: r.id, name: r.name, distance: round(r.distance) });
