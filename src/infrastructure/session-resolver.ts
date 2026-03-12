import type { Meeting, SessionMetadata } from "../domain/session.js";
import type { OpenF1Client } from "./openf1-client.js";

export interface SessionResolver {
  resolveLatestMeeting(year?: number): Promise<Meeting>;
  resolveMeeting(name: string, year?: number): Promise<Meeting>;
  fetchPracticeSessions(meetingKey: number): Promise<SessionMetadata[]>;
  resolveLatestPracticeSessions(year?: number): Promise<SessionMetadata[]>;
  resolvePracticeSessions(name: string, year?: number): Promise<SessionMetadata[]>;
}

function fuzzyMatchMeeting(meeting: Meeting, query: string): boolean {
  const q = query.toLowerCase();
  return (
    meeting.countryName.toLowerCase().includes(q) ||
    meeting.circuitShortName.toLowerCase().includes(q) ||
    meeting.meetingName.toLowerCase().includes(q)
  );
}

const RACE_WEEKEND_MS = 3 * 24 * 60 * 60 * 1000;

function findLatestMeeting(meetings: Meeting[]): Meeting {
  const now = new Date();
  const sorted = [...meetings].sort(
    (a, b) => new Date(a.dateStart).getTime() - new Date(b.dateStart).getTime()
  );

  const pastIndex = sorted.findLastIndex((m) => new Date(m.dateStart) <= now);

  if (pastIndex === -1) return sorted[0];

  const elapsed = now.getTime() - new Date(sorted[pastIndex].dateStart).getTime();
  if (elapsed > RACE_WEEKEND_MS && pastIndex + 1 < sorted.length) {
    return sorted[pastIndex + 1];
  }

  return sorted[pastIndex];
}

async function fetchStartedPracticeSessions(
  client: OpenF1Client,
  meetingKey: number
): Promise<SessionMetadata[]> {
  const now = new Date();
  const sessions = await client.querySessions({ meetingKey });
  return sessions
    .filter(
      (s) =>
        s.sessionName.toLowerCase().includes("practice") &&
        new Date(s.dateStart) <= now
    )
    .sort(
      (a, b) => new Date(a.dateStart).getTime() - new Date(b.dateStart).getTime()
    );
}

async function resolveMatchedMeeting(
  client: OpenF1Client,
  name: string,
  year?: number,
): Promise<Meeting> {
  const resolvedYear = year ?? new Date().getFullYear();
  const meetings = await client.queryMeetings({ year: resolvedYear });
  const matches = meetings.filter((m) => fuzzyMatchMeeting(m, name));

  if (matches.length === 0) {
    const available = meetings.map((m) => m.meetingName).join(", ");
    throw new Error(
      `No meeting matching "${name}" for ${resolvedYear}. Available: ${available}`
    );
  }

  if (matches.length > 1) {
    const names = matches.map((m) => m.meetingName).join(", ");
    throw new Error(
      `Ambiguous meeting name "${name}" matched ${matches.length} meetings: ${names}`
    );
  }

  return matches[0];
}

export function createSessionResolver(client: OpenF1Client): SessionResolver {
  return {
    async resolveLatestMeeting(year?: number): Promise<Meeting> {
      const resolvedYear = year ?? new Date().getFullYear();
      const meetings = await client.queryMeetings({ year: resolvedYear });

      if (meetings.length === 0) {
        throw new Error(`No meetings found for ${resolvedYear}`);
      }

      return findLatestMeeting(meetings);
    },

    async resolveMeeting(name: string, year?: number): Promise<Meeting> {
      return resolveMatchedMeeting(client, name, year);
    },

    async fetchPracticeSessions(meetingKey: number): Promise<SessionMetadata[]> {
      return fetchStartedPracticeSessions(client, meetingKey);
    },

    async resolveLatestPracticeSessions(year?: number): Promise<SessionMetadata[]> {
      const resolvedYear = year ?? new Date().getFullYear();
      const meetings = await client.queryMeetings({ year: resolvedYear });

      if (meetings.length === 0) {
        throw new Error(`No meetings found for ${resolvedYear}`);
      }

      const latest = findLatestMeeting(meetings);
      return fetchStartedPracticeSessions(client, latest.meetingKey);
    },

    async resolvePracticeSessions(name: string, year?: number): Promise<SessionMetadata[]> {
      const meeting = await resolveMatchedMeeting(client, name, year);
      return fetchStartedPracticeSessions(client, meeting.meetingKey);
    },
  };
}
