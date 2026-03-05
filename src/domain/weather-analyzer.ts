import type { WeatherSnapshot } from "./session.js";
import type { WeatherSummary } from "./features.js";

export function computeWeatherSummary(
  snapshots: readonly WeatherSnapshot[]
): WeatherSummary | null {
  if (snapshots.length === 0) {
    return null;
  }

  const n = snapshots.length;
  let trackTempSum = 0;
  let airTempSum = 0;
  let humiditySum = 0;
  let windSpeedSum = 0;
  let hasRainfall = false;

  for (const s of snapshots) {
    trackTempSum += s.trackTemperature;
    airTempSum += s.airTemperature;
    humiditySum += s.humidity;
    windSpeedSum += s.windSpeed;
    if (s.rainfall > 0) {
      hasRainfall = true;
    }
  }

  return {
    meanTrackTemperature: trackTempSum / n,
    meanAirTemperature: airTempSum / n,
    meanHumidity: humiditySum / n,
    rainfall: hasRainfall,
    meanWindSpeed: windSpeedSum / n,
  };
}
