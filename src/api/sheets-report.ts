import type { sheets_v4 } from "googleapis";
import type { SessionFeatures, DriverFeatures, StintSummary, CrossSessionFeatures, CrossSessionDriverFeatures } from "../domain/features.js";
import type { MeetingRaceResult, DriverRaceResult } from "../domain/history.js";
import type { Driver } from "../domain/session.js";
import type { GoogleSheetsClient, CellValue } from "../infrastructure/google-sheets-client.js";
import { formatLapTime } from "./format.js";

const OVERVIEW_TAB = "Overview";
const STINTS_TAB = "Stints";
const COMBINED_TAB = "Combined";
const HISTORY_TAB = "History";
const BASE_TABS = [OVERVIEW_TAB, STINTS_TAB] as const;

export function buildReportSlug(countryName: string, circuitShortName: string, year: number): string {
  return `${countryName}_${circuitShortName}_${year}_practice_analysis`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

// --- Colors (RGB 0-1) ---

const HEADER_BG = { red: 0.082, green: 0.082, blue: 0.118 }; // #15151E
const GROUP_HEADER_BG = { red: 0.176, green: 0.176, blue: 0.247 }; // #2D2D3F
const HEADER_TEXT = { red: 1, green: 1, blue: 1 };
const ALT_ROW_BG = { red: 0.96, green: 0.96, blue: 0.973 }; // #F5F5F8
const RANK_GREEN = { red: 0.133, green: 0.773, blue: 0.369 }; // #22C55E
const RANK_RED = { red: 0.937, green: 0.267, blue: 0.267 }; // #EF4444
const RANK_YELLOW = { red: 1, green: 0.843, blue: 0.263 }; // #FFD742

function hexToColor(hex: string): { red: number; green: number; blue: number } {
  const h = hex.replace("#", "");
  return {
    red: parseInt(h.substring(0, 2), 16) / 255,
    green: parseInt(h.substring(2, 4), 16) / 255,
    blue: parseInt(h.substring(4, 6), 16) / 255,
  };
}

function lapTimeValue(seconds: number | null): CellValue {
  if (seconds === null) return null;
  return seconds / 86400;
}

// --- Overview tab ---

const OVERVIEW_GROUPS = [
  { label: "", cols: 6 },
  { label: "Pace", cols: 5 },
  { label: "Degradation", cols: 2 },
  { label: "Sectors", cols: 6 },
  { label: "Speed", cols: 6 },
  { label: "Rankings", cols: 4 },
];

const OVERVIEW_HEADERS = [
  "Session", "Driver", "Team", "Laps", "LR Laps", "Confidence",
  "Best SOFT", "Best MED", "Best HARD", "LR Pace", "Fuel-Corr LR (est.)",
  "Deg Rate (est.)", "Consistency σ",
  "Best S1", "Best S2", "Best S3", "Mean S1", "Mean S2", "Mean S3",
  "Best ST", "Mean ST", "Best I1", "Mean I1", "Best I2", "Mean I2",
  "Rank: Pace", "Rank: Best", "Rank: Deg", "Rank: Consist",
];

function meanDegradation(driver: DriverFeatures): number | null {
  const rates = driver.degradation.degradationRateByStint;
  if (rates.length === 0) return null;
  return rates.reduce((sum, r) => sum + r.degradationRate, 0) / rates.length;
}

function overviewRow(session: SessionFeatures, driver: DriverFeatures): CellValue[] {
  const deg = meanDegradation(driver);
  return [
    session.sessionName,
    driver.nameAcronym,
    driver.teamName,
    driver.totalLaps,
    driver.pace.longRunSampleSize || null,
    driver.confidence.overall,
    lapTimeValue(driver.pace.bestLapByCompound.SOFT ?? null),
    lapTimeValue(driver.pace.bestLapByCompound.MEDIUM ?? null),
    lapTimeValue(driver.pace.bestLapByCompound.HARD ?? null),
    lapTimeValue(driver.pace.longRunAveragePace),
    lapTimeValue(driver.degradation.fuelCorrectedLongRunPace),
    deg !== null ? Math.round(deg * 1000) / 1000 : null,
    driver.consistency.longRunLapTimeStdDev !== null
      ? Math.round(driver.consistency.longRunLapTimeStdDev * 1000) / 1000
      : null,
    lapTimeValue(driver.pace.bestSector1),
    lapTimeValue(driver.pace.bestSector2),
    lapTimeValue(driver.pace.bestSector3),
    lapTimeValue(driver.pace.meanSector1),
    lapTimeValue(driver.pace.meanSector2),
    lapTimeValue(driver.pace.meanSector3),
    driver.speed.bestStSpeed, driver.speed.meanStSpeed,
    driver.speed.bestI1Speed, driver.speed.meanI1Speed,
    driver.speed.bestI2Speed, driver.speed.meanI2Speed,
    driver.rankings.longRunPace, driver.rankings.bestLap,
    driver.rankings.degradationRate, driver.rankings.consistency,
  ];
}

// --- Stints tab ---

const STINTS_HEADERS = [
  "Session", "Driver", "Team", "Stint #", "Compound", "Tyre Age",
  "Laps", "Best Lap", "Mean Lap", "Deg Rate (est.)", "R²",
  "Track Temp", "Air Temp", "Humidity", "Rainfall", "Wind",
];

function findStintRSquared(driver: DriverFeatures, stintNumber: number): number | null {
  const match = driver.degradation.degradationRateByStint.find(
    (d) => d.stintNumber === stintNumber
  );
  return match?.rSquared ?? null;
}

function stintRow(
  sessionName: string,
  driver: DriverFeatures,
  stint: StintSummary
): CellValue[] {
  const rSquared = findStintRSquared(driver, stint.stintNumber);
  return [
    sessionName,
    driver.nameAcronym,
    driver.teamName,
    stint.stintNumber,
    stint.compound,
    stint.lapCount,
    stint.lapCount,
    lapTimeValue(stint.bestLap),
    lapTimeValue(stint.meanLap),
    stint.degradationRate !== null ? Math.round(stint.degradationRate * 1000) / 1000 : null,
    rSquared !== null ? Math.round(rSquared * 1000) / 1000 : null,
    stint.weather?.meanTrackTemperature ?? null,
    stint.weather?.meanAirTemperature ?? null,
    stint.weather?.meanHumidity ?? null,
    stint.weather ? (stint.weather.rainfall ? "Yes" : "No") : null,
    stint.weather?.meanWindSpeed ?? null,
  ];
}

// --- Formatting helpers ---

function gridRange(sheetId: number, startRow: number, endRow: number, startCol: number, endCol: number): sheets_v4.Schema$GridRange {
  return { sheetId, startRowIndex: startRow, endRowIndex: endRow, startColumnIndex: startCol, endColumnIndex: endCol };
}

function cellFormat(bg: { red: number; green: number; blue: number }, textColor?: { red: number; green: number; blue: number }, bold = false, hAlign?: string): sheets_v4.Schema$CellFormat {
  const fmt: sheets_v4.Schema$CellFormat = {
    backgroundColor: { ...bg },
    textFormat: { bold, ...(textColor ? { foregroundColor: { ...textColor } } : {}) },
  };
  if (hAlign) fmt.horizontalAlignment = hAlign;
  return fmt;
}

function repeatCellRequest(range: sheets_v4.Schema$GridRange, format: sheets_v4.Schema$CellFormat, fields: string): sheets_v4.Schema$Request {
  return { repeatCell: { range, cell: { userEnteredFormat: format }, fields } };
}

function mergeCellsRequest(range: sheets_v4.Schema$GridRange): sheets_v4.Schema$Request {
  return { mergeCells: { range, mergeType: "MERGE_ALL" } };
}

function buildOverviewFormatting(
  sheetId: number,
  sessions: readonly SessionFeatures[],
  totalCols: number
): sheets_v4.Schema$Request[] {
  const requests: sheets_v4.Schema$Request[] = [];
  const totalDataRows = sessions.reduce((sum, s) => sum + s.drivers.length, 0);
  const dataEndRow = 2 + totalDataRows;

  // Group header row (row 0)
  requests.push(repeatCellRequest(
    gridRange(sheetId, 0, 1, 0, totalCols),
    cellFormat(GROUP_HEADER_BG, HEADER_TEXT, true, "CENTER"),
    "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)"
  ));

  // Merge group header cells
  let colOffset = 0;
  for (const group of OVERVIEW_GROUPS) {
    if (group.cols > 1 && group.label) {
      requests.push(mergeCellsRequest(gridRange(sheetId, 0, 1, colOffset, colOffset + group.cols)));
    }
    colOffset += group.cols;
  }

  // Column header row (row 1)
  requests.push(repeatCellRequest(
    gridRange(sheetId, 1, 2, 0, totalCols),
    cellFormat(HEADER_BG, HEADER_TEXT, true, "CENTER"),
    "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)"
  ));

  // Freeze 2 header rows + 3 identity columns
  requests.push({
    updateSheetProperties: {
      properties: { sheetId, gridProperties: { frozenRowCount: 2, frozenColumnCount: 3 } },
      fields: "gridProperties.frozenRowCount,gridProperties.frozenColumnCount",
    },
  });

  // Alternating row colors on data
  let rowIdx = 2;
  for (const session of sessions) {
    for (let i = 0; i < session.drivers.length; i++) {
      if (i % 2 === 1) {
        requests.push(repeatCellRequest(
          gridRange(sheetId, rowIdx, rowIdx + 1, 0, totalCols),
          cellFormat(ALT_ROW_BG),
          "userEnteredFormat(backgroundColor)"
        ));
      }
      rowIdx++;
    }
  }

  // Team color left border on each data row
  rowIdx = 2;
  for (const session of sessions) {
    for (const driver of session.drivers) {
      const teamColor = hexToColor(driver.teamColour || "888888");
      requests.push(repeatCellRequest(
        gridRange(sheetId, rowIdx, rowIdx + 1, 0, 1),
        { borders: { left: { style: "SOLID_THICK", color: { ...teamColor } } } },
        "userEnteredFormat(borders)"
      ));
      rowIdx++;
    }
  }

  // Lap time format (m:ss.000) for time columns (+2 offset vs original)
  const lapTimeCols = [6, 7, 8, 9, 10, 13, 14, 15, 16, 17, 18];
  for (const col of lapTimeCols) {
    requests.push(repeatCellRequest(
      gridRange(sheetId, 2, dataEndRow, col, col + 1),
      { numberFormat: { type: "TIME", pattern: "m:ss.000" } },
      "userEnteredFormat(numberFormat)"
    ));
  }

  // Decimal format for deg rate and consistency (cols 11, 12)
  for (const col of [11, 12]) {
    requests.push(repeatCellRequest(
      gridRange(sheetId, 2, dataEndRow, col, col + 1),
      { numberFormat: { type: "NUMBER", pattern: "0.000" } },
      "userEnteredFormat(numberFormat)"
    ));
  }

  // Speed columns: 1 decimal (cols 19-24)
  for (let col = 19; col <= 24; col++) {
    requests.push(repeatCellRequest(
      gridRange(sheetId, 2, dataEndRow, col, col + 1),
      { numberFormat: { type: "NUMBER", pattern: "0.0" } },
      "userEnteredFormat(numberFormat)"
    ));
  }

  // Rank columns: conditional formatting (green→yellow→red gradient) (cols 25-28)
  for (let col = 25; col <= 28; col++) {
    requests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [gridRange(sheetId, 2, dataEndRow, col, col + 1)],
          gradientRule: {
            minpoint: { color: { ...RANK_GREEN }, type: "MIN" },
            midpoint: { color: { ...RANK_YELLOW }, type: "PERCENTILE", value: "50" },
            maxpoint: { color: { ...RANK_RED }, type: "MAX" },
          },
        },
        index: 0,
      },
    });
  }

  // Confidence column: conditional formatting (text-based)
  const confidenceCol = 5;
  for (const { text, color } of [
    { text: "HIGH", color: RANK_GREEN },
    { text: "MEDIUM", color: RANK_YELLOW },
    { text: "LOW", color: RANK_YELLOW },
    { text: "INSUFFICIENT", color: RANK_RED },
  ]) {
    requests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [gridRange(sheetId, 2, dataEndRow, confidenceCol, confidenceCol + 1)],
          booleanRule: {
            condition: { type: "TEXT_EQ", values: [{ userEnteredValue: text }] },
            format: { backgroundColor: { ...color } },
          },
        },
        index: 0,
      },
    });
  }

  // Column widths
  const widths: [number, number][] = [
    [0, 80], [1, 60], [2, 140], [3, 50], [4, 60], [5, 95],
    ...lapTimeCols.map((c) => [c, 90] as [number, number]),
    [11, 75], [12, 90],
    ...[19, 20, 21, 22, 23, 24].map((c) => [c, 70] as [number, number]),
    [25, 80], [26, 80], [27, 70], [28, 90],
  ];
  for (const [col, px] of widths) {
    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: col, endIndex: col + 1 },
        properties: { pixelSize: px },
        fields: "pixelSize",
      },
    });
  }

  return requests;
}

