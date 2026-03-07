#!/usr/bin/env node
import { Command } from "commander";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { homedir } from "node:os";
import chalk from "chalk";
import ora from "ora";
import { createOpenF1Client } from "./infrastructure/openf1-client.js";
import { createSessionFetcher } from "./infrastructure/session-fetcher.js";
import { createSessionResolver } from "./infrastructure/session-resolver.js";
import { createHistoryFetcher } from "./infrastructure/history-fetcher.js";
import { createGoogleSheetsClient } from "./infrastructure/google-sheets-client.js";
import type { SessionResolver } from "./infrastructure/session-resolver.js";
import { assembleSessionFeatures } from "./domain/feature-assembler.js";
import { assembleWeekendFeatures } from "./domain/weekend-assembler.js";
import { writeReport, buildReportSlug } from "./api/sheets-report.js";
import type { SessionMetadata, Session } from "./domain/session.js";
import type { SessionFeatures } from "./domain/features.js";

const ADC_PATH = join(homedir(), ".config", "gcloud", "application_default_credentials.json");
const HISTORY_CACHE_DIR = join(homedir(), ".cache", "f1-report");
const SCOPES = "https://www.googleapis.com/auth/spreadsheets,https://www.googleapis.com/auth/drive.metadata.readonly,https://www.googleapis.com/auth/cloud-platform";

function detectGcloudProject(): string | undefined {
  if (process.env.GOOGLE_CLOUD_PROJECT) return process.env.GOOGLE_CLOUD_PROJECT;
  if (process.env.GCLOUD_PROJECT) return process.env.GCLOUD_PROJECT;

  const result = spawnSync("gcloud", ["config", "get-value", "project"], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  const value = result.stdout?.toString().trim();
  return result.status === 0 && value && value !== "(unset)" ? value : undefined;
}

function resolveProjectId(explicit?: string): string {
  const projectId = explicit ?? detectGcloudProject();
  if (!projectId) {
    throw new Error(
      "Google Cloud project required for Sheets API quota.\n" +
      `  Set via: ${chalk.bold("--project <id>")}, ${chalk.bold("GOOGLE_CLOUD_PROJECT")} env var,\n` +
      `  or ${chalk.bold("gcloud config set project <id>")}`
    );
  }
  return projectId;
}

function hasCredentials(): boolean {
  return !!process.env.GOOGLE_APPLICATION_CREDENTIALS || existsSync(ADC_PATH);
}

function runGcloudAuth(): void {
  const result = spawnSync(
    "gcloud",
    ["auth", "application-default", "login", `--scopes=${SCOPES}`],
    { stdio: ["inherit", "pipe", "pipe"] }
  );

  if (result.status !== 0) {
    const stderr = result.stderr?.toString() ?? "";
    if (stderr.includes("not found") || result.error) {
      throw new Error(
        "gcloud CLI is not installed.\n" +
        `  Install it from: ${chalk.underline("https://cloud.google.com/sdk/docs/install")}`
      );
    }
    throw new Error(`Authentication failed: ${stderr.split("\n")[0]}`);
  }
}

function ensureGoogleAuth(): void {
  if (hasCredentials()) return;

  const spinner = ora("Opening browser for Google authentication...").start();
  try {
    runGcloudAuth();
  } catch (err) {
    spinner.fail("Authentication failed");
    throw err;
  }

  if (!hasCredentials()) {
    spinner.fail("Authentication failed");
    throw new Error("Credentials not found after login. Please try again.");
  }

  spinner.succeed("Authenticated with Google");
}

export async function resolveSessions(
  resolver: SessionResolver,
  meetingName?: string,
  year?: number
): Promise<SessionMetadata[]> {
  if (meetingName) {
    return resolver.resolvePracticeSessions(meetingName, year);
  }
  return resolver.resolveLatestPracticeSessions(year);
}

async function report(meetingName?: string, year?: number, project?: string): Promise<void> {
  ensureGoogleAuth();
  const projectId = resolveProjectId(project);

  const apiClient = createOpenF1Client();
  const fetcher = createSessionFetcher(apiClient);
  const resolver = createSessionResolver(apiClient);
  const sheetsClient = createGoogleSheetsClient(projectId);

  const spinner = ora(
    meetingName
      ? `Resolving sessions for "${meetingName}"...`
      : "Resolving latest practice sessions..."
  ).start();

  const sessions = await resolveSessions(resolver, meetingName, year);
  const meetingLabel = `${sessions[0].countryName} - ${sessions[0].circuitShortName}`;
  const sessionList = sessions.map((s) => `${s.sessionName} (${s.dateStart.split("T")[0]})`).join(", ");
  spinner.succeed(`${meetingLabel}: ${sessionList}`);

  const rawSessions: Session[] = [];
  const results: SessionFeatures[] = [];
  for (const session of sessions) {
    const s = ora(`Fetching ${session.sessionName}...`).start();
    const populated = await fetcher.fetchSession(session.sessionKey);
    rawSessions.push(populated);
    const features = assembleSessionFeatures(populated);
    s.succeed(`${session.sessionName} — ${features.drivers.length} drivers`);
    results.push(features);
  }

  const combined = rawSessions.length >= 2
    ? assembleWeekendFeatures(rawSessions, results)
    : undefined;

  const historyFetcher = createHistoryFetcher(apiClient, HISTORY_CACHE_DIR);
  const historySpinner = ora("Fetching historical race results...").start();
  const resolvedYear = year ?? sessions[0].year;
  const history = await historyFetcher.fetchSeasonHistory(resolvedYear, sessions[0].meetingKey);
  if (history.length > 0) {
    historySpinner.succeed(`Historical results: ${history.length} prior race(s)`);
  } else {
    historySpinner.succeed("No prior races this season (season opener)");
  }

  const writeSpinner = ora("Resolving spreadsheet...").start();
  const title = buildReportSlug(sessions[0].countryName, sessions[0].circuitShortName, sessions[0].year);
  const report = await writeReport(sheetsClient, title, results, history, combined);
  writeSpinner.succeed(report.created ? `Created new sheet: ${title}` : `Updated existing sheet: ${title}`);

  console.log(`\n  ${chalk.green.bold(report.url)}\n`);
}

const program = new Command()
  .name("f1-report")
  .description("Extract F1 practice session features and generate a Google Sheets report")
  .option("-m, --meeting <name>", "meeting name to search (e.g. bahrain, monza)")
  .option("-y, --year <number>", "season year (e.g. 2024). Defaults to current year.", parseInt)
  .option("-p, --project <id>", "Google Cloud project ID for Sheets API quota")
  .option("--login", "force re-authentication with Google")
  .action(async (opts: { meeting?: string; year?: number; project?: string; login?: boolean }) => {
    if (opts.login) {
      const spinner = ora("Opening browser for Google authentication...").start();
      try {
        runGcloudAuth();
        spinner.succeed("Authenticated with Google");
      } catch (err) {
        spinner.fail("Authentication failed");
        throw err;
      }
      if (!opts.meeting) return;
    }
    await report(opts.meeting, opts.year, opts.project);
  });

const isDirectRun = process.argv[1]?.includes("cli");
if (isDirectRun) {
  program.parseAsync().catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${chalk.red("Error:")} ${msg}\n`);
    process.exit(1);
  });
}
