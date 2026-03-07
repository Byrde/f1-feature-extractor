import { describe, it, expect } from "vitest";
import { computeConfidence } from "../../src/domain/confidence.js";
import type { StintDegradation } from "../../src/domain/features.js";

function createDegStint(overrides: Partial<StintDegradation> = {}): StintDegradation {
  return {
    stintNumber: 1,
    compound: "MEDIUM",
    degradationRate: 0.1,
    rSquared: 0.8,
    lapCount: 10,
    ...overrides,
  };
}

describe("computeConfidence", () => {
  it("returns HIGH overall when all metrics have large samples and good fit", () => {
    const stints = [createDegStint({ lapCount: 15, rSquared: 0.85 })];

    const result = computeConfidence(18, 18, 18, stints);

    expect(result.overall).toBe("HIGH");
    expect(result.longRunPace.level).toBe("HIGH");
    expect(result.fuelCorrectedPace.level).toBe("HIGH");
    expect(result.consistency.level).toBe("HIGH");
    expect(result.degradation.level).toBe("HIGH");
    expect(result.degradation.meanRSquared).toBeCloseTo(0.85, 2);
  });

  it("returns INSUFFICIENT overall when any metric has too few laps", () => {
    const stints = [createDegStint({ lapCount: 15, rSquared: 0.9 })];

    const result = computeConfidence(3, 18, 18, stints);

    expect(result.overall).toBe("INSUFFICIENT");
    expect(result.longRunPace.level).toBe("INSUFFICIENT");
    expect(result.longRunPace.sampleSize).toBe(3);
    expect(result.fuelCorrectedPace.level).toBe("HIGH");
  });

  it("degrades degradation confidence when R² is low despite adequate laps", () => {
    const stints = [createDegStint({ lapCount: 15, rSquared: 0.15 })];

    const result = computeConfidence(15, 15, 15, stints);

    expect(result.degradation.level).toBe("LOW");
    expect(result.overall).toBe("LOW");
  });
});