function buildStintsFormatting(
  sheetId: number,
  stintRows: { teamColour: string }[],
  totalCols: number
): sheets_v4.Schema$Request[] {
  const requests: sheets_v4.Schema$Request[] = [];
  const dataEndRow = 1 + stintRows.length;

  // Header row
  requests.push(repeatCellRequest(
    gridRange(sheetId, 0, 1, 0, totalCols),
    cellFormat(HEADER_BG, HEADER_TEXT, true, "CENTER"),
    "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)"
  ));

  // Freeze header row + 3 identity columns
  requests.push({
    updateSheetProperties: {
      properties: { sheetId, gridProperties: { frozenRowCount: 1, frozenColumnCount: 3 } },
      fields: "gridProperties.frozenRowCount,gridProperties.frozenColumnCount",
    },
  });

  for (let i = 0; i < stintRows.length; i++) {
    const row = i + 1;
    const { teamColour } = stintRows[i];

    if (i % 2 === 1) {
      requests.push(repeatCellRequest(
        gridRange(sheetId, row, row + 1, 0, totalCols),
        cellFormat(ALT_ROW_BG),
        "userEnteredFormat(backgroundColor)"
      ));
    }

    const tc = hexToColor(teamColour || "888888");
    requests.push(repeatCellRequest(
      gridRange(sheetId, row, row + 1, 0, 1),
      { borders: { left: { style: "SOLID_THICK", color: { ...tc } } } },
      "userEnteredFormat(borders)"
    ));
  }

  // Lap time format for Best Lap and Mean Lap (cols 7, 8)
  for (const col of [7, 8]) {
    requests.push(repeatCellRequest(
      gridRange(sheetId, 1, dataEndRow, col, col + 1),
      { numberFormat: { type: "TIME", pattern: "m:ss.000" } },
      "userEnteredFormat(numberFormat)"
    ));
  }

  // Deg rate and R²: 3 decimals (cols 9, 10)
  for (const col of [9, 10]) {
    requests.push(repeatCellRequest(
      gridRange(sheetId, 1, dataEndRow, col, col + 1),
      { numberFormat: { type: "NUMBER", pattern: "0.000" } },
      "userEnteredFormat(numberFormat)"
    ));
  }

  // Weather: 1 decimal (cols 11, 12, 13, 15)
  for (const col of [11, 12, 13, 15]) {
    requests.push(repeatCellRequest(
      gridRange(sheetId, 1, dataEndRow, col, col + 1),
      { numberFormat: { type: "NUMBER", pattern: "0.0" } },
      "userEnteredFormat(numberFormat)"
    ));
  }

  // Column widths
  const widths: [number, number][] = [
    [0, 80], [1, 60], [2, 140], [3, 60], [4, 85],
    [5, 70], [6, 50], [7, 90], [8, 90], [9, 75], [10, 55],
    [11, 80], [12, 70], [13, 75], [14, 65], [15, 60],
  ];
  for (const [col, px] of widths) {
    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: col, endIndex: col + 1 },
        properties: { pixelSize: px },
        fields: "pixelSize",
      },
    });
  }

  return requests;
}

