export function weatherMatches(weather, condition = "All weather") {
  if (condition === "All weather") return true;
  if (condition === "Weather unavailable")
    return !weather || weather.temp === null;
  if (!weather) return false;
  if (condition === "Below freezing")
    return weather.temp !== null && weather.temp < 0;
  if (condition === "Snow reported")
    return /snow|ice pellets|snow grains/i.test(weather.description ?? "");
  if (condition === "Rain reported")
    return /rain|drizzle/i.test(weather.description ?? "");
  if (condition === "Low visibility")
    return weather.visibility !== null && weather.visibility < 1;
  return false;
}
