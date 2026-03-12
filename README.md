# F1 Feature Extractor

[![npm](https://img.shields.io/npm/v/@byrde/f1-feature-extractor)](https://www.npmjs.com/package/@byrde/f1-feature-extractor)
[![license](https://img.shields.io/npm/l/@byrde/f1-feature-extractor)](./LICENSE)

Extract per-driver KPIs from F1 free practice sessions via the [OpenF1 API](https://openf1.org) and produce a report at multiple resolutions (per-session and aggregated weekend view).

## Usage

```bash
npx @byrde/f1-feature-extractor [options]
```

| Option | Description |
|---|---|
| `-m, --meeting <name>` | Meeting name to search (e.g. `bahrain`, `monza`). Omit to use the latest race weekend. |
| `-y, --year <number>` | Season year (e.g. `2024`). Defaults to the current year. |
| `-o, --output <format>` | Output format: `sheets`, `csv`, or `json`. Defaults to `sheets`. |
| `-p, --project <id>` | Google Cloud project ID (required for `sheets` output). |
| `-d, --drive-path <path>` | Google Drive folder path for the report (e.g. `F1/Reports/2024`). Missing folders are created automatically. Omit to place the spreadsheet in your Drive root. |
| `--login` | Force re-authentication with Google. |

### Output formats

- **sheets** — writes directly to a Google Sheets spreadsheet (default).
- **csv** — writes one CSV file per session plus a combined weekend file to `./out/`.
- **json** — prints the full feature payload to stdout.
