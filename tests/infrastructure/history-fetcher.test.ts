import { describe, it, expect, vi, afterEach } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHistoryFetcher } from "../../src/infrastructure/history-fetcher.js";
import type { OpenF1Client } from "../../src/infrastructure/openf1-client.js";
import type { Meeting, SessionMetadata, SessionResult } from "../../src/domain/session.js";

function makeMeeting(key: number, name: string, dateStart: string): Meeting {
  return { meetingKey: key, meetingName: name, countryName: name, circuitShortName: name, dateStart, year: 2024 };
}

function makeSession(key: number, meetingKey: number, name: string, type: string): SessionMetadata {
  return {
    sessionKey: key, meetingKey, sessionName: name, sessionType: type,
    circuitShortName: "", countryName: "", dateStart: "", dateEnd: "", year: 2024,
  };
}

function makeResult(driverNumber: number, position: number, overrides?: Partial<SessionResult>): SessionResult {
  return {
    driverNumber, position, dnf: false, dns: false, dsq: false,
    numberOfLaps: 57, gapToLeader: 0, ...overrides,
  };
}

describe("HistoryFetcher", () => {
  function createMockClient(
    meetings: Meeting[],
    sessionsMap: Map<number, SessionMetadata[]>,
    resultMap: Map<number, SessionResult[]>,
  ): OpenF1Client {
    return {
      queryMeetings: vi.fn().mockResolvedValue(meetings),
      querySessions: vi.fn().mockImplementation(({ meetingKey }: { meetingKey: number }) =>
        Promise.resolve(sessionsMap.get(meetingKey) ?? [])
      ),
      fetchSessionResult: vi.fn().mockImplementation((sk: number) =>
        Promise.resolve(resultMap.get(sk) ?? [])
      ),
      fetchStartingGrid: vi.fn().mockResolvedValue([]),
      fetchSession: vi.fn(),
      fetchDrivers: vi.fn(),
      fetchDriversByMeeting: vi.fn(),
      fetchLaps: vi.fn(),
      fetchStints: vi.fn(),
      fetchPitStops: vi.fn(),
      fetchWeather: vi.fn(),
    };
  }

  it("returns prior meetings with grid positions from qualifying results", async () => {
    const meetings = [
      makeMeeting(100, "Bahrain", "2024-03-01"),
      makeMeeting(200, "Saudi Arabia", "2024-03-15"),
      makeMeeting(300, "Australia", "2024-03-29"),
    ];

    const sessionsMap = new Map([
      [100, [makeSession(1000, 100, "Qualifying", "Qualifying"), makeSession(1001, 100, "Race", "Race")]],
      [200, [makeSession(2000, 200, "Qualifying", "Qualifying"), makeSession(2001, 200, "Race", "Race")]],
    ]);

    const resultMap = new Map([
      [1000, [makeResult(1, 1), makeResult(44, 3)]],
      [1001, [makeResult(1, 1), makeResult(44, 4)]],
      [2000, [makeResult(1, 2), makeResult(44, 1)]],
      [2001, [makeResult(1, 1), makeResult(44, 2, { dnf: true, numberOfLaps: 23 })]],
    ]);

    const client = createMockClient(meetings, sessionsMap, resultMap);
    const fetcher = createHistoryFetcher(client);
    const history = await fetcher.fetchSeasonHistory(2024, 300);

    expect(history).toHaveLength(2);
    expect(history[0].meetingName).toBe("Bahrain");
    expect(history[1].meetingName).toBe("Saudi Arabia");

    expect(history[0].results).toEqual([
      { driverNumber: 1, gridPosition: 1, finishPosition: 1, status: "Finished", lapsCompleted: 57 },
      { driverNumber: 44, gridPosition: 3, finishPosition: 4, status: "Finished", lapsCompleted: 57 },
    ]);

    expect(history[1].results[1]).toEqual({
      driverNumber: 44, gridPosition: 1, finishPosition: 2, status: "DNF", lapsCompleted: 23,
    });
  });

  it("returns null grid positions when qualifying session is missing", async () => {
    const meetings = [
      makeMeeting(100, "Bahrain", "2024-03-01"),
      makeMeeting(200, "Current", "2024-03-15"),
    ];

    const sessionsMap = new Map([
      [100, [makeSession(1001, 100, "Race", "Race")]],
    ]);

    const resultMap = new Map([
      [1001, [makeResult(1, 1)]],
    ]);

    const client = createMockClient(meetings, sessionsMap, resultMap);
    const fetcher = createHistoryFetcher(client);
    const history = await fetcher.fetchSeasonHistory(2024, 200);

    expect(history).toHaveLength(1);
    expect(history[0].results[0].gridPosition).toBeNull();
  });

  it("returns empty array for season opener", async () => {
    const meetings = [makeMeeting(100, "Bahrain", "2024-03-01")];
    const client = createMockClient(meetings, new Map(), new Map());
    const fetcher = createHistoryFetcher(client);

    const history = await fetcher.fetchSeasonHistory(2024, 100);
    expect(history).toEqual([]);
  });

  it("skips meetings without a Race session", async () => {
    const meetings = [
      makeMeeting(100, "Testing", "2024-02-01"),
      makeMeeting(200, "Bahrain", "2024-03-01"),
    ];

    const sessionsMap = new Map<number, SessionMetadata[]>([
      [100, []],
    ]);

    const client = createMockClient(meetings, sessionsMap, new Map());
    const fetcher = createHistoryFetcher(client);
    const history = await fetcher.fetchSeasonHistory(2024, 200);

    expect(history).toEqual([]);
  });

  describe("caching", () => {
    let cacheDir: string;

    afterEach(() => {
      rmSync(cacheDir, { recursive: true, force: true });
    });

    function setupCacheTest() {
      cacheDir = mkdtempSync(join(tmpdir(), "f1-history-test-"));

      const meetings = [
        makeMeeting(100, "Bahrain", "2024-03-01"),
        makeMeeting(200, "Saudi Arabia", "2024-03-15"),
        makeMeeting(300, "Australia", "2024-03-29"),
      ];

      const sessionsMap = new Map([
        [100, [makeSession(1000, 100, "Qualifying", "Qualifying"), makeSession(1001, 100, "Race", "Race")]],
        [200, [makeSession(2000, 200, "Qualifying", "Qualifying"), makeSession(2001, 200, "Race", "Race")]],
      ]);

      const resultMap = new Map([
        [1000, [makeResult(1, 1)]],
        [1001, [makeResult(1, 1)]],
        [2000, [makeResult(1, 2)]],
        [2001, [makeResult(1, 2)]],
      ]);

      return { meetings, sessionsMap, resultMap };
    }

    it("writes cache file after fetching", async () => {
      const { meetings, sessionsMap, resultMap } = setupCacheTest();
      const client = createMockClient(meetings, sessionsMap, resultMap);
      const fetcher = createHistoryFetcher(client, cacheDir);

      await fetcher.fetchSeasonHistory(2024, 300);

      const cached = JSON.parse(readFileSync(join(cacheDir, "history-2024.json"), "utf-8"));
      expect(cached["100"]).toBeDefined();
      expect(cached["200"]).toBeDefined();
      expect(cached["100"].meetingName).toBe("Bahrain");
    });

    it("uses cached data and skips API calls for cached meetings", async () => {
      const { meetings, sessionsMap, resultMap } = setupCacheTest();

      mkdirSync(cacheDir, { recursive: true });
      writeFileSync(join(cacheDir, "history-2024.json"), JSON.stringify({
        "100": {
          meetingKey: 100, meetingName: "Bahrain", countryName: "Bahrain",
          dateStart: "2024-03-01",
          results: [{ driverNumber: 1, gridPosition: 1, finishPosition: 1, status: "Finished", lapsCompleted: 57 }],
        },
      }));

      const client = createMockClient(meetings, sessionsMap, resultMap);
      const fetcher = createHistoryFetcher(client, cacheDir);

      const history = await fetcher.fetchSeasonHistory(2024, 300);

      expect(history).toHaveLength(2);
      expect(history[0].meetingName).toBe("Bahrain");
      expect(history[0].results[0].lapsCompleted).toBe(57);

      const querySessionsCalls = (client.querySessions as ReturnType<typeof vi.fn>).mock.calls;
      const fetchedMeetingKeys = querySessionsCalls.map((c: [{meetingKey: number}]) => c[0].meetingKey);
      expect(fetchedMeetingKeys).not.toContain(100);
      expect(fetchedMeetingKeys).toContain(200);
    });
  });
});
