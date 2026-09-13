import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readMigration(name: string): string {
  return readFileSync(
    fileURLToPath(new URL(name, import.meta.url)),
    "utf8",
  ).toLowerCase();
}

describe("security migrations", () => {
  it("replaces table-wide appointment reads with the dashboard column set", () => {
    const migration = readMigration(
      "202609120001_limit_dashboard_appointment_columns.sql",
    );
    const grant = migration.match(
      /grant select \(([\s\S]*?)\) on public\.appointments to authenticated;/,
    )?.[1];

    expect(migration).toContain(
      "revoke select on public.appointments from public, anon, authenticated",
    );
    expect(grant).toContain("shop_id");
    expect(grant).toContain("status");
    expect(grant).not.toContain("customer_phone");
    expect(grant).not.toContain("requested_text");
    expect(grant).not.toContain("wa_message_id");
  });

  it("serializes and caps active bookings while keeping the old RPC private", () => {
    const migration = readMigration(
      "202609120002_limit_active_customer_bookings.sql",
    );

    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("v_active_booking_count >= 3");
    expect(migration).toContain("'booking_limit'::text");
    expect(migration).toContain("sqlerrm <> 'active_booking_limit_reached'");
    expect(migration).toContain(
      "from public, anon, authenticated, service_role",
    );
    expect(migration).toContain(
      "create trigger enforce_active_customer_booking_limit",
    );
  });

  it("redacts expired personal fields and respects retention holds", () => {
    const migration = readMigration(
      "202609120003_anonymize_expired_appointments.sql",
    );

    expect(migration).toContain("retention_hold = false");
    expect(migration).toContain("customer_phone = 'redacted:'");
    expect(migration).toContain("requested_text = '[redacted]'");
    expect(migration).toContain("wa_message_id = 'redacted:'");
    expect(migration).toContain("p_retention_days is null");
    expect(migration).toContain(
      "from public, anon, authenticated",
    );
  });
});
