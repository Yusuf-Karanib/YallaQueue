import { z } from "zod";

export const appointmentStatusSchema = z.enum([
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
]);

export type AppointmentStatus = z.infer<typeof appointmentStatusSchema>;

export const appointmentRowSchema = z.object({
  id: z.string().uuid(),
  scheduled_for: z.string().datetime({ offset: true }),
  service_date: z.string().date(),
  duration_minutes: z.number().int().positive(),
  queue_number: z.number().int().positive(),
  status: appointmentStatusSchema,
  customer_notified_at: z.string().datetime({ offset: true }).nullable(),
  barber_notified_at: z.string().datetime({ offset: true }).nullable(),
});

export type AppointmentRow = z.infer<typeof appointmentRowSchema>;

export function getDateInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
}

export function formatAppointmentTime(isoDate: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-AE", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(isoDate));
}

export function formatAppointmentDate(isoDate: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-AE", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(isoDate));
}

export function getStatusLabel(status: AppointmentStatus): string {
  return {
    confirmed: "Confirmed",
    completed: "Completed",
    cancelled: "Cancelled",
    no_show: "No-show",
  }[status];
}
