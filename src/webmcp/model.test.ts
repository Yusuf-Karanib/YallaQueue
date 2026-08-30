import { describe, expect, it } from "vitest";
import {
  formatQueueSummaryForAgent,
  queueStatusUpdateSchema,
} from "./model";

describe("WebMCP queue tools", () => {
  it("accepts a safe queue status update", () => {
    expect(
      queueStatusUpdateSchema.parse({ queueNumber: 1, status: "completed" }),
    ).toEqual({ queueNumber: 1, status: "completed" });
  });

  it("rejects invalid queue numbers and statuses", () => {
    expect(
      queueStatusUpdateSchema.safeParse({ queueNumber: 0, status: "deleted" })
        .success,
    ).toBe(false);
  });

  it("formats a minimal agent-safe queue summary", () => {
    const result = formatQueueSummaryForAgent({
      shop: { name: "YallaQueue Test Shop", timezone: "Asia/Dubai" },
      today: "2026-08-30",
      stats: { total: 1, waiting: 1, completed: 0 },
      appointments: [
        {
          queueNumber: 1,
          serviceDate: "2026-08-30",
          scheduledFor: "2026-08-30T14:30:00.000Z",
          localDate: "Sun, 30 Aug",
          localTime: "6:30 PM",
          durationMinutes: 30,
          status: "confirmed",
          customerNotified: true,
        },
      ],
    });

    expect(result).toContain("Queue 1: Sun, 30 Aug at 6:30 PM");
    expect(result).not.toContain("phone");
  });
});
