import type { Message } from "@aws-sdk/client-sqs";
import type { JobContext } from "queuecraft";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBookingHandler } from "./handler";
import type { BookingJob } from "./job";
import type {
  BookingRepository,
  ReservationDecision,
} from "./repository";
import type { BarberEmailNotifier } from "../notifications/email";
import type { WhatsAppMessenger } from "../notifications/whatsapp";

const job: BookingJob = {
  type: "booking_request",
  businessPhoneNumberId: "business-1",
  customerPhoneNumber: "971501234567",
  messageText: "Tomorrow at 3 PM",
  waMessageId: "wamid.1",
  receivedAt: new Date("2026-08-23T08:00:00.000Z").getTime(),
};

const shop = {
  id: "11de1947-f424-4775-83c9-48b4ff75e8b1",
  name: "Pilot Barbershop",
  timezone: "Asia/Dubai",
};

const confirmed: ReservationDecision = {
  outcome: "confirmed",
  bookingId: "ac1bd354-7eda-4cf0-956f-d9e95ef8b41d",
  shopId: shop.id,
  shopName: shop.name,
  shopTimezone: shop.timezone,
  barberEmail: "barber@example.com",
  queueNumber: 7,
  scheduledFor: new Date("2026-08-24T11:00:00.000Z"),
  customerNotified: false,
  barberNotified: false,
};

function queueMessage(overrides: Partial<typeof job> = {}): Message {
  return { Body: JSON.stringify({ ...job, ...overrides }) };
}

function jobContext(): JobContext {
  return {
    idempotencyKey: job.waMessageId,
    attempt: 1,
    signal: new AbortController().signal,
  };
}

describe("createBookingHandler", () => {
  const findShop = vi.fn();
  const reserve = vi.fn();
  const markNotification = vi.fn();
  const sendText = vi.fn();
  const sendBooking = vi.fn();

  const repository: BookingRepository = {
    findShop,
    reserve,
    markNotification,
  };
  const whatsapp: WhatsAppMessenger = { sendText };
  const email: BarberEmailNotifier = { sendBooking };
  const handler = createBookingHandler({ repository, whatsapp, email });

  beforeEach(() => {
    vi.clearAllMocks();
    findShop.mockResolvedValue(shop);
    reserve.mockResolvedValue(confirmed);
    markNotification.mockResolvedValue(undefined);
    sendText.mockResolvedValue(undefined);
    sendBooking.mockResolvedValue(undefined);
  });

  it("confirms a booking and notifies both customer and barber", async () => {
    await handler(queueMessage(), jobContext());

    expect(reserve).toHaveBeenCalledWith(
      expect.objectContaining({ waMessageId: "wamid.1" }),
      new Date("2026-08-24T11:00:00.000Z"),
    );
    expect(sendText).toHaveBeenCalledWith(
      expect.objectContaining({
        customerPhoneNumber: "971501234567",
        text: expect.stringContaining("queue number is 7"),
      }),
    );
    expect(sendBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "barber@example.com",
        queueNumber: 7,
      }),
    );
    expect(markNotification).toHaveBeenNthCalledWith(
      1,
      confirmed.bookingId,
      "customer",
    );
    expect(markNotification).toHaveBeenNthCalledWith(
      2,
      confirmed.bookingId,
      "barber",
    );
  });

  it("asks for a clearer time instead of creating a bad booking", async () => {
    await handler(
      queueMessage({ messageText: "I need a haircut" }),
      jobContext(),
    );

    expect(reserve).not.toHaveBeenCalled();
    expect(sendText).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining("Tomorrow at 3 PM") }),
    );
    expect(sendBooking).not.toHaveBeenCalled();
  });

  it("asks for another time when a slot is unavailable", async () => {
    reserve.mockResolvedValue({
      outcome: "unavailable",
      shopName: shop.name,
      shopTimezone: shop.timezone,
    } satisfies ReservationDecision);

    await handler(queueMessage(), jobContext());

    expect(sendText).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining("not available") }),
    );
    expect(sendBooking).not.toHaveBeenCalled();
    expect(markNotification).not.toHaveBeenCalled();
  });

  it("does not repeat notifications already recorded for a duplicate job", async () => {
    reserve.mockResolvedValue({
      ...confirmed,
      outcome: "duplicate",
      customerNotified: true,
      barberNotified: true,
    } satisfies ReservationDecision);

    await handler(queueMessage(), jobContext());

    expect(sendText).not.toHaveBeenCalled();
    expect(sendBooking).not.toHaveBeenCalled();
    expect(markNotification).not.toHaveBeenCalled();
  });
});
