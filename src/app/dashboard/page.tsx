import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  appointmentRowSchema,
  formatAppointmentDate,
  formatAppointmentTime,
  getDateInTimeZone,
  getStatusLabel,
  type AppointmentStatus,
} from "@/src/dashboard/model";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { logout, updateAppointmentStatus } from "./actions";
import styles from "./dashboard.module.css";

export const metadata: Metadata = {
  title: "Dashboard",
};

export const dynamic = "force-dynamic";

const membershipSchema = z.object({
  shop_id: z.string().uuid(),
  role: z.enum(["owner", "manager"]),
});

const shopSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  timezone: z.string().min(1),
  default_appointment_minutes: z.number().int().positive(),
});

interface DashboardPageProps {
  searchParams: Promise<{ error?: string; updated?: string }>;
}

const statuses: AppointmentStatus[] = [
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
];

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const supabase = await createSupabaseServerClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) {
    redirect("/login");
  }

  const membershipResult = await supabase
    .from("shop_members")
    .select("shop_id,role")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (membershipResult.error) {
    throw new Error("Unable to load shop access.");
  }

  const membership = membershipSchema.safeParse(membershipResult.data);

  if (!membership.success) {
    return (
      <main className={styles.centeredPage}>
        <section className={styles.emptyAccess}>
          <p className={styles.eyebrow}>YallaQueue</p>
          <h1>No shop assigned</h1>
          <p>Your login works, but it has not been connected to a shop yet.</p>
          <form action={logout}>
            <button className={styles.secondaryButton} type="submit">
              Sign out
            </button>
          </form>
        </section>
      </main>
    );
  }

  const shopResult = await supabase
    .from("shops")
    .select("id,name,timezone,default_appointment_minutes")
    .eq("id", membership.data.shop_id)
    .single();

  if (shopResult.error) {
    throw new Error("Unable to load shop details.");
  }

  const shop = shopSchema.parse(shopResult.data);

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
    throw new Error("Unable to load appointments.");
  }

  const appointments = z.array(appointmentRowSchema).parse(appointmentResult.data);
  const todayAppointments = appointments.filter(
    (appointment) => appointment.service_date === today,
  );
  const waitingCount = todayAppointments.filter(
    (appointment) => appointment.status === "confirmed",
  ).length;
  const completedCount = todayAppointments.filter(
    (appointment) => appointment.status === "completed",
  ).length;
  const { error, updated } = await searchParams;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.brand}>YallaQueue</p>
          <p className={styles.shopName}>{shop.name}</p>
        </div>
        <form action={logout}>
          <button className={styles.signOut} type="submit">
            Sign out
          </button>
        </form>
      </header>

      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Live shop dashboard</p>
          <h1>Today&apos;s queue</h1>
          <p>Appointments from WhatsApp appear here automatically.</p>
        </div>
        <div className={styles.liveBadge}>
          <span /> Live
        </div>
      </section>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {updated ? (
        <p className={styles.success} role="status">
          Appointment updated.
        </p>
      ) : null}

      <section className={styles.stats} aria-label="Today's totals">
        <article>
          <span>Today</span>
          <strong>{todayAppointments.length}</strong>
          <small>Total appointments</small>
        </article>
        <article>
          <span>Waiting</span>
          <strong>{waitingCount}</strong>
          <small>Still confirmed</small>
        </article>
        <article>
          <span>Done</span>
          <strong>{completedCount}</strong>
          <small>Completed today</small>
        </article>
      </section>

      <section className={styles.queueSection}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Schedule</p>
            <h2>Today and upcoming</h2>
          </div>
          <p>{shop.default_appointment_minutes}-minute appointments</p>
        </div>

        {appointments.length === 0 ? (
          <div className={styles.emptyState}>
            <strong>No upcoming appointments</strong>
            <p>New WhatsApp bookings will appear here.</p>
          </div>
        ) : (
          <div className={styles.appointmentList}>
            {appointments.map((appointment) => (
              <article className={styles.appointment} key={appointment.id}>
                <div className={styles.queueNumber}>
                  <span>Queue</span>
                  <strong>{appointment.queue_number}</strong>
                </div>

                <div className={styles.appointmentTime}>
                  <strong>
                    {formatAppointmentTime(appointment.scheduled_for, shop.timezone)}
                  </strong>
                  <span>
                    {formatAppointmentDate(appointment.scheduled_for, shop.timezone)}
                  </span>
                </div>

                <div className={styles.notificationState}>
                  <span
                    className={`${styles.statusPill} ${styles[appointment.status]}`}
                  >
                    {getStatusLabel(appointment.status)}
                  </span>
                  <small>
                    {appointment.customer_notified_at
                      ? "Customer notified"
                      : "Reply pending"}
                  </small>
                </div>

                <form action={updateAppointmentStatus} className={styles.statusForm}>
                  <input name="appointmentId" type="hidden" value={appointment.id} />
                  <label htmlFor={`status-${appointment.id}`}>Update status</label>
                  <div>
                    <select
                      defaultValue={appointment.status}
                      id={`status-${appointment.id}`}
                      name="status"
                    >
                      {statuses.map((status) => (
                        <option key={status} value={status}>
                          {getStatusLabel(status)}
                        </option>
                      ))}
                    </select>
                    <button type="submit">Save</button>
                  </div>
                </form>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