// --- Combined tab ---

const COMBINED_GROUPS = [
  { label: "", cols: 6 },
  { label: "Pace", cols: 5 },
  { label: "Degradation", cols: 2 },
  { label: "Sectors", cols: 6 },
  { label: "Speed", cols: 6 },
  { label: "Rankings", cols: 4 },
  { label: "Deltas", cols: 4 },
];

const COMBINED_HEADERS = [
  "Driver", "Team", "Sessions", "Laps", "LR Laps", "Confidence",
  "Best SOFT", "Best MED", "Best HARD", "LR Pace", "Fuel-Corr LR (est.)",
  "Deg Rate (est.)", "Consistency σ",
  "Best S1", "Best S2", "Best S3", "Mean S1", "Mean S2", "Mean S3",
  "Best ST", "Mean ST", "Best I1", "Mean I1", "Best I2", "Mean I2",
  "Rank: Pace", "Rank: Best", "Rank: Deg", "Rank: Consist",
  "Δ LR Pace", "Δ Consistency", "Δ Best Lap", "Δ Speed",
];

function combinedMeanDeg(driver: CrossSessionDriverFeatures): number | null {
  const rates = driver.degradation.degradationRateByStint;
  if (rates.length === 0) return null;
  return rates.reduce((sum, r) => sum + r.degradationRate, 0) / rates.length;
}

