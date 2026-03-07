import { describe, it, expect } from "vitest";
import { assembleWeekendFeatures, poolDriverData } from "../../src/domain/weekend-assembler.js";
import { assembleSessionFeatures } from "../../src/domain/feature-assembler.js";
import type {
  Session,
  SessionMetadata,
  Driver,
  DriverSession,
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

function buildLongRunLaps(
  driverNumber: number,
  start: number,
  count: number,
  baseDuration = 86,
  baseDate = "2024-09-01T10:05:00",
): Lap[] {
  const base = new Date(baseDate).getTime();
  return Array.from({ length: count }, (_, i) =>
    createLap({
      driverNumber,
      lapNumber: start + i,
      lapDuration: baseDuration + i * 0.1,
      isPitOutLap: i === 0,
      stSpeed: 310 + i,
      dateStart: new Date(base + i * 90_000).toISOString(),
    }),
  );
}

function buildSession(
  metadata: Partial<SessionMetadata>,
  driverSessions: DriverSession[],
): Session {
  return {
    metadata: createMetadata(metadata),
    drivers: driverSessions,
    weather: [createWeatherSnapshot()],
  };
}

function buildDriverSession(
  driver: Partial<Driver>,
  laps: Lap[],
  stints: Stint[],
): DriverSession {
  return { driver: createDriver(driver), laps, stints, pitStops: [] };
}

describe("poolDriverData", () => {
  it("offsets lap numbers and stint ranges to avoid collisions across sessions", () => {
    const s1 = buildSession(
      { sessionKey: 1, sessionName: "Practice 1" },
      [buildDriverSession({ driverNumber: 1 }, buildLongRunLaps(1, 1, 8), [
        createStint({ driverNumber: 1, stintNumber: 1, lapStart: 1, lapEnd: 8 }),
      ])],
    );
    const s2 = buildSession(
      { sessionKey: 2, sessionName: "Practice 2" },
      [buildDriverSession({ driverNumber: 1 }, buildLongRunLaps(1, 1, 6), [
        createStint({ driverNumber: 1, stintNumber: 1, lapStart: 1, lapEnd: 6 }),
      ])],
    );

    const pooled = poolDriverData(1, [s1, s2]);

    expect(pooled.laps).toHaveLength(14);

    const s1LapNumbers = pooled.laps.slice(0, 8).map((l) => l.lapNumber);
    expect(s1LapNumbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);

    const s2LapNumbers = pooled.laps.slice(8).map((l) => l.lapNumber);
    expect(s2LapNumbers).toEqual([9, 10, 11, 12, 13, 14]);

    expect(pooled.stints).toHaveLength(2);
    expect(pooled.stints[0]).toMatchObject({ stintNumber: 1, lapStart: 1, lapEnd: 8 });
    expect(pooled.stints[1]).toMatchObject({ stintNumber: 2, lapStart: 9, lapEnd: 14 });
  });

  it("handles a driver appearing in only one session", () => {
    const s1 = buildSession(
      { sessionKey: 1 },
      [buildDriverSession({ driverNumber: 1 }, buildLongRunLaps(1, 1, 6), [
        createStint({ driverNumber: 1, stintNumber: 1, lapStart: 1, lapEnd: 6 }),
      ])],
    );
    const s2 = buildSession({ sessionKey: 2 }, []);

    const pooled = poolDriverData(1, [s1, s2]);

    expect(pooled.laps).toHaveLength(6);
    expect(pooled.stints).toHaveLength(1);
  });

  it("handles multiple stints per session with correct offset", () => {
    const laps = [
      ...buildLongRunLaps(1, 1, 6),
      ...buildLongRunLaps(1, 7, 6, 87),
    ];
    const stints = [
      createStint({ driverNumber: 1, stintNumber: 1, lapStart: 1, lapEnd: 6 }),
      createStint({ driverNumber: 1, stintNumber: 2, lapStart: 7, lapEnd: 12, compound: "HARD" }),
    ];
    const s1 = buildSession({ sessionKey: 1 }, [buildDriverSession({ driverNumber: 1 }, laps, stints)]);
    const s2 = buildSession(
      { sessionKey: 2 },
      [buildDriverSession({ driverNumber: 1 }, buildLongRunLaps(1, 1, 6, 85), [
        createStint({ driverNumber: 1, stintNumber: 1, lapStart: 1, lapEnd: 6 }),
      ])],
    );

    const pooled = poolDriverData(1, [s1, s2]);

    expect(pooled.stints).toHaveLength(3);
    expect(pooled.stints[0]).toMatchObject({ stintNumber: 1, lapStart: 1, lapEnd: 6 });
    expect(pooled.stints[1]).toMatchObject({ stintNumber: 2, lapStart: 7, lapEnd: 12 });
    expect(pooled.stints[2]).toMatchObject({ stintNumber: 3, lapStart: 13, lapEnd: 18 });
  });
});

describe("assembleWeekendFeatures", () => {
  function buildTwoSessionSetup() {
    const fp1Laps = buildLongRunLaps(1, 1, 8, 86);
    const fp1 = buildSession(
      { sessionKey: 1, sessionName: "Practice 1" },
      [buildDriverSession(
        { driverNumber: 1, nameAcronym: "VER", teamName: "Red Bull Racing" },
        fp1Laps,
        [createStint({ driverNumber: 1, stintNumber: 1, lapStart: 1, lapEnd: 8 })],
      )],
    );

    const fp2Laps = buildLongRunLaps(1, 1, 10, 85);
    const fp2 = buildSession(
      { sessionKey: 2, sessionName: "Practice 2" },
      [buildDriverSession(
        { driverNumber: 1, nameAcronym: "VER", teamName: "Red Bull Racing" },
        fp2Laps,
        [createStint({ driverNumber: 1, stintNumber: 1, lapStart: 1, lapEnd: 10 })],
      )],
    );

    const fp1Features = assembleSessionFeatures(fp1);
    const fp2Features = assembleSessionFeatures(fp2);

    return { sessions: [fp1, fp2], features: [fp1Features, fp2Features] };
  }

  it("produces combined features with pooled sample sizes", () => {
    const { sessions, features } = buildTwoSessionSetup();
    const result = assembleWeekendFeatures(sessions, features);

    expect(result.circuitShortName).toBe("Monza");
    expect(result.sessionsIncluded).toEqual(["Practice 1", "Practice 2"]);
    expect(result.drivers).toHaveLength(1);

    const driver = result.drivers[0];
    expect(driver.nameAcronym).toBe("VER");

    // Pooled: 7 valid laps from FP1 + 9 from FP2 (first lap of each stint is pit-out)
    expect(driver.pace.longRunSampleSize).toBeGreaterThan(
      features[0].drivers[0].pace.longRunSampleSize,
    );
    expect(driver.pace.longRunSampleSize).toBeGreaterThan(
      features[1].drivers[0].pace.longRunSampleSize,
    );
  });

  it("produces combined confidence from pooled data", () => {
    const { sessions, features } = buildTwoSessionSetup();
    const result = assembleWeekendFeatures(sessions, features);

    const driver = result.drivers[0];
    expect(driver.confidence).toBeDefined();
    expect(driver.confidence.longRunPace.sampleSize).toBeGreaterThan(
      features[0].drivers[0].confidence.longRunPace.sampleSize,
    );
  });

  it("computes session-over-session deltas (last minus first)", () => {
    const { sessions, features } = buildTwoSessionSetup();
    const result = assembleWeekendFeatures(sessions, features);

    const deltas = result.drivers[0].deltas;
    expect(deltas).not.toBeNull();
    expect(deltas!.longRunPaceDelta).toBeTypeOf("number");
    expect(deltas!.bestStSpeedDelta).toBeTypeOf("number");
  });

  it("returns null deltas for a single session", () => {
    const fp1Laps = buildLongRunLaps(1, 1, 8, 86);
    const fp1 = buildSession(
      { sessionKey: 1, sessionName: "Practice 1" },
      [buildDriverSession(
        { driverNumber: 1 },
        fp1Laps,
        [createStint({ driverNumber: 1, stintNumber: 1, lapStart: 1, lapEnd: 8 })],
      )],
    );
    const fp1Features = assembleSessionFeatures(fp1);

    const result = assembleWeekendFeatures([fp1], [fp1Features]);

    expect(result.drivers).toHaveLength(1);
    expect(result.drivers[0].deltas).toBeNull();
  });

  it("includes drivers appearing in only one of two sessions", () => {
    const fp1 = buildSession(
      { sessionKey: 1, sessionName: "Practice 1" },
      [
        buildDriverSession(
          { driverNumber: 1, nameAcronym: "VER" },
          buildLongRunLaps(1, 1, 8),
          [createStint({ driverNumber: 1, stintNumber: 1, lapStart: 1, lapEnd: 8 })],
        ),
        buildDriverSession(
          { driverNumber: 11, nameAcronym: "PER" },
          buildLongRunLaps(11, 1, 6),
          [createStint({ driverNumber: 11, stintNumber: 1, lapStart: 1, lapEnd: 6 })],
        ),
      ],
    );

    const fp2 = buildSession(
      { sessionKey: 2, sessionName: "Practice 2" },
      [
        buildDriverSession(
          { driverNumber: 1, nameAcronym: "VER" },
          buildLongRunLaps(1, 1, 10),
          [createStint({ driverNumber: 1, stintNumber: 1, lapStart: 1, lapEnd: 10 })],
        ),
      ],
    );

    const fp1Features = assembleSessionFeatures(fp1);
    const fp2Features = assembleSessionFeatures(fp2);

    const result = assembleWeekendFeatures([fp1, fp2], [fp1Features, fp2Features]);

    expect(result.drivers).toHaveLength(2);

    const ver = result.drivers.find((d) => d.nameAcronym === "VER")!;
    const per = result.drivers.find((d) => d.nameAcronym === "PER")!;

    expect(ver.sessionsIncluded).toEqual(["Practice 1", "Practice 2"]);
    expect(ver.deltas).not.toBeNull();

    expect(per.sessionsIncluded).toEqual(["Practice 1"]);
    expect(per.deltas).toBeNull();
  });

  it("computes rankings across combined drivers", () => {
    const fp1 = buildSession(
      { sessionKey: 1, sessionName: "Practice 1" },
      [
        buildDriverSession(
          { driverNumber: 1, nameAcronym: "VER" },
          buildLongRunLaps(1, 1, 8, 85),
          [createStint({ driverNumber: 1, stintNumber: 1, lapStart: 1, lapEnd: 8 })],
        ),
        buildDriverSession(
          { driverNumber: 44, nameAcronym: "HAM" },
          buildLongRunLaps(44, 1, 8, 86),
          [createStint({ driverNumber: 44, stintNumber: 1, lapStart: 1, lapEnd: 8 })],
        ),
      ],
    );

    const fp1Features = assembleSessionFeatures(fp1);
    const result = assembleWeekendFeatures([fp1], [fp1Features]);

    const ver = result.drivers.find((d) => d.nameAcronym === "VER")!;
    const ham = result.drivers.find((d) => d.nameAcronym === "HAM")!;

    expect(ver.rankings.longRunPace).toBe(1);
    expect(ham.rankings.longRunPace).toBe(2);
  });
});
