const periods = [
  "All hours",
  "Morning peak",
  "Evening peak",
  "Night",
  "Weekend",
];
export function validateConfig(c) {
  const date = (s) =>
    typeof s === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    Number.isFinite(Date.parse(s + "T00:00:00Z")) &&
    new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s;
  if (!date(c.start) || !date(c.end) || c.start > c.end)
    throw Error("Choose a valid start and end date");
  if (!Number.isInteger(c.capacity) || c.capacity < 1 || c.capacity > 100)
    throw Error("Inspection capacity must be between 1 and 100");
  if (!periods.includes(c.period)) throw Error("Unknown time-of-day filter");
  if (typeof c.category !== "string" || !c.category)
    throw Error("Missing event category");
  return c;
}