function combinedRow(driver: CrossSessionDriverFeatures): CellValue[] {
  const deg = combinedMeanDeg(driver);
  return [
    driver.nameAcronym,
    driver.teamName,
    driver.sessionsIncluded.join(", "),
    driver.totalLaps,
    driver.pace.longRunSampleSize || null,
    driver.confidence.overall,
    lapTimeValue(driver.pace.bestLapByCompound.SOFT ?? null),
    lapTimeValue(driver.pace.bestLapByCompound.MEDIUM ?? null),
    lapTimeValue(driver.pace.bestLapByCompound.HARD ?? null),
    lapTimeValue(driver.pace.longRunAveragePace),
    lapTimeValue(driver.degradation.fuelCorrectedLongRunPace),
    deg !== null ? Math.round(deg * 1000) / 1000 : null,
    driver.consistency.longRunLapTimeStdDev !== null
      ? Math.round(driver.consistency.longRunLapTimeStdDev * 1000) / 1000
      : null,
    lapTimeValue(driver.pace.bestSector1),
    lapTimeValue(driver.pace.bestSector2),
    lapTimeValue(driver.pace.bestSector3),
    lapTimeValue(driver.pace.meanSector1),
    lapTimeValue(driver.pace.meanSector2),
    lapTimeValue(driver.pace.meanSector3),
    driver.speed.bestStSpeed, driver.speed.meanStSpeed,
    driver.speed.bestI1Speed, driver.speed.meanI1Speed,
    driver.speed.bestI2Speed, driver.speed.meanI2Speed,
    driver.rankings.longRunPace, driver.rankings.bestLap,
    driver.rankings.degradationRate, driver.rankings.consistency,
    driver.deltas ? lapTimeValue(driver.deltas.longRunPaceDelta) : null,
    driver.deltas?.consistencyDelta !== undefined && driver.deltas.consistencyDelta !== null
      ? Math.round(driver.deltas.consistencyDelta * 1000) / 1000
      : null,
    driver.deltas ? lapTimeValue(driver.deltas.bestLapDelta) : null,
    driver.deltas?.bestStSpeedDelta !== undefined && driver.deltas.bestStSpeedDelta !== null
      ? Math.round(driver.deltas.bestStSpeedDelta * 10) / 10
      : null,
  ];
}

export function buildCombinedData(
  combined: CrossSessionFeatures,
): { data: CellValue[][]; teamColours: string[] } {
  const groupHeaderRow: CellValue[] = [];
  for (const g of COMBINED_GROUPS) {
    groupHeaderRow.push(g.label);
    for (let i = 1; i < g.cols; i++) groupHeaderRow.push(null);
  }

  const data: CellValue[][] = [groupHeaderRow, COMBINED_HEADERS];
  const teamColours: string[] = [];

  for (const driver of combined.drivers) {
    data.push(combinedRow(driver));
    teamColours.push(driver.teamColour);
  }

  return { data, teamColours };
}

