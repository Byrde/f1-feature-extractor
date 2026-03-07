# F1 Session Feature Extractor

Extract per-driver KPIs from F1 free practice sessions via the [OpenF1 API](https://openf1.org) and produce a report at multiple resolutions (per-session and aggregated weekend view).

## Setup

```bash
npm install
```

## Usage

```bash
npm run cli [options]
```

| Option | Description |
|---|---|
| `-m, --meeting <name>` | Meeting name to search (e.g. `bahrain`, `monza`). Omit to use the latest race weekend. |
| `-y, --year <number>` | Season year (e.g. `2024`). Defaults to the current year. |
| `-o, --output <format>` | Output format: `sheets`, `csv`, or `json`. Defaults to `sheets`. |
| `-p, --project <id>` | Google Cloud project ID (required for `sheets` output). |
| `--login` | Force re-authentication with Google. |

### Output formats

- **sheets** — writes directly to a Google Sheets spreadsheet (default).
- **csv** — writes one CSV file per session plus a combined weekend file to `./out/`.
- **json** — prints the full feature payload to stdout.

### Examples

```bash
npm run cli                                          # Latest weekend → Google Sheets
npm run cli -- --meeting monza                       # Specific meeting → Google Sheets
npm run cli -- --meeting monza --year 2024           # Historic meeting
npm run cli -- -o json                               # Latest weekend → stdout as JSON
npm run cli -- -o csv --meeting monza                # Monza → CSV files
npm run cli -- --login                               # Re-authenticate with Google
```

The `--` after `npm run cli` is required by npm to forward arguments to the script.
