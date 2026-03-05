import { describe, it, expect } from "vitest";
import { computeWeatherSummary } from "../../src/domain/weather-analyzer.js";
import type { WeatherSnapshot } from "../../src/domain/session.js";

function createSnapshot(overrides: Partial<WeatherSnapshot> = {}): WeatherSnapshot {
  return {
    airTemperature: 25,
    trackTemperature: 40,
    humidity: 50,
    pressure: 1013,
    rainfall: 0,
    windSpeed: 3,
    windDirection: 180,
    date: "2024-01-01T12:00:00",
    ...overrides,
  };
}

describe("computeWeatherSummary", () => {
  it("returns null for empty snapshot array", () => {
    expect(computeWeatherSummary([])).toBeNull();
  });

  it("computes mean values across multiple snapshots", () => {
    const snapshots = [
      createSnapshot({ trackTemperature: 38, airTemperature: 24, humidity: 48, windSpeed: 2 }),
      createSnapshot({ trackTemperature: 42, airTemperature: 26, humidity: 52, windSpeed: 4 }),
    ];

    const result = computeWeatherSummary(snapshots);

    expect(result).not.toBeNull();
    expect(result!.meanTrackTemperature).toBe(40);
    expect(result!.meanAirTemperature).toBe(25);
    expect(result!.meanHumidity).toBe(50);
    expect(result!.meanWindSpeed).toBe(3);
    expect(result!.rainfall).toBe(false);
  });

  it("sets rainfall true if any snapshot has rainfall > 0", () => {
    const snapshots = [
      createSnapshot({ rainfall: 0 }),
      createSnapshot({ rainfall: 0 }),
      createSnapshot({ rainfall: 1 }),
    ];

    const result = computeWeatherSummary(snapshots);

    expect(result).not.toBeNull();
    expect(result!.rainfall).toBe(true);
  });
});
