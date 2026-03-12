import { describe, it, expect, vi } from "vitest";
import { writeReport, buildReportSlug, buildCombinedData } from "../../src/api/sheets-report.js";
import type { GoogleSheetsClient, SpreadsheetRef, CellValue } from "../../src/infrastructure/google-sheets-client.js";
import type { SessionFeatures, DriverFeatures, CrossSessionFeatures, CrossSessionDriverFeatures } from "../../src/domain/features.js";
import type { MeetingRaceResult } from "../../src/domain/history.js";
import type { Driver } from "../../src/domain/session.js";

function createMockClient(existingRef?: SpreadsheetRef): GoogleSheetsClient & {
  writtenRanges: { range: string; values: CellValue[][] }[];
  formatRequestCount: number;
  deletedSheetIds: number[];
  addedSheetTitles: string[];
} {
  const writtenRanges: { range: string; values: CellValue[][] }[] = [];
  const deletedSheetIds: number[] = [];
  const addedSheetTitles: string[] = [];
  let formatRequestCount = 0;
  let nextSheetId = 100;

  return {
    writtenRanges,
    deletedSheetIds,
    addedSheetTitles,
    get formatRequestCount() { return formatRequestCount; },
    async createSpreadsheet(_title: string, sheetTitles: string[]) {
      const sheetIds = new Map<string, number>();
      sheetTitles.forEach((name, i) => sheetIds.set(name, i));
      return { spreadsheetId: "test-id", url: "https://docs.google.com/spreadsheets/d/test-id", sheetIds };
    },
    async findSpreadsheet(_title: string, _parentFolderId?: string) {
      return existingRef ?? null;
    },
    async getSpreadsheet(spreadsheetId: string) {
      return existingRef ?? { spreadsheetId, url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`, sheetIds: new Map() };
    },
    async resolveFolderPath(_path: string) {
      return "mock-folder-id";
    },
    async deleteSheet(_spreadsheetId: string, sheetId: number) {
      deletedSheetIds.push(sheetId);
    },
    async renameSheet() {},
    async addSheet(_spreadsheetId: string, title: string) {
      addedSheetTitles.push(title);
      return nextSheetId++;
    },
    async writeValues(_id: string, range: string, values: CellValue[][]) {
      writtenRanges.push({ range, values });
    },
    async batchFormat(_id: string, requests: unknown[]) {
      formatRequestCount = requests.length;
    },
  };
}

function createTestDriver(overrides: Partial<DriverFeatures> = {}): DriverFeatures {
  return {
    driverNumber: 1,
    nameAcronym: "VER",
    teamName: "Red Bull Racing",
    teamColour: "3671C6",
    sessionKey: 9999,
    pace: {
      bestLapByCompound: { SOFT: 80.5, MEDIUM: 81.2 },
      longRunAveragePace: 82.0,
      longRunSampleSize: 10,
      bestSector1: 26.1, bestSector2: 27.2, bestSector3: 27.2,
      meanSector1: 26.5, meanSector2: 27.5, meanSector3: 27.8,
    },
    degradation: {
      degradationRateByStint: [{ stintNumber: 2, compound: "MEDIUM", degradationRate: 0.045, rSquared: 0.85, lapCount: 10 }],
      fuelCorrectedLongRunPace: 81.8,
      fuelCorrectedSampleSize: 10,
    },
    speed: {
      bestStSpeed: 315, meanStSpeed: 312, bestI1Speed: 280, meanI1Speed: 277,
      bestI2Speed: 290, meanI2Speed: 287,
    },
    consistency: { longRunLapTimeStdDev: 0.35, consistencySampleSize: 10 },
    confidence: {
      overall: "HIGH" as const,
      longRunPace: { level: "HIGH" as const, sampleSize: 10 },
      fuelCorrectedPace: { level: "HIGH" as const, sampleSize: 10 },
      degradation: { level: "HIGH" as const, sampleSize: 10, meanRSquared: 0.85 },
      consistency: { level: "HIGH" as const, sampleSize: 10 },
    },
    stints: [
      { stintNumber: 1, compound: "SOFT", lapCount: 1, bestLap: null, meanLap: null, degradationRate: null, weather: null },
      { stintNumber: 2, compound: "MEDIUM", lapCount: 10, bestLap: 81.2, meanLap: 82.0, degradationRate: 0.045, weather: { meanTrackTemperature: 44, meanAirTemperature: 27, meanHumidity: 45, rainfall: false, meanWindSpeed: 3.2 } },
    ],
    weather: { meanTrackTemperature: 42, meanAirTemperature: 26, meanHumidity: 48, rainfall: false, meanWindSpeed: 3.0 },
    totalLaps: 11,
    rankings: { longRunPace: 1, bestLap: 1, degradationRate: 3, consistency: 2 },
    ...overrides,
  };
}

function createTestSession(overrides: Partial<SessionFeatures> = {}): SessionFeatures {
  return {
    sessionKey: 9999,
    circuitShortName: "Monza",
    sessionName: "Practice 1",
    drivers: [createTestDriver()],
    ...overrides,
  };
}

describe("writeReport", () => {
  it("creates spreadsheet with Overview and Stints tabs and returns URL", async () => {
    const client = createMockClient();
    const sessions = [createTestSession()];

    const result = await writeReport(client, "Test Report", sessions);

    expect(result.url).toBe("https://docs.google.com/spreadsheets/d/test-id");
    expect(result.created).toBe(true);
  });

  it("writes overview data with group headers, column headers, and driver rows", async () => {
    const client = createMockClient();
    await writeReport(client, "Test", [createTestSession()]);

    const overview = client.writtenRanges.find((r) => r.range.includes("Overview"));
    expect(overview).toBeDefined();
    // Row 0: group headers, Row 1: column headers, Row 2: driver data
    expect(overview!.values).toHaveLength(3);
    expect(overview!.values[1][0]).toBe("Session");
    expect(overview!.values[2][0]).toBe("Practice 1");
    expect(overview!.values[2][1]).toBe("VER");
    expect(overview!.values[2][3]).toBe(11); // totalLaps
  });

  it("writes stints data with one row per stint", async () => {
    const client = createMockClient();
    await writeReport(client, "Test", [createTestSession()]);

    const stints = client.writtenRanges.find((r) => r.range.includes("Stints"));
    expect(stints).toBeDefined();
    // Row 0: headers, Row 1-2: two stints
    expect(stints!.values).toHaveLength(3);
    expect(stints!.values[0][0]).toBe("Session");
    expect(stints!.values[1][4]).toBe("SOFT");
    expect(stints!.values[2][4]).toBe("MEDIUM");
    expect(stints!.values[2][10]).toBe(0.85); // R²
    expect(stints!.values[2][11]).toBe(44); // track temp
  });

  it("reuses existing spreadsheet, deletes and recreates managed tabs", async () => {
    const existingRef: SpreadsheetRef = {
      spreadsheetId: "existing-id",
      url: "https://docs.google.com/spreadsheets/d/existing-id",
      sheetIds: new Map([["Overview", 10], ["Stints", 11], ["My Notes", 99]]),
    };
    const client = createMockClient(existingRef);

    const result = await writeReport(client, "test_slug", [createTestSession()]);

    expect(result.url).toBe("https://docs.google.com/spreadsheets/d/existing-id");
    expect(result.created).toBe(false);
    expect(client.deletedSheetIds).toEqual([10, 11]);
    expect(client.addedSheetTitles).toEqual(["Overview", "Stints"]);
    expect(client.writtenRanges).toHaveLength(2);
  });
});

describe("writeReport with history", () => {
  function createTestHistory(): MeetingRaceResult[] {
    return [
      {
        meetingKey: 100,
        meetingName: "Bahrain Grand Prix",
        countryName: "Bahrain",
        dateStart: "2024-03-01",
        results: [
          { driverNumber: 1, gridPosition: 1, finishPosition: 1, status: "Finished", lapsCompleted: 57 },
          { driverNumber: 44, gridPosition: 3, finishPosition: 5, status: "Finished", lapsCompleted: 57 },
        ],
      },
      {
        meetingKey: 200,
        meetingName: "Saudi Arabian Grand Prix",
        countryName: "Saudi Arabia",
        dateStart: "2024-03-15",
        results: [
          { driverNumber: 1, gridPosition: 2, finishPosition: 1, status: "Finished", lapsCompleted: 50 },
          { driverNumber: 44, gridPosition: 1, finishPosition: 20, status: "DNF", lapsCompleted: 23 },
        ],
      },
    ];
  }

  it("creates History tab when history is provided", async () => {
    const client = createMockClient();
    const sessions = [createTestSession({
      drivers: [
        createTestDriver({ driverNumber: 1, nameAcronym: "VER", teamName: "Red Bull Racing", teamColour: "3671C6" }),
        createTestDriver({ driverNumber: 44, nameAcronym: "HAM", teamName: "Ferrari", teamColour: "E80020" }),
      ],
    })];

    await writeReport(client, "Test", sessions, createTestHistory());

    const historyWrite = client.writtenRanges.find((r) => r.range.includes("History"));
    expect(historyWrite).toBeDefined();

    const data = historyWrite!.values;
    // Row 0: group headers (Bahrain, Saudi Arabia)
    expect(data[0][2]).toBe("Bahrain");
    expect(data[0][6]).toBe("Saudi Arabia");
    // Row 1: column headers
    expect(data[1]).toEqual(["Driver", "Team", "Grid", "Fin", "+/-", "Notes", "Grid", "Fin", "+/-", "Notes"]);
    // Data rows sorted by team: Ferrari (HAM) before Red Bull (VER)
    expect(data[2][0]).toBe("HAM");
    expect(data[3][0]).toBe("VER");
  });

  it("computes +/- and status notes correctly", async () => {
    const client = createMockClient();
    const sessions = [createTestSession({
      drivers: [
        createTestDriver({ driverNumber: 1, nameAcronym: "VER", teamName: "Red Bull Racing" }),
        createTestDriver({ driverNumber: 44, nameAcronym: "HAM", teamName: "Ferrari" }),
      ],
    })];

    await writeReport(client, "Test", sessions, createTestHistory());

    const data = client.writtenRanges.find((r) => r.range.includes("History"))!.values;
    // HAM row (sorted first — Ferrari): Bahrain grid=3, fin=5, +/- = -2, Notes=null
    expect(data[2][2]).toBe(3);
    expect(data[2][3]).toBe(5);
    expect(data[2][4]).toBe(-2);
    expect(data[2][5]).toBeNull();
    // HAM Saudi: grid=1, fin=20, +/- = -19, Notes=DNF
    expect(data[2][8]).toBe(-19);
    expect(data[2][9]).toBe("DNF");
  });

  it("omits History tab when no history provided", async () => {
    const client = createMockClient();
    await writeReport(client, "Test", [createTestSession()]);

    const historyWrite = client.writtenRanges.find((r) => r.range.includes("History"));
    expect(historyWrite).toBeUndefined();
  });

  it("writes only History tab when sessions are empty but history is provided", async () => {
    const client = createMockClient();
    const history = createTestHistory();
    const fallbackDrivers: Driver[] = [
      { driverNumber: 1, firstName: "Max", lastName: "Verstappen", nameAcronym: "VER", teamName: "Red Bull Racing", teamColour: "3671C6" },
      { driverNumber: 44, firstName: "Lewis", lastName: "Hamilton", nameAcronym: "HAM", teamName: "Ferrari", teamColour: "E80020" },
    ];

    await writeReport(client, "Test", [], history, undefined, undefined, fallbackDrivers);

    const overviewWrite = client.writtenRanges.find((r) => r.range.includes("Overview"));
    expect(overviewWrite).toBeUndefined();

    const stintsWrite = client.writtenRanges.find((r) => r.range.includes("Stints"));
    expect(stintsWrite).toBeUndefined();

    const historyWrite = client.writtenRanges.find((r) => r.range.includes("History"));
    expect(historyWrite).toBeDefined();

    const data = historyWrite!.values;
    expect(data[2][0]).toBe("HAM");
    expect(data[3][0]).toBe("VER");
  });
});

function createTestCombinedDriver(overrides: Partial<CrossSessionDriverFeatures> = {}): CrossSessionDriverFeatures {
  return {
    driverNumber: 1,
    nameAcronym: "VER",
    teamName: "Red Bull Racing",
    teamColour: "3671C6",
    sessionsIncluded: ["Practice 1", "Practice 2"],
    pace: {
      bestLapByCompound: { SOFT: 80.5, MEDIUM: 81.2 },
      longRunAveragePace: 82.0,
      longRunSampleSize: 18,
      bestSector1: 26.1, bestSector2: 27.2, bestSector3: 27.2,
      meanSector1: 26.5, meanSector2: 27.5, meanSector3: 27.8,
    },
    degradation: {
      degradationRateByStint: [
        { stintNumber: 1, compound: "MEDIUM", degradationRate: 0.045, rSquared: 0.85, lapCount: 10 },
        { stintNumber: 2, compound: "HARD", degradationRate: 0.032, rSquared: 0.78, lapCount: 8 },
      ],
      fuelCorrectedLongRunPace: 81.8,
      fuelCorrectedSampleSize: 18,
    },
    speed: {
      bestStSpeed: 315, meanStSpeed: 312, bestI1Speed: 280, meanI1Speed: 277,
      bestI2Speed: 290, meanI2Speed: 287,
    },
    consistency: { longRunLapTimeStdDev: 0.35, consistencySampleSize: 18 },
    confidence: {
      overall: "HIGH" as const,
      longRunPace: { level: "HIGH" as const, sampleSize: 18 },
      fuelCorrectedPace: { level: "HIGH" as const, sampleSize: 18 },
      degradation: { level: "HIGH" as const, sampleSize: 18, meanRSquared: 0.815 },
      consistency: { level: "HIGH" as const, sampleSize: 18 },
    },
    totalLaps: 22,
    rankings: { longRunPace: 1, bestLap: 1, degradationRate: 3, consistency: 2 },
    deltas: {
      longRunPaceDelta: -0.3,
      consistencyDelta: -0.05,
      bestLapDelta: -0.2,
      bestStSpeedDelta: 2.5,
    },
    ...overrides,
  };
}

function createTestCombined(overrides: Partial<CrossSessionFeatures> = {}): CrossSessionFeatures {
  return {
    circuitShortName: "Monza",
    sessionsIncluded: ["Practice 1", "Practice 2"],
    drivers: [createTestCombinedDriver()],
    ...overrides,
  };
}

describe("writeReport with combined", () => {
  it("creates Combined tab when combined data is provided with 2+ sessions", async () => {
    const client = createMockClient();
    const sessions = [createTestSession()];
    const combined = createTestCombined();

    await writeReport(client, "Test", sessions, undefined, combined);

    const combinedWrite = client.writtenRanges.find((r) => r.range.includes("Combined"));
    expect(combinedWrite).toBeDefined();
  });

  it("omits Combined tab when combined data is not provided", async () => {
    const client = createMockClient();
    await writeReport(client, "Test", [createTestSession()]);

    const combinedWrite = client.writtenRanges.find((r) => r.range.includes("Combined"));
    expect(combinedWrite).toBeUndefined();
  });

  it("Combined tab is ordered before History tab", async () => {
    const client = createMockClient();
    const sessions = [createTestSession({
      drivers: [
        createTestDriver({ driverNumber: 1, nameAcronym: "VER" }),
      ],
    })];
    const history: MeetingRaceResult[] = [{
      meetingKey: 100, meetingName: "Test GP", countryName: "Test",
      dateStart: "2024-03-01",
      results: [{ driverNumber: 1, gridPosition: 1, finishPosition: 1, status: "Finished", lapsCompleted: 57 }],
    }];
    const combined = createTestCombined();

    await writeReport(client, "Test", sessions, history, combined);

    const combinedIdx = client.writtenRanges.findIndex((r) => r.range.includes("Combined"));
    const historyIdx = client.writtenRanges.findIndex((r) => r.range.includes("History"));
    expect(combinedIdx).toBeLessThan(historyIdx);
  });
});

describe("buildCombinedData", () => {
  it("produces group header row, column header row, and driver data rows", () => {
    const combined = createTestCombined({
      drivers: [
        createTestCombinedDriver({ driverNumber: 1, nameAcronym: "VER" }),
        createTestCombinedDriver({ driverNumber: 44, nameAcronym: "HAM", teamColour: "E80020" }),
      ],
    });

    const { data, teamColours } = buildCombinedData(combined);

    expect(data).toHaveLength(4);
    expect(data[1][0]).toBe("Driver");
    expect(data[2][0]).toBe("VER");
    expect(data[3][0]).toBe("HAM");
    expect(teamColours).toEqual(["3671C6", "E80020"]);
  });

  it("includes sessions list, total laps, and confidence", () => {
    const { data } = buildCombinedData(createTestCombined());

    const row = data[2];
    expect(row[2]).toBe("Practice 1, Practice 2");
    expect(row[3]).toBe(22);
    expect(row[4]).toBe(18);
    expect(row[5]).toBe("HIGH");
  });

  it("includes delta columns at the end", () => {
    const { data } = buildCombinedData(createTestCombined());

    const row = data[2];
    // Δ LR Pace (col 29): -0.3s as time fraction
    expect(row[29]).toBeTypeOf("number");
    // Δ Consistency (col 30): -0.05
    expect(row[30]).toBe(-0.05);
    // Δ Best Lap (col 31): -0.2s as time fraction
    expect(row[31]).toBeTypeOf("number");
    // Δ Speed (col 32): 2.5
    expect(row[32]).toBe(2.5);
  });

  it("produces null deltas when driver has no deltas", () => {
    const combined = createTestCombined({
      drivers: [createTestCombinedDriver({ deltas: null })],
    });

    const { data } = buildCombinedData(combined);
    const row = data[2];

    expect(row[29]).toBeNull();
    expect(row[30]).toBeNull();
    expect(row[31]).toBeNull();
    expect(row[32]).toBeNull();
  });
});

describe("buildReportSlug", () => {
  it("produces a lowercase underscore-separated slug", () => {
    expect(buildReportSlug("Australia", "Albert Park", 2025))
      .toBe("australia_albert_park_2025_practice_analysis");
  });

  it("normalizes special characters", () => {
    expect(buildReportSlug("São Paulo", "Interlagos", 2025))
      .toBe("s_o_paulo_interlagos_2025_practice_analysis");
  });
});
