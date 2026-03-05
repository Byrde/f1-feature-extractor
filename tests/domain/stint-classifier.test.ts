import { describe, it, expect } from "vitest";
import { classifyStints } from "../../src/domain/stint-classifier.js";
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

describe("classifyStints", () => {
  it("classifies stint with 5+ timed laps as long_run", () => {
    const stint = createStint({ lapStart: 1, lapEnd: 6 });
    const laps = [
      createLap({ lapNumber: 1, isPitOutLap: true }),
      createLap({ lapNumber: 2, lapDuration: 91 }),
      createLap({ lapNumber: 3, lapDuration: 90.5 }),
      createLap({ lapNumber: 4, lapDuration: 91.2 }),
      createLap({ lapNumber: 5, lapDuration: 90.8 }),
      createLap({ lapNumber: 6, lapDuration: 91.1 }),
    ];

    const result = classifyStints([stint], laps);

    expect(result[0].stintType).toBe("long_run");
  });

  it("classifies fresh soft stint with ≤3 fast laps as quali_sim", () => {
    const stint = createStint({
      stintNumber: 2,
      compound: "SOFT",
      tyreAgeAtStart: 0,
      lapStart: 10,
      lapEnd: 12,
    });
    const laps = [
      createLap({ lapNumber: 10, isPitOutLap: true }),
      createLap({ lapNumber: 11, lapDuration: 88 }),
      createLap({ lapNumber: 12, lapDuration: 88.5 }),
    ];

    const result = classifyStints([stint], laps);

    expect(result[0].stintType).toBe("quali_sim");
  });

  it("classifies first stint with single slow lap as installation", () => {
    const installStint = createStint({
      stintNumber: 1,
      lapStart: 1,
      lapEnd: 1,
    });
    const longRunStint = createStint({
      stintNumber: 2,
      lapStart: 5,
      lapEnd: 12,
    });
    const laps = [
      createLap({ lapNumber: 1, lapDuration: 120 }),
      ...Array.from({ length: 8 }, (_, i) =>
        createLap({ lapNumber: 5 + i, lapDuration: 90 + i * 0.1 })
      ),
    ];

    const result = classifyStints([installStint, longRunStint], laps);

    expect(result[0].stintType).toBe("installation");
    expect(result[1].stintType).toBe("long_run");
  });

  it("excludes outliers and pit-out laps from classification", () => {
    const stint = createStint({ lapStart: 1, lapEnd: 7 });
    const laps = [
      createLap({ lapNumber: 1, isPitOutLap: true, lapDuration: 150 }),
      createLap({ lapNumber: 2, lapDuration: 90 }),
      createLap({ lapNumber: 3, lapDuration: 91 }),
      createLap({ lapNumber: 4, lapDuration: 200 }), // outlier
      createLap({ lapNumber: 5, lapDuration: 90.5 }),
      createLap({ lapNumber: 6, lapDuration: 91.5 }),
      createLap({ lapNumber: 7, lapDuration: 90.8 }),
    ];

    const result = classifyStints([stint], laps);

    expect(result[0].stintType).toBe("long_run");
  });
});
