import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { OpenF1Client } from "./openf1-client.js";
import type { Meeting, SessionMetadata, SessionResult } from "../domain/session.js";
import type { DriverRaceResult, MeetingRaceResult, RaceStatus } from "../domain/history.js";

export interface HistoryFetcher {
  fetchSeasonHistory(
    year: number,
    currentMeetingKey: number,
  ): Promise<MeetingRaceResult[]>;
}

// --- Cache ---

type CacheData = Record<string, MeetingRaceResult>;

function cachePath(cacheDir: string, year: number): string {
  return join(cacheDir, `history-${year}.json`);
}

function loadCache(cacheDir: string, year: number): CacheData {
  try {
    return JSON.parse(readFileSync(cachePath(cacheDir, year), "utf-8"));
  } catch {
    return {};
  }
}

function saveCache(cacheDir: string, year: number, data: CacheData): void {
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(cachePath(cacheDir, year), JSON.stringify(data, null, 2));
}

// --- Assembly ---

function deriveStatus(result: SessionResult): RaceStatus {
  if (result.dsq) return "DSQ";
  if (result.dns) return "DNS";
  if (result.dnf) return "DNF";
  return "Finished";
}

function assembleResults(
  qualiResults: readonly SessionResult[],
  raceResults: readonly SessionResult[],
): DriverRaceResult[] {
  const gridMap = new Map(qualiResults.map((q) => [q.driverNumber, q.position]));

  return raceResults.map((r) => ({
    driverNumber: r.driverNumber,
    gridPosition: gridMap.get(r.driverNumber) ?? null,
    finishPosition: r.position,
    status: deriveStatus(r),
    lapsCompleted: r.numberOfLaps,
  }));
}

export function createHistoryFetcher(
  client: OpenF1Client,
  cacheDir?: string,
): HistoryFetcher {
  return {
    async fetchSeasonHistory(
      year: number,
      currentMeetingKey: number,
    ): Promise<MeetingRaceResult[]> {
      const meetings = await client.queryMeetings({ year });

      const currentMeeting = meetings.find((m) => m.meetingKey === currentMeetingKey);
      if (!currentMeeting) return [];

      const priorMeetings = meetings
        .filter((m) => new Date(m.dateStart) < new Date(currentMeeting.dateStart))
        .sort((a, b) => new Date(a.dateStart).getTime() - new Date(b.dateStart).getTime());

      if (priorMeetings.length === 0) return [];

      const cache = cacheDir ? loadCache(cacheDir, year) : {};
      const history: MeetingRaceResult[] = [];
      let cacheUpdated = false;

      for (const meeting of priorMeetings) {
        const cached = cache[meeting.meetingKey];
        if (cached) {
          history.push(cached);
          continue;
        }

        const result = await fetchMeetingResult(client, meeting);
        if (result) {
          history.push(result);
          cache[meeting.meetingKey] = result;
          cacheUpdated = true;
        }
      }

      if (cacheDir && cacheUpdated) {
        saveCache(cacheDir, year, cache);
      }

      return history;
    },
  };
}

function findSession(
  sessions: readonly SessionMetadata[],
  name: string,
): SessionMetadata | undefined {
  return sessions.find((s) => s.sessionName === name);
}

async function fetchMeetingResult(
  client: OpenF1Client,
  meeting: Meeting,
): Promise<MeetingRaceResult | null> {
  try {
    const sessions = await client.querySessions({
      meetingKey: meeting.meetingKey,
    });

    const raceSession = findSession(sessions, "Race");
    if (!raceSession) return null;

    const qualiSession = findSession(sessions, "Qualifying");

    const [qualiResults, raceResults] = await Promise.all([
      qualiSession
        ? client.fetchSessionResult(qualiSession.sessionKey)
        : Promise.resolve([] as SessionResult[]),
      client.fetchSessionResult(raceSession.sessionKey),
    ]);

    if (raceResults.length === 0) return null;

    return {
      meetingKey: meeting.meetingKey,
      meetingName: meeting.meetingName,
      countryName: meeting.countryName,
      dateStart: meeting.dateStart,
      results: assembleResults(qualiResults, raceResults),
    };
  } catch {
    return null;
  }
}