function buildCombinedFormatting(
  sheetId: number,
  driverCount: number,
  teamColours: string[],
  totalCols: number,
): sheets_v4.Schema$Request[] {
  const requests: sheets_v4.Schema$Request[] = [];
  const dataEndRow = 2 + driverCount;

  // Group header row (row 0)
  requests.push(repeatCellRequest(
    gridRange(sheetId, 0, 1, 0, totalCols),
    cellFormat(GROUP_HEADER_BG, HEADER_TEXT, true, "CENTER"),
    "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)"
  ));

  // Merge group header cells
  let colOffset = 0;
  for (const group of COMBINED_GROUPS) {
    if (group.cols > 1 && group.label) {
      requests.push(mergeCellsRequest(gridRange(sheetId, 0, 1, colOffset, colOffset + group.cols)));
    }
    colOffset += group.cols;
  }

  // Column header row (row 1)
  requests.push(repeatCellRequest(
    gridRange(sheetId, 1, 2, 0, totalCols),
    cellFormat(HEADER_BG, HEADER_TEXT, true, "CENTER"),
    "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)"
  ));

  // Freeze 2 header rows + 2 identity columns
  requests.push({
    updateSheetProperties: {
      properties: { sheetId, gridProperties: { frozenRowCount: 2, frozenColumnCount: 2 } },
      fields: "gridProperties.frozenRowCount,gridProperties.frozenColumnCount",
    },
  });

  // Alternating rows + team colour borders
  for (let i = 0; i < driverCount; i++) {
    const row = i + 2;
    if (i % 2 === 1) {
      requests.push(repeatCellRequest(
        gridRange(sheetId, row, row + 1, 0, totalCols),
        cellFormat(ALT_ROW_BG),
        "userEnteredFormat(backgroundColor)"
      ));
    }
    const tc = hexToColor(teamColours[i] || "888888");
    requests.push(repeatCellRequest(
      gridRange(sheetId, row, row + 1, 0, 1),
      { borders: { left: { style: "SOLID_THICK", color: { ...tc } } } },
      "userEnteredFormat(borders)"
    ));
  }

  // Lap time columns (m:ss.000)
  const lapTimeCols = [6, 7, 8, 9, 10, 13, 14, 15, 16, 17, 18];
  for (const col of lapTimeCols) {
    requests.push(repeatCellRequest(
      gridRange(sheetId, 2, dataEndRow, col, col + 1),
      { numberFormat: { type: "TIME", pattern: "m:ss.000" } },
      "userEnteredFormat(numberFormat)"
    ));
  }

  // Decimal format for deg rate and consistency (cols 11, 12)
  for (const col of [11, 12]) {
    requests.push(repeatCellRequest(
      gridRange(sheetId, 2, dataEndRow, col, col + 1),
      { numberFormat: { type: "NUMBER", pattern: "0.000" } },
      "userEnteredFormat(numberFormat)"
    ));
  }

  // Speed columns: 1 decimal (cols 19-24)
  for (let col = 19; col <= 24; col++) {
    requests.push(repeatCellRequest(
      gridRange(sheetId, 2, dataEndRow, col, col + 1),
      { numberFormat: { type: "NUMBER", pattern: "0.0" } },
      "userEnteredFormat(numberFormat)"
    ));
  }

  // Rank columns: gradient (cols 25-28)
  for (let col = 25; col <= 28; col++) {
    requests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [gridRange(sheetId, 2, dataEndRow, col, col + 1)],
          gradientRule: {
            minpoint: { color: { ...RANK_GREEN }, type: "MIN" },
            midpoint: { color: { ...RANK_YELLOW }, type: "PERCENTILE", value: "50" },
            maxpoint: { color: { ...RANK_RED }, type: "MAX" },
          },
        },
        index: 0,
      },
    });
  }

  // Confidence column: conditional formatting (col 5)
  const confidenceCol = 5;
  for (const { text, color } of [
    { text: "HIGH", color: RANK_GREEN },
    { text: "MEDIUM", color: RANK_YELLOW },
    { text: "LOW", color: RANK_YELLOW },
    { text: "INSUFFICIENT", color: RANK_RED },
  ]) {
    requests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [gridRange(sheetId, 2, dataEndRow, confidenceCol, confidenceCol + 1)],
          booleanRule: {
            condition: { type: "TEXT_EQ", values: [{ userEnteredValue: text }] },
            format: { backgroundColor: { ...color } },
          },
        },
        index: 0,
      },
    });
  }

  // Delta columns: Δ LR Pace (29), Δ Consistency (30), Δ Best Lap (31) — negative = improved
  for (const col of [29, 30, 31]) {
    const range = gridRange(sheetId, 2, dataEndRow, col, col + 1);
    requests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [range],
          booleanRule: {
            condition: { type: "NUMBER_LESS", values: [{ userEnteredValue: "0" }] },
            format: { textFormat: { foregroundColor: { ...RANK_GREEN } }, backgroundColor: { red: 0.878, green: 0.957, blue: 0.894 } },
          },
        },
        index: 0,
      },
    });
    requests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [range],
          booleanRule: {
            condition: { type: "NUMBER_GREATER", values: [{ userEnteredValue: "0" }] },
            format: { textFormat: { foregroundColor: { ...RANK_RED } }, backgroundColor: { red: 0.992, green: 0.886, blue: 0.886 } },
          },
        },
        index: 0,
      },
    });
  }

  // Delta column: Δ Speed (32) — positive = improved (opposite direction)
  const speedDeltaCol = 32;
  const speedDeltaRange = gridRange(sheetId, 2, dataEndRow, speedDeltaCol, speedDeltaCol + 1);
  requests.push({
    addConditionalFormatRule: {
      rule: {
        ranges: [speedDeltaRange],
        booleanRule: {
          condition: { type: "NUMBER_GREATER", values: [{ userEnteredValue: "0" }] },
          format: { textFormat: { foregroundColor: { ...RANK_GREEN } }, backgroundColor: { red: 0.878, green: 0.957, blue: 0.894 } },
        },
      },
      index: 0,
    },
  });
  requests.push({
    addConditionalFormatRule: {
      rule: {
        ranges: [speedDeltaRange],
        booleanRule: {
          condition: { type: "NUMBER_LESS", values: [{ userEnteredValue: "0" }] },
          format: { textFormat: { foregroundColor: { ...RANK_RED } }, backgroundColor: { red: 0.992, green: 0.886, blue: 0.886 } },
        },
      },
      index: 0,
    },
  });

  // Lap time delta format (cols 29, 31)
  for (const col of [29, 31]) {
    requests.push(repeatCellRequest(
      gridRange(sheetId, 2, dataEndRow, col, col + 1),
      { numberFormat: { type: "TIME", pattern: "m:ss.000" } },
      "userEnteredFormat(numberFormat)"
    ));
  }

  // Decimal delta format: Δ Consistency (col 30)
  requests.push(repeatCellRequest(
    gridRange(sheetId, 2, dataEndRow, 30, 31),
    { numberFormat: { type: "NUMBER", pattern: "+0.000;-0.000;0.000" } },
    "userEnteredFormat(numberFormat)"
  ));

  // Decimal delta format: Δ Speed (col 32)
  requests.push(repeatCellRequest(
    gridRange(sheetId, 2, dataEndRow, 32, 33),
    { numberFormat: { type: "NUMBER", pattern: "+0.0;-0.0;0.0" } },
    "userEnteredFormat(numberFormat)"
  ));

  // Column widths
  const widths: [number, number][] = [
    [0, 60], [1, 140], [2, 120], [3, 50], [4, 60], [5, 95],
    ...lapTimeCols.map((c) => [c, 90] as [number, number]),
    [11, 75], [12, 90],
    ...[19, 20, 21, 22, 23, 24].map((c) => [c, 70] as [number, number]),
    [25, 80], [26, 80], [27, 70], [28, 90],
    [29, 85], [30, 85], [31, 85], [32, 70],
  ];
  for (const [col, px] of widths) {
    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: col, endIndex: col + 1 },
        properties: { pixelSize: px },
        fields: "pixelSize",
      },
    });
  }

  return requests;
}

