import { z } from "zod";
import { appointmentStatusSchema } from "../dashboard/model";

export const queueStatusUpdateSchema = z.object({
  queueNumber: z.number().int().positive().max(10_000),
  serviceDate: z.string().date().optional(),
  status: appointmentStatusSchema,
});

export type QueueStatusUpdate = z.infer<typeof queueStatusUpdateSchema>;

export interface AgentQueueAppointment {
  queueNumber: number;
  serviceDate: string;
  scheduledFor: string;
  localDate: string;
  localTime: string;
  durationMinutes: number;
  status: string;
  customerNotified: boolean;
}

export interface AgentQueueSummary {
  shop: { name: string; timezone: string };
  today: string;
  stats: { total: number; waiting: number; completed: number };
  appointments: AgentQueueAppointment[];
}

export function formatQueueSummaryForAgent(summary: AgentQueueSummary): string {
  const header = [
    `${summary.shop.name} queue for ${summary.today} (${summary.shop.timezone}).`,
    `${summary.stats.total} appointments today: ${summary.stats.waiting} confirmed and waiting, ${summary.stats.completed} completed.`,
  ];

  if (summary.appointments.length === 0) {
    return [...header, "There are no upcoming appointments."].join("\n");
  }

  const appointments = summary.appointments.map(
    (appointment) =>
      `Queue ${appointment.queueNumber}: ${appointment.localDate} at ${appointment.localTime}, ${appointment.status}, ${appointment.durationMinutes} minutes.`,
  );

  return [...header, "Upcoming appointments:", ...appointments].join("\n");
}
