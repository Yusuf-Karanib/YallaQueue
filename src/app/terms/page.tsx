import type { Metadata } from "next";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        By using YallaQueue, you agree to use the service lawfully and provide
        accurate appointment information.
      </p>

      <h2>Booking service</h2>
      <p>
        YallaQueue passes appointment requests between WhatsApp users and
        participating businesses. A booking is confirmed only when the service
        sends a confirmation. The business remains responsible for providing the
        booked service.
      </p>

      <h2>Acceptable use</h2>
      <p>
        Do not misuse the service, attempt unauthorized access, send harmful or
        unlawful content, or interfere with other customers&apos; bookings.
      </p>

      <h2>Availability</h2>
      <p>
        The service may be changed, interrupted, or withdrawn. During the pilot,
        features may be incomplete and availability is not guaranteed.
      </p>

      <h2>Liability</h2>
      <p>
        To the extent allowed by law, YallaQueue is not responsible for a
        business&apos;s services, missed appointments, or indirect losses caused by
        service interruptions. Nothing in these terms removes rights that cannot
        legally be excluded.
      </p>

      <h2>Changes</h2>
      <p>
        These terms may be updated as the service develops. The effective date on
        this page shows the latest version.
      </p>
    </LegalPage>
  );
}
