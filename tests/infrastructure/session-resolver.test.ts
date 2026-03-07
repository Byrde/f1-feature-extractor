import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSessionResolver } from "../../src/infrastructure/session-resolver.js";
import type { OpenF1Client } from "../../src/infrastructure/openf1-client.js";
import type { Meeting, SessionMetadata } from "../../src/domain/session.js";

function makeMeeting(overrides: Partial<Meeting> = {}): Meeting {
  return {
    meetingKey: 1229,
    meetingName: "Bahrain Grand Prix",
    countryName: "Bahrain",
    circuitShortName: "Sakhir",
    dateStart: "2024-02-29",
    year: 2024,
    ...overrides,
  };
}

function makeSession(overrides: Partial<SessionMetadata> = {}): SessionMetadata {
  return {
    sessionKey: 9158,
    meetingKey: 1229,
    sessionName: "Practice 1",
    sessionType: "Practice",
    circuitShortName: "Sakhir",
    countryName: "Bahrain",
    dateStart: "2024-02-29T11:30:00+00:00",
    dateEnd: "2024-02-29T12:30:00+00:00",
    year: 2024,
    ...overrides,
  };
}

function createMockClient(
  meetings: Meeting[],
  sessions: SessionMetadata[]
): OpenF1Client {
  return {
    queryMeetings: vi.fn().mockResolvedValue(meetings),
    querySessions: vi.fn().mockResolvedValue(sessions),
    fetchSession: vi.fn(),
    fetchDrivers: vi.fn(),
    fetchLaps: vi.fn(),
    fetchStints: vi.fn(),
    fetchPitStops: vi.fn(),
    fetchWeather: vi.fn(),
  };
}

describe("SessionResolver", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-03-15"));
  });

  describe("resolvePracticeSessions", () => {
    it("matches meeting by country name case-insensitively", async () => {
      const fp1 = makeSession({ sessionKey: 9158, sessionName: "Practice 1" });
      const fp2 = makeSession({ sessionKey: 9159, sessionName: "Practice 2" });
      const client = createMockClient([makeMeeting()], [fp1, fp2]);
      const resolver = createSessionResolver(client);

      const result = await resolver.resolvePracticeSessions("bahrain");

      expect(result).toEqual([fp1, fp2]);
      expect(client.querySessions).toHaveBeenCalledWith({ meetingKey: 1229 });
    });

    it("throws when no meeting matches", async () => {
      const client = createMockClient([makeMeeting()], []);
      const resolver = createSessionResolver(client);

      await expect(resolver.resolvePracticeSessions("silverstone")).rejects.toThrow(
        /No meeting matching "silverstone"/
      );
    });

    it("excludes practice sessions that have not started yet", async () => {
      const fp1 = makeSession({
        sessionKey: 9158,
        sessionName: "Practice 1",
        dateStart: "2024-03-14T11:30:00+00:00",
      });
      const fp2 = makeSession({
        sessionKey: 9159,
        sessionName: "Practice 2",
        dateStart: "2024-03-14T15:00:00+00:00",
      });
      const fp3 = makeSession({
        sessionKey: 9160,
        sessionName: "Practice 3",
        dateStart: "2024-03-15T11:30:00+00:00",
      });
      const client = createMockClient([makeMeeting()], [fp1, fp2, fp3]);
      const resolver = createSessionResolver(client);

      const result = await resolver.resolvePracticeSessions("bahrain");

      expect(result).toEqual([fp1, fp2]);
    });

    it("throws when multiple meetings match", async () => {
      const meetings = [
        makeMeeting({ meetingKey: 1, meetingName: "Grand Prix of Italy" }),
        makeMeeting({ meetingKey: 2, meetingName: "Grand Prix of Italy Emilia" }),
      ];
      const client = createMockClient(meetings, []);
      const resolver = createSessionResolver(client);

      await expect(resolver.resolvePracticeSessions("italy")).rejects.toThrow(
        /Ambiguous meeting name "italy" matched 2 meetings/
      );
    });

    it("queries the specified year when provided", async () => {
      const fp1 = makeSession({ sessionKey: 9158, sessionName: "Practice 1", year: 2023 });
      const client = createMockClient(
        [makeMeeting({ year: 2023, dateStart: "2023-03-05" })],
        [fp1]
      );
      const resolver = createSessionResolver(client);

      await resolver.resolvePracticeSessions("bahrain", 2023);

      expect(client.queryMeetings).toHaveBeenCalledWith({ year: 2023 });
    });
  });

  describe("resolveLatestPracticeSessions", () => {
    it("selects latest past meeting and returns its practice sessions", async () => {
      const oldMeeting = makeMeeting({ meetingKey: 1228, dateStart: "2024-01-15" });
      const currentMeeting = makeMeeting({ meetingKey: 1229, dateStart: "2024-03-01" });
      const futureMeeting = makeMeeting({ meetingKey: 1230, dateStart: "2024-04-01" });

      const fp1 = makeSession({ sessionKey: 9158, sessionName: "Practice 1" });
      const client = createMockClient(
        [oldMeeting, currentMeeting, futureMeeting],
        [fp1]
      );
      const resolver = createSessionResolver(client);

      const result = await resolver.resolveLatestPracticeSessions();

      expect(result).toEqual([fp1]);
      expect(client.querySessions).toHaveBeenCalledWith({ meetingKey: 1229 });
    });

    it("throws when no meetings exist for the year", async () => {
      const client = createMockClient([], []);
      const resolver = createSessionResolver(client);

      await expect(resolver.resolveLatestPracticeSessions()).rejects.toThrow(
        /No meetings found for 2024/
      );
    });

    it("queries the specified year when provided", async () => {
      const fp1 = makeSession({ sessionKey: 9158, sessionName: "Practice 1", year: 2023 });
      const client = createMockClient(
        [makeMeeting({ year: 2023, dateStart: "2023-03-05" })],
        [fp1]
      );
      const resolver = createSessionResolver(client);

      await resolver.resolveLatestPracticeSessions(2023);

      expect(client.queryMeetings).toHaveBeenCalledWith({ year: 2023 });
    });
  });
});