// --- History tab ---

const HISTORY_FIXED_COLS = ["Driver", "Team"];
const HISTORY_MEETING_COLS = ["Grid", "Fin", "+/-", "Notes"];
const COLS_PER_MEETING = HISTORY_MEETING_COLS.length;

interface DriverInfo {
  nameAcronym: string;
  teamName: string;
  teamColour: string;
}

function buildDriverMap(
  sessions: readonly SessionFeatures[],
  fallbackDrivers?: readonly Driver[],
): Map<number, DriverInfo> {
  const map = new Map<number, DriverInfo>();
  for (const session of sessions) {
    for (const driver of session.drivers) {
      if (!map.has(driver.driverNumber)) {
        map.set(driver.driverNumber, {
          nameAcronym: driver.nameAcronym,
          teamName: driver.teamName,
          teamColour: driver.teamColour,
        });
      }
    }
  }
  if (fallbackDrivers) {
    for (const d of fallbackDrivers) {
      if (!map.has(d.driverNumber)) {
        map.set(d.driverNumber, {
          nameAcronym: d.nameAcronym,
          teamName: d.teamName,
          teamColour: d.teamColour,
        });
      }
    }
  }
  return map;
}

function collectSortedDriverNumbers(
  history: readonly MeetingRaceResult[],
  driverMap: Map<number, DriverInfo>,
): number[] {
  const allNumbers = new Set<number>();
  for (const meeting of history) {
    for (const r of meeting.results) allNumbers.add(r.driverNumber);
  }

  return [...allNumbers].sort((a, b) => {
    const da = driverMap.get(a);
    const db = driverMap.get(b);
    const teamA = da?.teamName ?? "ZZZ";
    const teamB = db?.teamName ?? "ZZZ";
    if (teamA !== teamB) return teamA.localeCompare(teamB);
    return (da?.nameAcronym ?? String(a)).localeCompare(db?.nameAcronym ?? String(b));
  });
}

function meetingLabel(meeting: MeetingRaceResult): string {
  return meeting.countryName;
}

function positionDelta(grid: number | null, finish: number | null): number | null {
  if (grid === null || finish === null) return null;
  return grid - finish;
}

function statusNote(status: string): string | null {
  return status === "Finished" ? null : status;
}

