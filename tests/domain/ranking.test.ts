import { describe, it, expect } from "vitest";
import { computeDriverRankings } from "../../src/domain/ranking.js";
import type { DriverFeatures, WeatherSummary } from "../../src/domain/features.js";

const WEATHER: WeatherSummary = {
  meanTrackTemperature: 40,
  meanAirTemperature: 25,
  meanHumidity: 50,
  rainfall: false,
  meanWindSpeed: 3,
};

const UNRANKED = {
  longRunPace: null,
  bestLap: null,
  degradationRate: null,
  consistency: null,
};

function createDriverFeatures(
  overrides: Partial<DriverFeatures> & { driverNumber: number }
): DriverFeatures {
  return {
    nameAcronym: "TST",
    teamName: "Test Team",
    sessionKey: 9999,
    pace: {
      bestLapByCompound: {},
      longRunAveragePace: null,
      bestSector1: null,
      bestSector2: null,
      bestSector3: null,
      meanSector1: null,
      meanSector2: null,
      meanSector3: null,
    },
    degradation: { degradationRateByStint: [], fuelCorrectedLongRunPace: null },
    speed: {
      bestStSpeed: null,
      meanStSpeed: null,
      bestI1Speed: null,
      meanI1Speed: null,
      bestI2Speed: null,
      meanI2Speed: null,
      qualiSimMeanStSpeed: null,
      longRunMeanStSpeed: null,
    },
    consistency: { longRunLapTimeStdDev: null },
    stints: [],
    weather: WEATHER,
    totalLaps: 0,
    rankings: UNRANKED,
    ...overrides,
  };
}

describe("computeDriverRankings", () => {
  it("ranks drivers by long-run pace, best lap, degradation, and consistency", () => {
    const drivers = [
      createDriverFeatures({
        driverNumber: 1,
        pace: {
          bestLapByCompound: { SOFT: 80 },
          longRunAveragePace: 84,
          bestSector1: null, bestSector2: null, bestSector3: null,
          meanSector1: null, meanSector2: null, meanSector3: null,
        },
        degradation: {
          degradationRateByStint: [
            { stintNumber: 1, compound: "MEDIUM", degradationRate: 0.05, lapCount: 10 },
          ],
          fuelCorrectedLongRunPace: null,
        },
        consistency: { longRunLapTimeStdDev: 0.3 },
      }),
      createDriverFeatures({
        driverNumber: 44,
        pace: {
          bestLapByCompound: { SOFT: 79.5 },
          longRunAveragePace: 83.5,
          bestSector1: null, bestSector2: null, bestSector3: null,
          meanSector1: null, meanSector2: null, meanSector3: null,
        },
        degradation: {
          degradationRateByStint: [
            { stintNumber: 1, compound: "MEDIUM", degradationRate: 0.08, lapCount: 10 },
          ],
          fuelCorrectedLongRunPace: null,
        },
        consistency: { longRunLapTimeStdDev: 0.2 },
      }),
    ];

    const rankings = computeDriverRankings(drivers);

    const r1 = rankings.get(1)!;
    const r44 = rankings.get(44)!;

    expect(r44.longRunPace).toBe(1);
    expect(r1.longRunPace).toBe(2);
    expect(r44.bestLap).toBe(1);
    expect(r1.bestLap).toBe(2);
    expect(r1.degradationRate).toBe(1);
    expect(r44.degradationRate).toBe(2);
    expect(r44.consistency).toBe(1);
    expect(r1.consistency).toBe(2);
  });

  it("assigns null rank when a driver lacks data for a dimension", () => {
    const drivers = [
      createDriverFeatures({
        driverNumber: 1,
        pace: {
          bestLapByCompound: { SOFT: 80 },
          longRunAveragePace: null,
          bestSector1: null, bestSector2: null, bestSector3: null,
          meanSector1: null, meanSector2: null, meanSector3: null,
        },
      }),
    ];

    const rankings = computeDriverRankings(drivers);
    const r1 = rankings.get(1)!;

    expect(r1.bestLap).toBe(1);
    expect(r1.longRunPace).toBeNull();
    expect(r1.degradationRate).toBeNull();
    expect(r1.consistency).toBeNull();
  });

  it("assigns equal rank for tied values", () => {
    const drivers = [
      createDriverFeatures({
        driverNumber: 1,
        pace: {
          bestLapByCompound: { SOFT: 80 },
          longRunAveragePace: 84,
          bestSector1: null, bestSector2: null, bestSector3: null,
          meanSector1: null, meanSector2: null, meanSector3: null,
        },
      }),
      createDriverFeatures({
        driverNumber: 44,
        pace: {
          bestLapByCompound: { SOFT: 80 },
          longRunAveragePace: 84,
          bestSector1: null, bestSector2: null, bestSector3: null,
          meanSector1: null, meanSector2: null, meanSector3: null,
        },
      }),
    ];

    const rankings = computeDriverRankings(drivers);

    expect(rankings.get(1)!.bestLap).toBe(1);
    expect(rankings.get(44)!.bestLap).toBe(1);
    expect(rankings.get(1)!.longRunPace).toBe(1);
    expect(rankings.get(44)!.longRunPace).toBe(1);
  });
});
