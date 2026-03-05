import { describe, it, expect } from "vitest";
import { assembleSessionFeatures } from "../../src/domain/feature-assembler.js";
import type {
  Session,
  SessionMetadata,
  DriverSession,
  Driver,
  Lap,
  Stint,
  WeatherSnapshot,
} from "../../src/domain/session.js";

function createMetadata(overrides: Partial<SessionMetadata> = {}): SessionMetadata {
  return {
    sessionKey: 9999,
    meetingKey: 1000,
    sessionName: "Practice 1",
    sessionType: "Practice",
    circuitShortName: "Monza",
    countryName: "Italy",
    dateStart: "2024-09-01T10:00:00",
    dateEnd: "2024-09-01T11:00:00",
    year: 2024,
    ...overrides,
  };
}

function createDriver(overrides: Partial<Driver> = {}): Driver {
  return {
    driverNumber: 1,
    firstName: "Max",
    lastName: "Verstappen",
    nameAcronym: "VER",
    teamName: "Red Bull Racing",
    teamColour: "3671C6",
    ...overrides,
  };
}

function createLap(overrides: Partial<Lap> = {}): Lap {
  return {
    driverNumber: 1,
    lapNumber: 1,
    lapDuration: 85,
    sector1Duration: 28,
    sector2Duration: 29,
    sector3Duration: 28,
    i1Speed: 280,
    i2Speed: 290,
    stSpeed: 310,
    isPitOutLap: false,
    dateStart: "2024-09-01T10:05:00",
    ...overrides,
  };
}

function createStint(overrides: Partial<Stint> = {}): Stint {
  return {
    driverNumber: 1,
    stintNumber: 1,
    compound: "MEDIUM",
    lapStart: 1,
    lapEnd: 8,
    tyreAgeAtStart: 0,
    stintType: null,
    ...overrides,
  };
}

function createWeatherSnapshot(overrides: Partial<WeatherSnapshot> = {}): WeatherSnapshot {
  return {
    airTemperature: 25,
    trackTemperature: 40,
    humidity: 50,
    pressure: 1013,
    rainfall: 0,
    windSpeed: 3,
    windDirection: 180,
    date: "2024-09-01T10:00:00",
    ...overrides,
  };
}

function buildLongRunLaps(start: number, count: number): Lap[] {
  return Array.from({ length: count }, (_, i) =>
    createLap({
      lapNumber: start + i,
      lapDuration: 86 + i * 0.1,
      isPitOutLap: i === 0 ? true : false,
    })
  );
}

describe("assembleSessionFeatures", () => {
  it("assembles a complete SessionFeatures from a session with one driver", () => {
    const laps = buildLongRunLaps(1, 8);
    const stint = createStint({ lapStart: 1, lapEnd: 8 });
    const ds: DriverSession = {
      driver: createDriver(),
      laps,
      stints: [stint],
      pitStops: [],
    };
    const session: Session = {
      metadata: createMetadata(),
      drivers: [ds],
      weather: [createWeatherSnapshot()],
    };

    const result = assembleSessionFeatures(session);

    expect(result.sessionKey).toBe(9999);
    expect(result.circuitShortName).toBe("Monza");
    expect(result.sessionName).toBe("Practice 1");
    expect(result.drivers).toHaveLength(1);

    const driver = result.drivers[0];
    expect(driver.driverNumber).toBe(1);
    expect(driver.nameAcronym).toBe("VER");
    expect(driver.teamName).toBe("Red Bull Racing");
    expect(driver.sessionKey).toBe(9999);
    expect(driver.totalLaps).toBe(8);
    expect(driver.weather.meanTrackTemperature).toBe(40);
    expect(driver.stints).toHaveLength(1);
    expect(driver.pace.bestLapByCompound).toBeDefined();
    expect(driver.speed.bestStSpeed).toBeDefined();
    expect(driver.rankings).toBeDefined();
    expect(driver.rankings.bestLap).toBe(1);
  });

  it("produces stint summaries with lap stats and degradation", () => {
    const laps = buildLongRunLaps(1, 8);
    const stint = createStint({ lapStart: 1, lapEnd: 8 });
    const ds: DriverSession = {
      driver: createDriver(),
      laps,
      stints: [stint],
      pitStops: [],
    };
    const session: Session = {
      metadata: createMetadata(),
      drivers: [ds],
      weather: [createWeatherSnapshot()],
    };

    const result = assembleSessionFeatures(session);
    const stintSummary = result.drivers[0].stints[0];

    expect(stintSummary.stintNumber).toBe(1);
    expect(stintSummary.compound).toBe("MEDIUM");
    expect(stintSummary.lapCount).toBe(8);
    expect(stintSummary.stintType).toBe("long_run");
    expect(stintSummary.bestLap).toBeTypeOf("number");
    expect(stintSummary.meanLap).toBeTypeOf("number");
    // long run with increasing times → positive degradation
    expect(stintSummary.degradationRate).toBeTypeOf("number");
    expect(stintSummary.degradationRate!).toBeGreaterThan(0);
  });

  it("uses default weather when no weather snapshots exist", () => {
    const laps = [createLap()];
    const stint = createStint({ lapStart: 1, lapEnd: 1 });
    const ds: DriverSession = {
      driver: createDriver(),
      laps,
      stints: [stint],
      pitStops: [],
    };
    const session: Session = {
      metadata: createMetadata(),
      drivers: [ds],
      weather: [],
    };

    const result = assembleSessionFeatures(session);

    expect(result.drivers[0].weather).toEqual({
      meanTrackTemperature: 0,
      meanAirTemperature: 0,
      meanHumidity: 0,
      rainfall: false,
      meanWindSpeed: 0,
    });
  });
});
