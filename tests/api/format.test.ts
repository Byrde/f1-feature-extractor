import { describe, it, expect } from "vitest";
import { formatLapTime, formatSessionOutput } from "../../src/api/format.js";
import type { SessionFeatures } from "../../src/domain/features.js";

describe("formatLapTime", () => {
  it("returns null for null input", () => {
    expect(formatLapTime(null)).toBeNull();
  });

  it("formats a typical lap time", () => {
    expect(formatLapTime(83.456)).toBe("1:23.456");
  });

  it("formats a sub-minute sector time", () => {
    expect(formatLapTime(28.123)).toBe("0:28.123");
  });
});

describe("formatSessionOutput", () => {
  it("formats time fields while preserving non-time fields", () => {
    const session: SessionFeatures = {
      sessionKey: 1,
      circuitShortName: "BAH",
      sessionName: "Practice 1",
      drivers: [
        {
          driverNumber: 1,
          nameAcronym: "VER",
          teamName: "Red Bull",
          sessionKey: 1,
          pace: {
            bestLapByCompound: { SOFT: 90.123 },
            longRunAveragePace: 92.456,
            longRunSampleSize: 12,
            bestSector1: 28.1,
            bestSector2: 33.2,
            bestSector3: 27.5,
            meanSector1: 28.5,
            meanSector2: 33.8,
            meanSector3: 27.9,
          },
          degradation: {
            degradationRateByStint: [
              { stintNumber: 1, compound: "SOFT", degradationRate: 0.05, rSquared: 0.92, lapCount: 10 },
            ],
            fuelCorrectedLongRunPace: 91.234,
            fuelCorrectedSampleSize: 10,
          },
          speed: {
            bestStSpeed: 320,
            meanStSpeed: 315,
            bestI1Speed: 290,
            meanI1Speed: 285,
            bestI2Speed: 300,
            meanI2Speed: 295,
          },
          consistency: { longRunLapTimeStdDev: 0.35, consistencySampleSize: 12 },
          confidence: {
            overall: "MEDIUM" as const,
            longRunPace: { level: "MEDIUM" as const, sampleSize: 12 },
            fuelCorrectedPace: { level: "MEDIUM" as const, sampleSize: 10 },
            degradation: { level: "MEDIUM" as const, sampleSize: 10, meanRSquared: 0.72 },
            consistency: { level: "MEDIUM" as const, sampleSize: 12 },
          },
          stints: [
            {
              stintNumber: 1,
              compound: "SOFT",
              lapCount: 10,
              bestLap: 90.123,
              meanLap: 92.456,
              degradationRate: 0.05,
            },
          ],
          weather: {
            meanTrackTemperature: 40,
            meanAirTemperature: 30,
            meanHumidity: 50,
            rainfall: false,
            meanWindSpeed: 3,
          },
          totalLaps: 25,
          rankings: { longRunPace: 1, bestLap: 1, degradationRate: 2, consistency: 1 },
        },
      ],
    };

    const [result] = formatSessionOutput([session]) as any[];

    expect(result.drivers[0].pace.bestLapByCompound.SOFT).toBe("1:30.123");
    expect(result.drivers[0].pace.longRunAveragePace).toBe("1:32.456");
    expect(result.drivers[0].pace.longRunSampleSize).toBe(12);
    expect(result.drivers[0].pace.bestSector1).toBe("0:28.100");
    expect(result.drivers[0].degradation.fuelCorrectedLongRunPace).toBe("1:31.234");
    expect(result.drivers[0].degradation.fuelCorrectedSampleSize).toBe(10);
    expect(result.drivers[0].degradation.degradationRateByStint[0].degradationRate).toBe(0.05);
    expect(result.drivers[0].degradation.degradationRateByStint[0].rSquared).toBe(0.92);
    expect(result.drivers[0].stints[0].bestLap).toBe("1:30.123");
    expect(result.drivers[0].stints[0].meanLap).toBe("1:32.456");
    expect(result.drivers[0].speed.bestStSpeed).toBe(320);
    expect(result.drivers[0].consistency.longRunLapTimeStdDev).toBe(0.35);
    expect(result.drivers[0].consistency.consistencySampleSize).toBe(12);
    expect(result.drivers[0].confidence.overall).toBe("MEDIUM");
    expect(result.drivers[0].confidence.longRunPace.sampleSize).toBe(12);
    expect(result.drivers[0].rankings.longRunPace).toBe(1);
  });
});
