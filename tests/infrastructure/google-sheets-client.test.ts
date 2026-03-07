import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn();
const mockGet = vi.fn();
const mockValuesUpdate = vi.fn();
const mockBatchUpdate = vi.fn();
const mockFilesList = vi.fn();

vi.mock("googleapis", () => ({
  google: {
    auth: { GoogleAuth: vi.fn() },
    sheets: vi.fn(() => ({
      spreadsheets: {
        create: mockCreate,
        get: mockGet,
        values: { update: mockValuesUpdate },
        batchUpdate: mockBatchUpdate,
      },
    })),
    drive: vi.fn(() => ({
      files: { list: mockFilesList },
    })),
  },
}));

import { createGoogleSheetsClient } from "../../src/infrastructure/google-sheets-client.js";

describe("GoogleSheetsClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a spreadsheet and returns ref with sheet IDs", async () => {
    mockCreate.mockResolvedValue({
      data: {
        spreadsheetId: "abc123",
        sheets: [
          { properties: { title: "Overview", sheetId: 0 } },
          { properties: { title: "Stints", sheetId: 1 } },
        ],
      },
    });

    const client = createGoogleSheetsClient();
    const ref = await client.createSpreadsheet("Test Report", ["Overview", "Stints"]);

    expect(ref.spreadsheetId).toBe("abc123");
    expect(ref.url).toBe("https://docs.google.com/spreadsheets/d/abc123");
    expect(ref.sheetIds.get("Overview")).toBe(0);
    expect(ref.sheetIds.get("Stints")).toBe(1);
  });

  it("finds an existing spreadsheet by title", async () => {
    mockFilesList.mockResolvedValue({
      data: { files: [{ id: "found-id" }] },
    });
    mockGet.mockResolvedValue({
      data: {
        spreadsheetId: "found-id",
        sheets: [{ properties: { title: "Overview", sheetId: 0 } }],
      },
    });

    const client = createGoogleSheetsClient();
    const ref = await client.findSpreadsheet("some_report_title");

    expect(ref).not.toBeNull();
    expect(ref!.spreadsheetId).toBe("found-id");
    expect(mockFilesList).toHaveBeenCalledWith(
      expect.objectContaining({
        q: expect.stringContaining("some_report_title"),
      })
    );
  });

  it("returns null when no spreadsheet matches the title", async () => {
    mockFilesList.mockResolvedValue({ data: { files: [] } });

    const client = createGoogleSheetsClient();
    const ref = await client.findSpreadsheet("nonexistent");

    expect(ref).toBeNull();
  });

  it("gets spreadsheet metadata by ID", async () => {
    mockGet.mockResolvedValue({
      data: {
        spreadsheetId: "abc123",
        sheets: [
          { properties: { title: "Overview", sheetId: 0 } },
          { properties: { title: "Notes", sheetId: 5 } },
        ],
      },
    });

    const client = createGoogleSheetsClient();
    const ref = await client.getSpreadsheet("abc123");

    expect(ref.spreadsheetId).toBe("abc123");
    expect(ref.sheetIds.get("Overview")).toBe(0);
    expect(ref.sheetIds.get("Notes")).toBe(5);
  });

  it("deletes a sheet by ID", async () => {
    mockBatchUpdate.mockResolvedValue({});
    const client = createGoogleSheetsClient();

    await client.deleteSheet("abc123", 7);

    expect(mockBatchUpdate).toHaveBeenCalledWith({
      spreadsheetId: "abc123",
      requestBody: {
        requests: [{ deleteSheet: { sheetId: 7 } }],
      },
    });
  });

  it("adds a sheet and returns its new sheetId", async () => {
    mockBatchUpdate.mockResolvedValue({
      data: {
        replies: [{ addSheet: { properties: { sheetId: 42 } } }],
      },
    });

    const client = createGoogleSheetsClient();
    const sheetId = await client.addSheet("abc123", "Stints");

    expect(sheetId).toBe(42);
    expect(mockBatchUpdate).toHaveBeenCalledWith({
      spreadsheetId: "abc123",
      requestBody: {
        requests: [{ addSheet: { properties: { title: "Stints" } } }],
      },
    });
  });

  it("writes values to a range", async () => {
    mockValuesUpdate.mockResolvedValue({});
    const client = createGoogleSheetsClient();

    await client.writeValues("abc123", "Overview!A1", [
      ["Driver", "Team"],
      ["VER", "Red Bull"],
    ]);

    expect(mockValuesUpdate).toHaveBeenCalledWith({
      spreadsheetId: "abc123",
      range: "Overview!A1",
      valueInputOption: "RAW",
      requestBody: {
        values: [["Driver", "Team"], ["VER", "Red Bull"]],
      },
    });
  });

  it("skips batchFormat when requests array is empty", async () => {
    const client = createGoogleSheetsClient();
    await client.batchFormat("abc123", []);
    expect(mockBatchUpdate).not.toHaveBeenCalled();
  });
});
