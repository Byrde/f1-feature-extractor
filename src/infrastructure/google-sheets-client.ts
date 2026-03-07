import { google, type sheets_v4 } from "googleapis";

export type CellValue = string | number | boolean | null;

export interface SpreadsheetRef {
  readonly spreadsheetId: string;
  readonly url: string;
  readonly sheetIds: ReadonlyMap<string, number>;
}

export interface GoogleSheetsClient {
  createSpreadsheet(
    title: string,
    sheetTitles: string[]
  ): Promise<SpreadsheetRef>;

  findSpreadsheet(title: string): Promise<SpreadsheetRef | null>;

  getSpreadsheet(spreadsheetId: string): Promise<SpreadsheetRef>;

  deleteSheet(spreadsheetId: string, sheetId: number): Promise<void>;

  addSheet(spreadsheetId: string, title: string): Promise<number>;

  writeValues(
    spreadsheetId: string,
    range: string,
    values: CellValue[][]
  ): Promise<void>;

  batchFormat(
    spreadsheetId: string,
    requests: sheets_v4.Schema$Request[]
  ): Promise<void>;
}

function parseSheetIds(sheets: sheets_v4.Schema$Sheet[] | undefined): Map<string, number> {
  const sheetIds = new Map<string, number>();
  for (const sheet of sheets ?? []) {
    const props = sheet.properties;
    if (props?.title && props.sheetId != null) {
      sheetIds.set(props.title, props.sheetId);
    }
  }
  return sheetIds;
}

function toRef(spreadsheetId: string, sheets: sheets_v4.Schema$Sheet[] | undefined): SpreadsheetRef {
  return {
    spreadsheetId,
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
    sheetIds: parseSheetIds(sheets),
  };
}

export function createGoogleSheetsClient(projectId?: string): GoogleSheetsClient {
  const projectHeaders = projectId ? { "x-goog-user-project": projectId } : {};

  const auth = new google.auth.GoogleAuth({
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.metadata.readonly",
    ],
  });

  const sheets = google.sheets({
    version: "v4",
    auth,
    ...(projectId && { headers: projectHeaders }),
  });

  const drive = google.drive({
    version: "v3",
    auth,
    ...(projectId && { headers: projectHeaders }),
  });

  return {
    async createSpreadsheet(
      title: string,
      sheetTitles: string[]
    ): Promise<SpreadsheetRef> {
      const response = await sheets.spreadsheets.create({
        requestBody: {
          properties: { title },
          sheets: sheetTitles.map((name) => ({
            properties: { title: name },
          })),
        },
      });

      return toRef(response.data.spreadsheetId!, response.data.sheets);
    },

    async findSpreadsheet(title: string): Promise<SpreadsheetRef | null> {
      const response = await drive.files.list({
        q: `name = '${title.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`,
        fields: "files(id)",
        orderBy: "modifiedTime desc",
        pageSize: 1,
      });

      const file = response.data.files?.[0];
      if (!file?.id) return null;

      return this.getSpreadsheet(file.id);
    },

    async getSpreadsheet(spreadsheetId: string): Promise<SpreadsheetRef> {
      const response = await sheets.spreadsheets.get({
        spreadsheetId,
        fields: "spreadsheetId,sheets.properties(sheetId,title)",
      });

      return toRef(response.data.spreadsheetId!, response.data.sheets);
    },

    async deleteSheet(spreadsheetId: string, sheetId: number): Promise<void> {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{ deleteSheet: { sheetId } }],
        },
      });
    },

    async addSheet(spreadsheetId: string, title: string): Promise<number> {
      const response = await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title } } }],
        },
      });

      return response.data.replies![0].addSheet!.properties!.sheetId!;
    },

    async writeValues(
      spreadsheetId: string,
      range: string,
      values: CellValue[][]
    ): Promise<void> {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: "RAW",
        requestBody: { values },
      });
    },

    async batchFormat(
      spreadsheetId: string,
      requests: sheets_v4.Schema$Request[]
    ): Promise<void> {
      if (requests.length === 0) return;
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests },
      });
    },
  };
}
