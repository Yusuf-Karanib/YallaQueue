import { z } from "zod";
import {
  DashboardAccessError,
  requireDashboardShop,
} from "@/src/dashboard/access";
import {
  appointmentRowSchema,
  formatAppointmentDate,
  formatAppointmentTime,
  getDateInTimeZone,
} from "@/src/dashboard/model";

export const dynamic = "force-dynamic";

const noStoreHeaders = { "cache-control": "no-store" };

export async function GET() {
  try {
    const { supabase, shop } = await requireDashboardShop();
    const today = getDateInTimeZone(new Date(), shop.timezone);
    const appointmentResult = await supabase
      .from("appointments")
      .select(
        "id,scheduled_for,service_date,duration_minutes,queue_number,status,customer_notified_at,barber_notified_at",
      )
      .eq("shop_id", shop.id)
      .gte("service_date", today)
      .order("scheduled_for", { ascending: true })
      .limit(100);

    if (appointmentResult.error) {
      throw new Error("Unable to load the queue.");
    }

    const appointments = z.array(appointmentRowSchema).parse(appointmentResult.data);
    const todayAppointments = appointments.filter(
      (appointment) => appointment.service_date === today,
    );

    return Response.json(
      {
        shop: { name: shop.name, timezone: shop.timezone },
        today,
        stats: {
          total: todayAppointments.length,
          waiting: todayAppointments.filter(
            (appointment) => appointment.status === "confirmed",
          ).length,
          completed: todayAppointments.filter(
            (appointment) => appointment.status === "completed",
          ).length,
        },
        appointments: appointments.map((appointment) => ({
          queueNumber: appointment.queue_number,
          serviceDate: appointment.service_date,
          scheduledFor: appointment.scheduled_for,
          localDate: formatAppointmentDate(
            appointment.scheduled_for,
            shop.timezone,
          ),
          localTime: formatAppointmentTime(
            appointment.scheduled_for,
            shop.timezone,
          ),
          durationMinutes: appointment.duration_minutes,
          status: appointment.status,
          customerNotified: Boolean(appointment.customer_notified_at),
        })),
      },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    if (error instanceof DashboardAccessError) {
      return Response.json(
        { error: error.message },
        { status: error.status, headers: noStoreHeaders },
      );
    }

    console.error("WebMCP queue read failed", error);
    return Response.json(
      { error: "The queue could not be loaded." },
      { status: 500, headers: noStoreHeaders },
    );
  }
}
