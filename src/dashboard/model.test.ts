import { describe, expect, it } from "vitest";
import {
  formatAppointmentDate,
  formatAppointmentTime,
  getDateInTimeZone,
  getStatusLabel,
} from "./model";

describe("dashboard model", () => {
  it("uses the shop timezone when calculating today's date", () => {
    expect(getDateInTimeZone(new Date("2026-08-29T21:30:00.000Z"), "Asia/Dubai")).toBe(
      "2026-08-30",
    );
  });

  it("formats booking times for Dubai", () => {
    expect(formatAppointmentTime("2026-08-30T14:30:00.000Z", "Asia/Dubai")).toBe(
      "6:30 PM",
    );
    expect(formatAppointmentDate("2026-08-30T14:30:00.000Z", "Asia/Dubai")).toContain(
      "30 Aug",
    );
  });

  it("provides readable status labels", () => {
    expect(getStatusLabel("no_show")).toBe("No-show");
  });
});
