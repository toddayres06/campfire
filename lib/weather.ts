export type Weather = {
  checkedAt: string;
  periods: {
    name: string;
    temperature: number;
    temperatureUnit: string;
    shortForecast: string;
    detailedForecast: string;
  }[];
  alerts: {
    event: string;
    headline: string;
    description: string;
    instruction: string;
  }[];
  alertsAvailable: boolean;
  source: string;
};
export async function getWeather(lng: number, lat: number): Promise<Weather> {
  async function get(url: string) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Campfire Travel Companion",
        Accept: "application/geo+json",
      },
      signal: AbortSignal.timeout(12000),
      next: { revalidate: 600 },
    });
    if (!response.ok)
      throw new Error(
        "Live weather is temporarily unavailable for this location.",
      );
    return response.json();
  }
  const point = await get(
    `https://api.weather.gov/points/${lat.toFixed(4)},${lng.toFixed(4)}`,
  );
  const forecastURL = new URL(point.properties.forecast);
  if (forecastURL.origin !== "https://api.weather.gov")
    throw new Error("Unexpected weather source.");
  const [forecast, alerts] = await Promise.allSettled([
    get(forecastURL.href),
    get(
      `https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lng.toFixed(4)}`,
    ),
  ]);
  if (forecast.status === "rejected") throw forecast.reason;
  return {
    checkedAt: new Date().toISOString(),
    periods: forecast.value.properties.periods.slice(0, 6),
    alerts:
      alerts.status === "fulfilled"
        ? alerts.value.features.map(
            (f: { properties: Weather["alerts"][number] }) => f.properties,
          )
        : [],
    alertsAvailable: alerts.status === "fulfilled",
    source: `https://forecast.weather.gov/MapClick.php?lat=${lat}&lon=${lng}`,
  };
}
