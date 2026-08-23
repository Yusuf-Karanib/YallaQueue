import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { BookingJob } from "./job";

const reservationRowSchema = z.object({
  outcome: z.enum([
    "confirmed",
    "duplicate",
    "unavailable",
    "outside_hours",
    "invalid_time",
    "unknown_business",
  ]),
  booking_id: z.string().uuid().nullable(),
  shop_id: z.string().uuid().nullable(),
  shop_name: z.string().nullable(),
  shop_timezone: z.string().nullable(),
  barber_email: z.string().email().nullable(),
  queue_number: z.number().int().positive().nullable(),
  scheduled_for: z.string().datetime({ offset: true }).nullable(),
  customer_notified_at: z.string().datetime({ offset: true }).nullable(),
  barber_notified_at: z.string().datetime({ offset: true }).nullable(),
});

export type ReservationDecision =
  | {
      outcome: "confirmed" | "duplicate";
      bookingId: string;
      shopId: string;
      shopName: string;
      shopTimezone: string;
      barberEmail: string;
      queueNumber: number;
      scheduledFor: Date;
      customerNotified: boolean;
      barberNotified: boolean;
    }
  | {
      outcome: "unavailable" | "outside_hours" | "invalid_time";
      shopName: string;
      shopTimezone: string;
    }
  | { outcome: "unknown_business" };

export interface ShopConfig {
  id: string;
  name: string;
  timezone: string;
}

export interface BookingRepository {
  findShop(businessPhoneNumberId: string): Promise<ShopConfig | null>;
  reserve(job: BookingJob, scheduledFor: Date): Promise<ReservationDecision>;
  markNotification(
    bookingId: string,
    channel: "customer" | "barber",
  ): Promise<void>;
}

function requireValue<T>(value: T | null, field: string): T {
  if (value === null) {
    throw new Error(`Booking database returned no ${field}.`);
  }

  return value;
}

export class SupabaseBookingRepository implements BookingRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findShop(businessPhoneNumberId: string): Promise<ShopConfig | null> {
    const { data, error } = await this.client
      .from("shops")
      .select("id,name,timezone")
      .eq("whatsapp_phone_number_id", businessPhoneNumberId)
      .eq("active", true)
      .maybeSingle();

    if (error) {
      throw new Error(`Unable to load shop configuration: ${error.code || "unknown"}.`);
    }

    if (!data) {
      return null;
    }

    return z
      .object({
        id: z.string().uuid(),
        name: z.string().min(1),
        timezone: z.string().min(1),
      })
      .parse(data);
  }

  async reserve(
    job: BookingJob,
    scheduledFor: Date,
  ): Promise<ReservationDecision> {
    const { data, error } = await this.client.rpc("reserve_whatsapp_booking", {
      p_business_phone_number_id: job.businessPhoneNumberId,
      p_customer_phone_number: job.customerPhoneNumber,
      p_message_text: job.messageText,
      p_wa_message_id: job.waMessageId,
      p_scheduled_for: scheduledFor.toISOString(),
    });

    if (error) {
      throw new Error(`Booking database call failed: ${error.code || "unknown"}.`);
    }

    const rawRow = Array.isArray(data) ? data[0] : data;
    const parsed = reservationRowSchema.safeParse(rawRow);

    if (!parsed.success) {
      throw new Error("Booking database returned an invalid result.");
    }

    const row = parsed.data;

    if (row.outcome === "unknown_business") {
      return { outcome: "unknown_business" };
    }

    if (
      row.outcome === "unavailable" ||
      row.outcome === "outside_hours" ||
      row.outcome === "invalid_time"
    ) {
      return {
        outcome: row.outcome,
        shopName: requireValue(row.shop_name, "shop name"),
        shopTimezone: requireValue(row.shop_timezone, "shop timezone"),
      };
    }

    return {
      outcome: row.outcome,
      bookingId: requireValue(row.booking_id, "booking ID"),
      shopId: requireValue(row.shop_id, "shop ID"),
      shopName: requireValue(row.shop_name, "shop name"),
      shopTimezone: requireValue(row.shop_timezone, "shop timezone"),
      barberEmail: requireValue(row.barber_email, "barber email"),
      queueNumber: requireValue(row.queue_number, "queue number"),
      scheduledFor: new Date(requireValue(row.scheduled_for, "scheduled time")),
      customerNotified: row.customer_notified_at !== null,
      barberNotified: row.barber_notified_at !== null,
    };
  }

  async markNotification(
    bookingId: string,
    channel: "customer" | "barber",
  ): Promise<void> {
    const { error } = await this.client.rpc("mark_booking_notification", {
      p_booking_id: bookingId,
      p_channel: channel,
    });

    if (error) {
      throw new Error(`Unable to mark ${channel} notification as sent.`);
    }
  }
}

export function createSupabaseBookingRepository(
  url: string,
  serviceRoleKey: string,
): SupabaseBookingRepository {
  const client = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  return new SupabaseBookingRepository(client);
}