function buildHistoryData(
  history: readonly MeetingRaceResult[],
  sessions: readonly SessionFeatures[],
  fallbackDrivers?: readonly Driver[],
): { data: CellValue[][]; driverColours: string[]; totalCols: number } {
  const driverMap = buildDriverMap(sessions, fallbackDrivers);
  const sortedDrivers = collectSortedDriverNumbers(history, driverMap);

  const totalCols = HISTORY_FIXED_COLS.length + history.length * COLS_PER_MEETING;

  const groupRow: CellValue[] = ["", ""];
  for (const meeting of history) {
    groupRow.push(meetingLabel(meeting));
    for (let i = 1; i < COLS_PER_MEETING; i++) groupRow.push(null);
  }

  const headerRow: CellValue[] = [...HISTORY_FIXED_COLS];
  for (let i = 0; i < history.length; i++) {
    headerRow.push(...HISTORY_MEETING_COLS);
  }

  const resultLookups = history.map((meeting) => {
    const map = new Map<number, DriverRaceResult>();
    for (const r of meeting.results) map.set(r.driverNumber, r);
    return map;
  });

  const dataRows: CellValue[][] = [];
  const driverColours: string[] = [];

  for (const driverNum of sortedDrivers) {
    const info = driverMap.get(driverNum);
    const row: CellValue[] = [
      info?.nameAcronym ?? String(driverNum),
      info?.teamName ?? "",
    ];

    for (const lookup of resultLookups) {
      const result = lookup.get(driverNum);
      if (result) {
        row.push(
          result.gridPosition,
          result.finishPosition,
          positionDelta(result.gridPosition, result.finishPosition),
          statusNote(result.status),
        );
      } else {
        row.push(null, null, null, null);
      }
    }

    dataRows.push(row);
    driverColours.push(info?.teamColour ?? "888888");
  }

  return {
    data: [groupRow, headerRow, ...dataRows],
    driverColours,
    totalCols,
  };
}

function buildHistoryFormatting(
  sheetId: number,
  history: readonly MeetingRaceResult[],
  driverColours: string[],
  totalCols: number,
): sheets_v4.Schema$Request[] {
  const requests: sheets_v4.Schema$Request[] = [];
  const dataEndRow = 2 + driverColours.length;

  // Group header row
  requests.push(repeatCellRequest(
    gridRange(sheetId, 0, 1, 0, totalCols),
    cellFormat(GROUP_HEADER_BG, HEADER_TEXT, true, "CENTER"),
    "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)"
  ));

  // Merge meeting group header cells
  for (let i = 0; i < history.length; i++) {
    const startCol = HISTORY_FIXED_COLS.length + i * COLS_PER_MEETING;
    requests.push(mergeCellsRequest(gridRange(sheetId, 0, 1, startCol, startCol + COLS_PER_MEETING)));
  }

  // Column header row
  requests.push(repeatCellRequest(
    gridRange(sheetId, 1, 2, 0, totalCols),
    cellFormat(HEADER_BG, HEADER_TEXT, true, "CENTER"),
    "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)"
  ));

  // Freeze 2 header rows + 2 identity columns
  requests.push({
    updateSheetProperties: {
      properties: { sheetId, gridProperties: { frozenRowCount: 2, frozenColumnCount: 2 } },
      fields: "gridProperties.frozenRowCount,gridProperties.frozenColumnCount",
    },
  });

  // Alternating rows + team colour borders
  for (let i = 0; i < driverColours.length; i++) {
    const row = i + 2;
    if (i % 2 === 1) {
      requests.push(repeatCellRequest(
        gridRange(sheetId, row, row + 1, 0, totalCols),
        cellFormat(ALT_ROW_BG),
        "userEnteredFormat(backgroundColor)"
      ));
    }
    const tc = hexToColor(driverColours[i]);
    requests.push(repeatCellRequest(
      gridRange(sheetId, row, row + 1, 0, 1),
      { borders: { left: { style: "SOLID_THICK", color: { ...tc } } } },
      "userEnteredFormat(borders)"
    ));
  }

  // Conditional formatting on +/- columns (green for gained, red for lost)
  for (let i = 0; i < history.length; i++) {
    const deltaCol = HISTORY_FIXED_COLS.length + i * COLS_PER_MEETING + 2;
    const range = gridRange(sheetId, 2, dataEndRow, deltaCol, deltaCol + 1);

    requests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [range],
          booleanRule: {
            condition: { type: "NUMBER_GREATER", values: [{ userEnteredValue: "0" }] },
            format: { textFormat: { foregroundColor: { ...RANK_GREEN } }, backgroundColor: { red: 0.878, green: 0.957, blue: 0.894 } },
          },
        },
        index: 0,
      },
    });

    requests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [range],
          booleanRule: {
            condition: { type: "NUMBER_LESS", values: [{ userEnteredValue: "0" }] },
            format: { textFormat: { foregroundColor: { ...RANK_RED } }, backgroundColor: { red: 0.992, green: 0.886, blue: 0.886 } },
          },
        },
        index: 0,
      },
    });

    // Red highlight for DNF/DNS/DSQ in Notes column
    const notesCol = HISTORY_FIXED_COLS.length + i * COLS_PER_MEETING + 3;
    const notesRange = gridRange(sheetId, 2, dataEndRow, notesCol, notesCol + 1);
    for (const text of ["DNF", "DNS", "DSQ"]) {
      requests.push({
        addConditionalFormatRule: {
          rule: {
            ranges: [notesRange],
            booleanRule: {
              condition: { type: "TEXT_EQ", values: [{ userEnteredValue: text }] },
              format: { backgroundColor: { red: 0.992, green: 0.886, blue: 0.886 }, textFormat: { foregroundColor: { ...RANK_RED }, bold: true } },
            },
          },
          index: 0,
        },
      });
    }
  }

  // Column widths
  const widths: [number, number][] = [[0, 60], [1, 140]];
  for (let i = 0; i < history.length; i++) {
    const base = HISTORY_FIXED_COLS.length + i * COLS_PER_MEETING;
    widths.push([base, 45], [base + 1, 40], [base + 2, 40], [base + 3, 45]);
  }
  for (const [col, px] of widths) {
    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: col, endIndex: col + 1 },
        properties: { pixelSize: px },
        fields: "pixelSize",
      },
    });
  }

  return requests;
}

