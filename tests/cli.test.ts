import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveMeeting } from "../src/cli.js";
import type { Meeting } from "../src/domain/session.js";

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

function createMockResolver(meeting: Meeting) {
  return {
    resolveMeeting: vi.fn().mockResolvedValue(meeting),
    resolveLatestMeeting: vi.fn().mockResolvedValue(meeting),
    fetchPracticeSessions: vi.fn().mockResolvedValue([]),
    resolvePracticeSessions: vi.fn().mockResolvedValue([]),
    resolveLatestPracticeSessions: vi.fn().mockResolvedValue([]),
  };
}

beforeEach(() => {
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
});

describe("resolveMeeting", () => {
  it("delegates to resolveMeeting when meeting name is provided", async () => {
    const meeting = makeMeeting();
    const resolver = createMockResolver(meeting);

    const result = await resolveMeeting(resolver, "bahrain");

    expect(result).toEqual(meeting);
    expect(resolver.resolveMeeting).toHaveBeenCalledWith("bahrain", undefined);
    expect(resolver.resolveLatestMeeting).not.toHaveBeenCalled();
  });

  it("delegates to resolveLatestMeeting when no name is provided", async () => {
    const meeting = makeMeeting();
    const resolver = createMockResolver(meeting);

    const result = await resolveMeeting(resolver);

    expect(result).toEqual(meeting);
    expect(resolver.resolveLatestMeeting).toHaveBeenCalled();
    expect(resolver.resolveMeeting).not.toHaveBeenCalled();
  });

  it("passes year to resolveMeeting when both name and year are provided", async () => {
    const meeting = makeMeeting();
    const resolver = createMockResolver(meeting);

    await resolveMeeting(resolver, "bahrain", 2023);

    expect(resolver.resolveMeeting).toHaveBeenCalledWith("bahrain", 2023);
  });

  it("passes year to resolveLatestMeeting when only year is provided", async () => {
    const meeting = makeMeeting();
    const resolver = createMockResolver(meeting);

    await resolveMeeting(resolver, undefined, 2023);

    expect(resolver.resolveLatestMeeting).toHaveBeenCalledWith(2023);
  });
});
