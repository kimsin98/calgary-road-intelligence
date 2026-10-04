import { selectEvents } from "./analysis.mjs";
export const WEATHER_OPTIONS = [
  "All weather",
  "Below freezing",
  "Snow reported",
  "Rain reported",
  "Low visibility",
  "Weather unavailable",
];
export { weatherMatches } from "./weather-match.mjs";
import { weatherMatches } from "./weather-match.mjs";
export function attachWeather(events, hours) {
  const index = new Map(hours.map((h) => [h.utc.slice(0, 13), h]));
  return events.map((e) => ({
    ...e,
    weather: index.get(e.utc.slice(0, 13)) ?? null,
  }));
}
export function summarizeWeather(events, hours, config) {
  const scope = { ...config, weather: "All weather" };
  const chosen = selectEvents(events, scope),
    observed = selectEvents(
      hours.map((h) => ({ ...h, category: config.category })),
      scope,
    );
  return WEATHER_OPTIONS.slice(1).map((condition) => {
    const matchingEvents = chosen.filter((e) =>
      weatherMatches(e.weather, condition),
    );
    const matchingHours = observed.filter((h) => weatherMatches(h, condition));
    return {
      condition,
      events: matchingEvents.length,
      hours: matchingHours.length,
      per100Hours:
        condition !== "Weather unavailable" && matchingHours.length
          ? (matchingEvents.length / matchingHours.length) * 100
          : null,
    };
  });
}
