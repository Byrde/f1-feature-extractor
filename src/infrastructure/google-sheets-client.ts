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
    sheetTitles: string[],
    parentFolderId?: string
  ): Promise<SpreadsheetRef>;

  findSpreadsheet(title: string, parentFolderId?: string): Promise<SpreadsheetRef | null>;

  getSpreadsheet(spreadsheetId: string): Promise<SpreadsheetRef>;

  resolveFolderPath(path: string): Promise<string>;

  deleteSheet(spreadsheetId: string, sheetId: number): Promise<void>;

  renameSheet(spreadsheetId: string, sheetId: number, newTitle: string): Promise<void>;

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
      "https://www.googleapis.com/auth/drive",
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
      sheetTitles: string[],
      parentFolderId?: string
    ): Promise<SpreadsheetRef> {
      const response = await sheets.spreadsheets.create({
        requestBody: {
          properties: { title },
          sheets: sheetTitles.map((name) => ({
            properties: { title: name },
          })),
        },
      });

      const spreadsheetId = response.data.spreadsheetId!;

      if (parentFolderId) {
        const file = await drive.files.get({
          fileId: spreadsheetId,
          fields: "parents",
        });
        const previousParents = (file.data.parents ?? []).join(",");
        await drive.files.update({
          fileId: spreadsheetId,
          addParents: parentFolderId,
          removeParents: previousParents,
        });
      }

      return toRef(spreadsheetId, response.data.sheets);
    },

    async findSpreadsheet(title: string, parentFolderId?: string): Promise<SpreadsheetRef | null> {
      let q = `name = '${title.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`;
      if (parentFolderId) {
        q += ` and '${parentFolderId}' in parents`;
      }

      const response = await drive.files.list({
        q,
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

    async resolveFolderPath(path: string): Promise<string> {
      const segments = path.split("/").filter(Boolean);
      if (segments.length === 0) throw new Error("Drive path must contain at least one folder name");

      let parentId = "root";
      for (const segment of segments) {
        const escapedName = segment.replace(/'/g, "\\'");
        const response = await drive.files.list({
          q: `name = '${escapedName}' and mimeType = 'application/vnd.google-apps.folder' and '${parentId}' in parents and trashed = false`,
          fields: "files(id)",
          pageSize: 1,
        });

        const existing = response.data.files?.[0];
        if (existing?.id) {
          parentId = existing.id;
        } else {
          const created = await drive.files.create({
            requestBody: {
              name: segment,
              mimeType: "application/vnd.google-apps.folder",
              parents: [parentId],
            },
            fields: "id",
          });
          parentId = created.data.id!;
        }
      }

      return parentId;
    },

    async deleteSheet(spreadsheetId: string, sheetId: number): Promise<void> {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{ deleteSheet: { sheetId } }],
        },
      });
    },

    async renameSheet(spreadsheetId: string, sheetId: number, newTitle: string): Promise<void> {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{
            updateSheetProperties: {
              properties: { sheetId, title: newTitle },
              fields: "title",
            },
          }],
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
