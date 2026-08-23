import { z } from "zod";

export const bookingJobSchema = z.object({
  type: z.literal("booking_request"),
  businessPhoneNumberId: z.string().trim().min(1).max(100),
  customerPhoneNumber: z.string().trim().regex(/^\d{6,20}$/),
  messageText: z.string().trim().min(1).max(1_000),
  waMessageId: z.string().trim().min(1).max(255),
  receivedAt: z.number().int().nonnegative(),
});

export type BookingJob = z.infer<typeof bookingJobSchema>;

export function parseBookingJob(body: string | undefined): BookingJob {
  if (!body) {
    throw new Error("Queue message body is missing.");
  }

  let payload: unknown;

  try {
    payload = JSON.parse(body);
  } catch {
    throw new Error("Queue message body is not valid JSON.");
  }

  const result = bookingJobSchema.safeParse(payload);

  if (!result.success) {
    throw new Error("Queue message is not a valid booking job.");
  }

  return result.data;
}
