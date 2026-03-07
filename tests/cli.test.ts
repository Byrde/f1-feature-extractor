import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveSessions } from "../src/cli.js";
import type { SessionMetadata } from "../src/domain/session.js";

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

function createMockResolver(sessions: SessionMetadata[]) {
  return {
    resolvePracticeSessions: vi.fn().mockResolvedValue(sessions),
    resolveLatestPracticeSessions: vi.fn().mockResolvedValue(sessions),
  };
}

beforeEach(() => {
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
});

describe("resolveSessions", () => {
  it("delegates to resolvePracticeSessions when meeting name is provided", async () => {
    const sessions = [makeSession()];
    const resolver = createMockResolver(sessions);

    const result = await resolveSessions(resolver, "bahrain");

    expect(result).toEqual(sessions);
    expect(resolver.resolvePracticeSessions).toHaveBeenCalledWith("bahrain", undefined);
    expect(resolver.resolveLatestPracticeSessions).not.toHaveBeenCalled();
  });

  it("delegates to resolveLatestPracticeSessions when no name is provided", async () => {
    const sessions = [makeSession()];
    const resolver = createMockResolver(sessions);

    const result = await resolveSessions(resolver);

    expect(result).toEqual(sessions);
    expect(resolver.resolveLatestPracticeSessions).toHaveBeenCalled();
    expect(resolver.resolvePracticeSessions).not.toHaveBeenCalled();
  });

  it("passes year to resolvePracticeSessions when both name and year are provided", async () => {
    const sessions = [makeSession()];
    const resolver = createMockResolver(sessions);

    await resolveSessions(resolver, "bahrain", 2023);

    expect(resolver.resolvePracticeSessions).toHaveBeenCalledWith("bahrain", 2023);
  });

  it("passes year to resolveLatestPracticeSessions when only year is provided", async () => {
    const sessions = [makeSession()];
    const resolver = createMockResolver(sessions);

    await resolveSessions(resolver, undefined, 2023);

    expect(resolver.resolveLatestPracticeSessions).toHaveBeenCalledWith(2023);
  });
});
