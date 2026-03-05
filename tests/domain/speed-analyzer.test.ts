import { describe, it, expect } from "vitest";
import { computeSpeedMetrics } from "../../src/domain/speed-analyzer.js";
import type { Lap, Stint } from "../../src/domain/session.js";

function createLap(overrides: Partial<Lap> = {}): Lap {
  return {
    driverNumber: 1,
    lapNumber: 1,
    lapDuration: 90,
    sector1Duration: 30,
    sector2Duration: 30,
    sector3Duration: 30,
    i1Speed: 280,
    i2Speed: 290,
    stSpeed: 310,
    isPitOutLap: false,
    dateStart: "2024-01-01T12:00:00",
    ...overrides,
  };
}

function createStint(overrides: Partial<Stint> = {}): Stint {
  return {
    driverNumber: 1,
    stintNumber: 1,
    compound: "MEDIUM",
    lapStart: 1,
    lapEnd: 5,
    tyreAgeAtStart: 0,
    stintType: null,
    ...overrides,
  };
}

describe("computeSpeedMetrics", () => {
  it("returns best and mean speeds from timed laps", () => {
    const laps = [
      createLap({ lapNumber: 1, stSpeed: 310, i1Speed: 280, i2Speed: 290 }),
      createLap({ lapNumber: 2, stSpeed: 315, i1Speed: 285, i2Speed: 295 }),
      createLap({ lapNumber: 3, stSpeed: 312, i1Speed: 282, i2Speed: 292 }),
    ];
    const stints = [createStint({ stintType: "long_run", lapStart: 1, lapEnd: 3 })];

    const result = computeSpeedMetrics(laps, stints);

    expect(result.bestStSpeed).toBe(315);
    expect(result.meanStSpeed).toBeCloseTo(312.333, 2);
    expect(result.bestI1Speed).toBe(285);
    expect(result.meanI1Speed).toBeCloseTo(282.333, 2);
    expect(result.bestI2Speed).toBe(295);
    expect(result.meanI2Speed).toBeCloseTo(292.333, 2);
  });

  it("excludes pit-out laps and handles null speeds", () => {
    const laps = [
      createLap({ lapNumber: 1, isPitOutLap: true, stSpeed: 330 }),
      createLap({ lapNumber: 2, stSpeed: null, i1Speed: 280, i2Speed: 290 }),
      createLap({ lapNumber: 3, stSpeed: 310, i1Speed: null, i2Speed: 295 }),
    ];
    const stints = [createStint({ stintType: "long_run", lapStart: 1, lapEnd: 3 })];

    const result = computeSpeedMetrics(laps, stints);

    expect(result.bestStSpeed).toBe(310);
    expect(result.meanStSpeed).toBe(310);
    expect(result.bestI1Speed).toBe(280);
    expect(result.meanI1Speed).toBe(280);
    expect(result.bestI2Speed).toBe(295);
    expect(result.meanI2Speed).toBe(292.5);
  });

  it("compares mean speed trap across quali-sim vs long-run stints", () => {
    const stints = [
      createStint({ stintType: "quali_sim", compound: "SOFT", lapStart: 1, lapEnd: 2, stintNumber: 1 }),
      createStint({ stintType: "long_run", compound: "MEDIUM", lapStart: 4, lapEnd: 6, stintNumber: 2 }),
    ];
    const laps = [
      createLap({ lapNumber: 1, stSpeed: 320 }),
      createLap({ lapNumber: 2, stSpeed: 322 }),
      createLap({ lapNumber: 4, stSpeed: 308 }),
      createLap({ lapNumber: 5, stSpeed: 306 }),
      createLap({ lapNumber: 6, stSpeed: 304 }),
    ];

    const result = computeSpeedMetrics(laps, stints);

    expect(result.qualiSimMeanStSpeed).toBe(321);
    expect(result.longRunMeanStSpeed).toBeCloseTo(306, 0);
  });
});
