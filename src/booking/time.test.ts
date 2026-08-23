import { describe, expect, it } from "vitest";
import { parseRequestedBookingTime } from "./time";

const reference = new Date("2026-08-23T08:00:00.000Z");

describe("parseRequestedBookingTime", () => {
  it("parses a future UAE date and time", () => {
    const result = parseRequestedBookingTime(
      "Tomorrow at 3 PM",
      reference,
      "Asia/Dubai",
    );

    expect(result?.instant.toISOString()).toBe("2026-08-24T11:00:00.000Z");
    expect(result?.displayText).toContain("3:00 PM");
  });

  it("requires both a date and a time", () => {
    expect(
      parseRequestedBookingTime("Tomorrow", reference, "Asia/Dubai"),
    ).toBeNull();
    expect(
      parseRequestedBookingTime("At 3 PM", reference, "Asia/Dubai"),
    ).toBeNull();
  });

  it("rejects requests more than 90 days ahead", () => {
    expect(
      parseRequestedBookingTime(
        "December 31, 2026 at 3 PM",
        reference,
        "Asia/Dubai",
      ),
    ).toBeNull();
  });
});
