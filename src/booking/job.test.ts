import { describe, expect, it } from "vitest";
import { parseBookingJob } from "./job";

describe("parseBookingJob", () => {
  it("accepts a complete booking job", () => {
    const job = parseBookingJob(
      JSON.stringify({
        type: "booking_request",
        businessPhoneNumberId: "business-1",
        customerPhoneNumber: "971501234567",
        messageText: "Tomorrow at 3 PM",
        waMessageId: "wamid.1",
        receivedAt: 1_800_000_000_000,
      }),
    );

    expect(job.waMessageId).toBe("wamid.1");
  });

  it("rejects malformed or incomplete jobs", () => {
    expect(() => parseBookingJob("not-json")).toThrow("not valid JSON");
    expect(() => parseBookingJob(JSON.stringify({ type: "booking_request" }))).toThrow(
      "not a valid booking job",
    );
  });
});
