import type { SESv2Client } from "@aws-sdk/client-sesv2";
import { describe, expect, it, vi } from "vitest";
import { SesBarberEmailNotifier } from "./email";

describe("SesBarberEmailNotifier", () => {
  it("sends the barber a minimal booking alert", async () => {
    const send = vi.fn().mockResolvedValue({ MessageId: "ses-1" });
    const client = { send } as unknown as SESv2Client;
    const notifier = new SesBarberEmailNotifier(
      client,
      "bookings@example.com",
    );

    await notifier.sendBooking({
      to: "barber@example.com",
      shopName: "Pilot Barbershop",
      queueNumber: 7,
      scheduledTime: "24 Aug 2026, 3:00 PM",
    });

    const command = send.mock.calls[0][0];
    expect(command.input.FromEmailAddress).toBe("bookings@example.com");
    expect(command.input.Destination?.ToAddresses).toEqual([
      "barber@example.com",
    ]);
    expect(command.input.Content?.Simple?.Body?.Text?.Data).toContain(
      "Queue number: 7",
    );
    expect(command.input.Content?.Simple?.Body?.Text?.Data).not.toContain(
      "971501234567",
    );
  });
});
