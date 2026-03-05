import { describe, it, expect } from "vitest";
import type { Session, Lap, Stint, WeatherSnapshot } from "../../src/domain/session.js";

describe("Session domain models", () => {
  it("constructs a valid Lap", () => {
    const lap: Lap = {
      driverNumber: 1,
      lapNumber: 5,
      lapDuration: 91.743,
      sector1Duration: 26.966,
      sector2Duration: 38.657,
      sector3Duration: 26.12,
      i1Speed: 307,
      i2Speed: 277,
      stSpeed: 298,
      isPitOutLap: false,
      dateStart: "2023-09-16T13:59:07.606000+00:00",
    };

    expect(lap.lapDuration).toBe(91.743);
    expect(lap.isPitOutLap).toBe(false);
  });

  it("constructs a valid Stint with stint type", () => {
    const stint: Stint = {
      driverNumber: 1,
      stintNumber: 2,
      compound: "MEDIUM",
      lapStart: 8,
      lapEnd: 20,
      tyreAgeAtStart: 0,
      stintType: "long_run",
    };

    expect(stint.compound).toBe("MEDIUM");
    expect(stint.stintType).toBe("long_run");
    expect(stint.lapEnd - stint.lapStart + 1).toBe(13);
  });

  it("allows null stint type before classification", () => {
    const stint: Stint = {
      driverNumber: 44,
      stintNumber: 1,
      compound: "SOFT",
      lapStart: 1,
      lapEnd: 1,
      tyreAgeAtStart: 0,
      stintType: null,
    };

    expect(stint.stintType).toBeNull();
  });
});