// --- Public API ---

export interface ReportResult {
  readonly url: string;
  readonly created: boolean;
}

async function resolveSpreadsheet(
  client: GoogleSheetsClient,
  title: string,
  managedTabs: readonly string[],
  folderId?: string,
): Promise<{ spreadsheetId: string; url: string; sheetIds: Map<string, number>; created: boolean }> {
  const existing = await client.findSpreadsheet(title, folderId);
  if (!existing) {
    const created = await client.createSpreadsheet(title, [...managedTabs], folderId);
    return {
      spreadsheetId: created.spreadsheetId,
      url: created.url,
      sheetIds: new Map(created.sheetIds),
      created: true,
    };
  }

  const sheetIds = new Map(existing.sheetIds);
  const staleIds: number[] = [];

  for (const tab of managedTabs) {
    const existingId = sheetIds.get(tab);
    if (existingId != null) {
      await client.renameSheet(existing.spreadsheetId, existingId, `__${tab}`);
      staleIds.push(existingId);
      sheetIds.delete(tab);
    }
    const newId = await client.addSheet(existing.spreadsheetId, tab);
    sheetIds.set(tab, newId);
  }

  for (const id of staleIds) {
    await client.deleteSheet(existing.spreadsheetId, id);
  }

  return { spreadsheetId: existing.spreadsheetId, url: existing.url, sheetIds, created: false };
}

export async function writeReport(
  client: GoogleSheetsClient,
  title: string,
  sessions: readonly SessionFeatures[],
  history?: readonly MeetingRaceResult[],
  combined?: CrossSessionFeatures,
  folderId?: string,
  fallbackDrivers?: readonly Driver[],
): Promise<ReportResult> {
  const hasSessions = sessions.length > 0;
  const hasHistory = history !== undefined && history.length > 0;
  const hasCombined = combined !== undefined && combined.drivers.length > 0;

  const managedTabs: string[] = [];
  if (hasSessions) managedTabs.push(...BASE_TABS);
  if (hasCombined) managedTabs.push(COMBINED_TAB);
  if (hasHistory) managedTabs.push(HISTORY_TAB);

  const { spreadsheetId, url, sheetIds, created } = await resolveSpreadsheet(client, title, managedTabs, folderId);

  const formatRequests: sheets_v4.Schema$Request[] = [];

  if (hasSessions) {
    // Build Overview data
    const groupHeaderRow: CellValue[] = [];
    for (const g of OVERVIEW_GROUPS) {
      groupHeaderRow.push(g.label);
      for (let i = 1; i < g.cols; i++) groupHeaderRow.push(null);
    }

    const overviewData: CellValue[][] = [groupHeaderRow, OVERVIEW_HEADERS];
    for (const session of sessions) {
      for (const driver of session.drivers) {
        overviewData.push(overviewRow(session, driver));
      }
    }

    // Build Stints data
    const stintsData: CellValue[][] = [STINTS_HEADERS];
    const stintMeta: { teamColour: string }[] = [];
    for (const session of sessions) {
      for (const driver of session.drivers) {
        for (const stint of driver.stints) {
          stintsData.push(stintRow(session.sessionName, driver, stint));
          stintMeta.push({ teamColour: driver.teamColour });
        }
      }
    }

    await client.writeValues(spreadsheetId, `'${OVERVIEW_TAB}'!A1`, overviewData);
    await client.writeValues(spreadsheetId, `'${STINTS_TAB}'!A1`, stintsData);

    const overviewSheetId = sheetIds.get(OVERVIEW_TAB)!;
    const stintsSheetId = sheetIds.get(STINTS_TAB)!;

    formatRequests.push(
      ...buildOverviewFormatting(overviewSheetId, sessions, OVERVIEW_HEADERS.length),
      ...buildStintsFormatting(stintsSheetId, stintMeta, STINTS_HEADERS.length),
    );
  }

  // Build and write Combined tab
  if (hasCombined) {
    const { data: combinedData, teamColours } = buildCombinedData(combined);
    await client.writeValues(spreadsheetId, `'${COMBINED_TAB}'!A1`, combinedData);

    const combinedSheetId = sheetIds.get(COMBINED_TAB)!;
    formatRequests.push(...buildCombinedFormatting(
      combinedSheetId,
      combined.drivers.length,
      teamColours,
      COMBINED_HEADERS.length,
    ));
  }

  // Build and write History tab
  if (hasHistory) {
    const { data: historyData, driverColours, totalCols } = buildHistoryData(history, sessions, fallbackDrivers);
    await client.writeValues(spreadsheetId, `'${HISTORY_TAB}'!A1`, historyData);

    const historySheetId = sheetIds.get(HISTORY_TAB)!;
    formatRequests.push(...buildHistoryFormatting(historySheetId, history, driverColours, totalCols));
  }

  if (formatRequests.length > 0) {
    await client.batchFormat(spreadsheetId, formatRequests);
  }

  return { url, created };
}
