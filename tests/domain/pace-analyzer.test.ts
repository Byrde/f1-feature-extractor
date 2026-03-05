import { describe, it, expect } from "vitest";
import {
  computeBestLapByCompound,
  computeLongRunAveragePace,
  computeFuelCorrectedLongRunPace,
  computeSectorPerformance,
  computeDegradationRate,
  computeConsistency,
} from "../../src/domain/pace-analyzer.js";
import type { Lap, Stint } from "../../src/domain/session.js";

function createLap(overrides: Partial<Lap> = {}): Lap {
  return {
    driverNumber: 1,
    lapNumber: 1,
    lapDuration: 90,
    sector1Duration: 30,
    sector2Duration: 30,
    sector3Duration: 30,
    i1Speed: 300,
    i2Speed: 300,
    stSpeed: 300,
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

describe("computeBestLapByCompound", () => {
  it("returns best lap time for each compound used", () => {
    const stints = [
      createStint({ compound: "SOFT", lapStart: 1, lapEnd: 3 }),
      createStint({ compound: "MEDIUM", lapStart: 4, lapEnd: 6, stintNumber: 2 }),
    ];
    const laps = [
      createLap({ lapNumber: 1, lapDuration: 89 }),
      createLap({ lapNumber: 2, lapDuration: 88 }),
      createLap({ lapNumber: 3, lapDuration: 88.5 }),
      createLap({ lapNumber: 4, lapDuration: 91 }),
      createLap({ lapNumber: 5, lapDuration: 90 }),
      createLap({ lapNumber: 6, lapDuration: 90.5 }),
    ];

    const result = computeBestLapByCompound(laps, stints);

    expect(result).toEqual({ SOFT: 88, MEDIUM: 90 });
  });

  it("excludes pit-out laps and null durations", () => {
    const stints = [createStint({ compound: "HARD", lapStart: 1, lapEnd: 4 })];
    const laps = [
      createLap({ lapNumber: 1, isPitOutLap: true, lapDuration: 85 }),
      createLap({ lapNumber: 2, lapDuration: null }),
      createLap({ lapNumber: 3, lapDuration: 92 }),
      createLap({ lapNumber: 4, lapDuration: 91 }),
    ];

    const result = computeBestLapByCompound(laps, stints);

    expect(result).toEqual({ HARD: 91 });
  });

  it("picks global best across multiple stints with same compound", () => {
    const stints = [
      createStint({ compound: "SOFT", lapStart: 1, lapEnd: 2, stintNumber: 1 }),
      createStint({ compound: "SOFT", lapStart: 5, lapEnd: 6, stintNumber: 2 }),
    ];
    const laps = [
      createLap({ lapNumber: 1, lapDuration: 89 }),
      createLap({ lapNumber: 2, lapDuration: 90 }),
      createLap({ lapNumber: 5, lapDuration: 87.5 }),
      createLap({ lapNumber: 6, lapDuration: 88 }),
    ];

    const result = computeBestLapByCompound(laps, stints);

    expect(result).toEqual({ SOFT: 87.5 });
  });
});

describe("computeLongRunAveragePace", () => {
  it("returns average lap time for long-run stints excluding pit-out laps", () => {
    const stints = [
      createStint({ stintType: "long_run", lapStart: 1, lapEnd: 5 }),
    ];
    const laps = [
      createLap({ lapNumber: 1, isPitOutLap: true, lapDuration: 100 }),
      createLap({ lapNumber: 2, lapDuration: 90 }),
      createLap({ lapNumber: 3, lapDuration: 91 }),
      createLap({ lapNumber: 4, lapDuration: 90 }),
      createLap({ lapNumber: 5, lapDuration: 89 }),
    ];

    const result = computeLongRunAveragePace(laps, stints);

    expect(result).toBe(90);
  });

  it("excludes outliers greater than 107% of stint mean", () => {
    const stints = [
      createStint({ stintType: "long_run", lapStart: 1, lapEnd: 5 }),
    ];
    const laps = [
      createLap({ lapNumber: 1, lapDuration: 90 }),
      createLap({ lapNumber: 2, lapDuration: 91 }),
      createLap({ lapNumber: 3, lapDuration: 90 }),
      createLap({ lapNumber: 4, lapDuration: 91 }),
      createLap({ lapNumber: 5, lapDuration: 120 }), // outlier: 120 > 96.4 * 1.07 = 103.1
    ];

    const result = computeLongRunAveragePace(laps, stints);

    expect(result).toBe(90.5);
  });

  it("returns null when no long-run stints exist", () => {
    const stints = [
      createStint({ stintType: "quali_sim", lapStart: 1, lapEnd: 3 }),
      createStint({ stintType: "installation", lapStart: 4, lapEnd: 4 }),
    ];
    const laps = [
      createLap({ lapNumber: 1, lapDuration: 88 }),
      createLap({ lapNumber: 2, lapDuration: 87 }),
      createLap({ lapNumber: 3, lapDuration: 88 }),
      createLap({ lapNumber: 4, lapDuration: 95 }),
    ];

    const result = computeLongRunAveragePace(laps, stints);

    expect(result).toBeNull();
  });
});

describe("computeSectorPerformance", () => {
  it("returns best and mean sector times from timed laps", () => {
    const laps = [
      createLap({ lapNumber: 1, sector1Duration: 30, sector2Duration: 32, sector3Duration: 28 }),
      createLap({ lapNumber: 2, sector1Duration: 29, sector2Duration: 31, sector3Duration: 29 }),
      createLap({ lapNumber: 3, sector1Duration: 31, sector2Duration: 33, sector3Duration: 27 }),
    ];

    const result = computeSectorPerformance(laps);

    expect(result.bestSector1).toBe(29);
    expect(result.bestSector2).toBe(31);
    expect(result.bestSector3).toBe(27);
    expect(result.meanSector1).toBe(30);
    expect(result.meanSector2).toBe(32);
    expect(result.meanSector3).toBe(28);
  });

  it("excludes pit-out laps from sector calculations", () => {
    const laps = [
      createLap({ lapNumber: 1, isPitOutLap: true, sector1Duration: 25, sector2Duration: 25, sector3Duration: 25 }),
      createLap({ lapNumber: 2, sector1Duration: 30, sector2Duration: 32, sector3Duration: 28 }),
      createLap({ lapNumber: 3, sector1Duration: 31, sector2Duration: 33, sector3Duration: 29 }),
    ];

    const result = computeSectorPerformance(laps);

    expect(result.bestSector1).toBe(30);
    expect(result.meanSector1).toBe(30.5);
  });

  it("returns null for sectors with no valid data", () => {
    const laps = [
      createLap({ lapNumber: 1, sector1Duration: 30, sector2Duration: null, sector3Duration: null }),
      createLap({ lapNumber: 2, sector1Duration: 29, sector2Duration: null, sector3Duration: null }),
    ];

    const result = computeSectorPerformance(laps);

    expect(result.bestSector1).toBe(29);
    expect(result.meanSector1).toBe(29.5);
    expect(result.bestSector2).toBeNull();
    expect(result.meanSector2).toBeNull();
    expect(result.bestSector3).toBeNull();
    expect(result.meanSector3).toBeNull();
  });
});

describe("computeDegradationRate", () => {
  it("computes positive slope for degrading lap times in long-run stint", () => {
    const stints = [
      createStint({ stintType: "long_run", compound: "MEDIUM", lapStart: 1, lapEnd: 6 }),
    ];
    const laps = [
      createLap({ lapNumber: 1, isPitOutLap: true, lapDuration: 100 }),
      createLap({ lapNumber: 2, lapDuration: 90 }),
      createLap({ lapNumber: 3, lapDuration: 91 }),
      createLap({ lapNumber: 4, lapDuration: 92 }),
      createLap({ lapNumber: 5, lapDuration: 93 }),
      createLap({ lapNumber: 6, lapDuration: 94 }),
    ];

    const result = computeDegradationRate(laps, stints);

    expect(result).toHaveLength(1);
    expect(result[0].stintNumber).toBe(1);
    expect(result[0].compound).toBe("MEDIUM");
    expect(result[0].degradationRate).toBe(1);
    expect(result[0].lapCount).toBe(5);
  });

  it("excludes outliers greater than 107% of stint mean", () => {
    const stints = [
      createStint({ stintType: "long_run", compound: "HARD", lapStart: 1, lapEnd: 7 }),
    ];
    const laps = [
      createLap({ lapNumber: 1, isPitOutLap: true, lapDuration: 100 }),
      createLap({ lapNumber: 2, lapDuration: 90 }),
      createLap({ lapNumber: 3, lapDuration: 91 }),
      createLap({ lapNumber: 4, lapDuration: 120 }), // outlier: > mean * 1.07
      createLap({ lapNumber: 5, lapDuration: 92 }),
      createLap({ lapNumber: 6, lapDuration: 93 }),
      createLap({ lapNumber: 7, lapDuration: 94 }),
    ];

    const result = computeDegradationRate(laps, stints);

    expect(result).toHaveLength(1);
    expect(result[0].lapCount).toBe(5);
    expect(result[0].degradationRate).toBeCloseTo(0.756, 2);
  });

  it("returns empty array when no long-run stints exist", () => {
    const stints = [
      createStint({ stintType: "quali_sim", lapStart: 1, lapEnd: 3 }),
      createStint({ stintType: "aero_check", lapStart: 4, lapEnd: 6, stintNumber: 2 }),
    ];
    const laps = [
      createLap({ lapNumber: 1, lapDuration: 88 }),
      createLap({ lapNumber: 2, lapDuration: 87 }),
      createLap({ lapNumber: 3, lapDuration: 88 }),
      createLap({ lapNumber: 4, lapDuration: 89 }),
      createLap({ lapNumber: 5, lapDuration: 90 }),
      createLap({ lapNumber: 6, lapDuration: 91 }),
    ];

    const result = computeDegradationRate(laps, stints);

    expect(result).toEqual([]);
  });
});

describe("computeFuelCorrectedLongRunPace", () => {
  it("applies 0.06s/lap fuel correction to long-run lap times", () => {
    const stints = [
      createStint({ stintType: "long_run", lapStart: 1, lapEnd: 5 }),
    ];
    const laps = [
      createLap({ lapNumber: 1, isPitOutLap: true, lapDuration: 100 }),
      createLap({ lapNumber: 2, lapDuration: 90 }),
      createLap({ lapNumber: 3, lapDuration: 90 }),
      createLap({ lapNumber: 4, lapDuration: 90 }),
      createLap({ lapNumber: 5, lapDuration: 90 }),
    ];

    const result = computeFuelCorrectedLongRunPace(laps, stints);

    // Lap indices 0,1,2,3 -> corrections: 0, 0.06, 0.12, 0.18
    // Corrected times: 90, 89.94, 89.88, 89.82
    // Mean: 89.91
    expect(result).toBeCloseTo(89.91, 2);
  });

  it("excludes pit-out laps and outliers before applying correction", () => {
    const stints = [
      createStint({ stintType: "long_run", lapStart: 1, lapEnd: 6 }),
    ];
    const laps = [
      createLap({ lapNumber: 1, isPitOutLap: true, lapDuration: 100 }),
      createLap({ lapNumber: 2, lapDuration: 90 }),
      createLap({ lapNumber: 3, lapDuration: 120 }), // outlier
      createLap({ lapNumber: 4, lapDuration: 90 }),
      createLap({ lapNumber: 5, lapDuration: 90 }),
      createLap({ lapNumber: 6, lapDuration: 90 }),
    ];

    const result = computeFuelCorrectedLongRunPace(laps, stints);

    // After outlier exclusion: indices 0,2,3,4 with times 90,90,90,90
    // Corrected: 90, 89.88, 89.82, 89.76
    // Mean: 89.865
    expect(result).toBeCloseTo(89.865, 2);
  });

  it("returns null when no long-run stints exist", () => {
    const stints = [
      createStint({ stintType: "quali_sim", lapStart: 1, lapEnd: 3 }),
    ];
    const laps = [
      createLap({ lapNumber: 1, lapDuration: 88 }),
      createLap({ lapNumber: 2, lapDuration: 87 }),
      createLap({ lapNumber: 3, lapDuration: 88 }),
    ];

    const result = computeFuelCorrectedLongRunPace(laps, stints);

    expect(result).toBeNull();
  });
});

describe("computeConsistency", () => {
  it("computes standard deviation of lap times in long-run stints", () => {
    const stints = [
      createStint({ stintType: "long_run", lapStart: 1, lapEnd: 5 }),
    ];
    const laps = [
      createLap({ lapNumber: 1, isPitOutLap: true, lapDuration: 100 }),
      createLap({ lapNumber: 2, lapDuration: 90 }),
      createLap({ lapNumber: 3, lapDuration: 92 }),
      createLap({ lapNumber: 4, lapDuration: 90 }),
      createLap({ lapNumber: 5, lapDuration: 92 }),
    ];

    const result = computeConsistency(laps, stints);

    // Times: 90, 92, 90, 92 -> mean = 91
    // Squared diffs: 1, 1, 1, 1 -> variance = 1 -> std dev = 1
    expect(result).toBe(1);
  });

  it("excludes outliers greater than 107% of stint mean", () => {
    const stints = [
      createStint({ stintType: "long_run", lapStart: 1, lapEnd: 6 }),
    ];
    const laps = [
      createLap({ lapNumber: 1, isPitOutLap: true, lapDuration: 100 }),
      createLap({ lapNumber: 2, lapDuration: 90 }),
      createLap({ lapNumber: 3, lapDuration: 92 }),
      createLap({ lapNumber: 4, lapDuration: 120 }), // outlier
      createLap({ lapNumber: 5, lapDuration: 90 }),
      createLap({ lapNumber: 6, lapDuration: 92 }),
    ];

    const result = computeConsistency(laps, stints);

    // After outlier exclusion: 90, 92, 90, 92 -> std dev = 1
    expect(result).toBe(1);
  });

  it("returns null when no long-run stints exist", () => {
    const stints = [
      createStint({ stintType: "quali_sim", lapStart: 1, lapEnd: 3 }),
    ];
    const laps = [
      createLap({ lapNumber: 1, lapDuration: 88 }),
      createLap({ lapNumber: 2, lapDuration: 87 }),
      createLap({ lapNumber: 3, lapDuration: 88 }),
    ];

    const result = computeConsistency(laps, stints);

    expect(result).toBeNull();
  });
});
