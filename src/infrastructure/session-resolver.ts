import type { Meeting, SessionMetadata } from "../domain/session.js";
import type { OpenF1Client } from "./openf1-client.js";

export interface SessionResolver {
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

function findLatestMeeting(meetings: Meeting[]): Meeting {
  const now = new Date();
  const sorted = [...meetings].sort(
    (a, b) => new Date(a.dateStart).getTime() - new Date(b.dateStart).getTime()
  );

  const past = sorted.filter((m) => new Date(m.dateStart) <= now);
  return past.length > 0 ? past[past.length - 1] : sorted[0];
}

async function fetchPracticeSessions(
  client: OpenF1Client,
  meetingKey: number
): Promise<SessionMetadata[]> {
  const now = new Date();
  const sessions = await client.querySessions({ meetingKey });
  const practice = sessions
    .filter(
      (s) =>
        s.sessionName.toLowerCase().includes("practice") &&
        new Date(s.dateStart) <= now
    )
    .sort(
      (a, b) => new Date(a.dateStart).getTime() - new Date(b.dateStart).getTime()
    );

  if (practice.length === 0) {
    throw new Error(`No started practice sessions found for meeting ${meetingKey}`);
  }

  return practice;
}

export function createSessionResolver(client: OpenF1Client): SessionResolver {
  return {
    async resolveLatestPracticeSessions(year?: number): Promise<SessionMetadata[]> {
      const resolvedYear = year ?? new Date().getFullYear();
      const meetings = await client.queryMeetings({ year: resolvedYear });

      if (meetings.length === 0) {
        throw new Error(`No meetings found for ${resolvedYear}`);
      }

      const latest = findLatestMeeting(meetings);
      return fetchPracticeSessions(client, latest.meetingKey);
    },

    async resolvePracticeSessions(name: string, year?: number): Promise<SessionMetadata[]> {
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

      return fetchPracticeSessions(client, matches[0].meetingKey);
    },
  };
}
