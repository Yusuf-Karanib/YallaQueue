import type { Message } from "@aws-sdk/client-sqs";
import type { JobContext, JobHandler } from "queuecraft";
import { parseBookingJob } from "./job";
import type { BookingRepository } from "./repository";
import { parseRequestedBookingTime } from "./time";
import type { BarberEmailNotifier } from "../notifications/email";
import type { WhatsAppMessenger } from "../notifications/whatsapp";

interface BookingHandlerDependencies {
  repository: BookingRepository;
  whatsapp: WhatsAppMessenger;
  email: BarberEmailNotifier;
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new Error("Booking job ownership was lost.");
  }
}

function formatScheduledTime(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-AE", {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(instant);
}

export function createBookingHandler(
  dependencies: BookingHandlerDependencies,
): JobHandler {
  return async (message: Message, context: JobContext): Promise<void> => {
    const job = parseBookingJob(message.Body);
    throwIfAborted(context.signal);

    const shop = await dependencies.repository.findShop(
      job.businessPhoneNumberId,
    );

    if (!shop) {
      throw new Error("The receiving WhatsApp number is not mapped to an active shop.");
    }

    const requestedTime = parseRequestedBookingTime(
      job.messageText,
      new Date(job.receivedAt),
      shop.timezone,
    );

    if (!requestedTime) {
      throwIfAborted(context.signal);
      await dependencies.whatsapp.sendText({
        businessPhoneNumberId: job.businessPhoneNumberId,
        customerPhoneNumber: job.customerPhoneNumber,
        text: `Please send a day and time for ${shop.name}, for example: Tomorrow at 3 PM.`,
        signal: context.signal,
      });
      return;
    }

    const decision = await dependencies.repository.reserve(
      job,
      requestedTime.instant,
    );

    if (
      decision.outcome !== "confirmed" &&
      decision.outcome !== "duplicate"
    ) {
      if (decision.outcome === "unknown_business") {
        throw new Error(
          "The receiving WhatsApp number is not mapped to an active shop.",
        );
      }

      throwIfAborted(context.signal);
      await dependencies.whatsapp.sendText({
        businessPhoneNumberId: job.businessPhoneNumberId,
        customerPhoneNumber: job.customerPhoneNumber,
        text: `That time is not available at ${decision.shopName}. Please reply with another day and time.`,
        signal: context.signal,
      });
      return;
    }

    const scheduledTime = formatScheduledTime(
      decision.scheduledFor,
      decision.shopTimezone,
    );

    if (!decision.customerNotified) {
      throwIfAborted(context.signal);
      await dependencies.whatsapp.sendText({
        businessPhoneNumberId: job.businessPhoneNumberId,
        customerPhoneNumber: job.customerPhoneNumber,
        text: `Your appointment at ${decision.shopName} is confirmed for ${scheduledTime}. Your queue number is ${decision.queueNumber}.`,
        signal: context.signal,
      });
      await dependencies.repository.markNotification(
        decision.bookingId,
        "customer",
      );
    }

    if (!decision.barberNotified) {
      throwIfAborted(context.signal);
      await dependencies.email.sendBooking({
        to: decision.barberEmail,
        shopName: decision.shopName,
        queueNumber: decision.queueNumber,
        scheduledTime,
        signal: context.signal,
      });
      await dependencies.repository.markNotification(
        decision.bookingId,
        "barber",
      );
    }
  };
}
