export function validateDataset(dataset) {
  if (
    !dataset ||
    !Array.isArray(dataset.events) ||
    !Array.isArray(dataset.locations) ||
    !dataset.audit
  )
    throw Error("Invalid traffic dataset structure");
  const ids = new Set(dataset.locations.map((l) => l.id));
  if (ids.size !== dataset.locations.length)
    throw Error("Duplicate location IDs");
  const records = new Set();
  for (const e of dataset.events) {
    if (
      !e.id ||
      records.has(e.id) ||
      !ids.has(e.location) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(e.date) ||
      !Number.isFinite(Date.parse(e.utc)) ||
      !Number.isFinite(e.lon) ||
      !Number.isFinite(e.lat)
    )
      throw Error("Invalid event record or location reference");
    records.add(e.id);
  }
  return dataset;
}
export function validateWeather(weather) {
  if (!weather || !Array.isArray(weather.hours) || !weather.audit)
    throw Error("Invalid weather dataset structure");
  const ids = new Set();
  for (const h of weather.hours) {
    if (
      !Number.isFinite(Date.parse(h.utc)) ||
      ids.has(h.utc) ||
      !Number.isFinite(h.hour)
    )
      throw Error("Invalid weather timestamp");
    ids.add(h.utc);
  }
  return weather;
}
