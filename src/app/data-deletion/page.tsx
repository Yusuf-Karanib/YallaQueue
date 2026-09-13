import type { Metadata } from "next";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = { title: "Data Deletion" };

export default function DataDeletionPage() {
  return (
    <LegalPage title="Data Deletion Instructions">
      <p>You may ask YallaQueue to delete information linked to your WhatsApp number.</p>

      <h2>How to request deletion</h2>
      <ol>
        <li>
          Email <a href="mailto:Legionofoogabooga@gmail.com?subject=YallaQueue%20data%20deletion%20request">Legionofoogabooga@gmail.com</a> with the subject
          &quot;YallaQueue data deletion request.&quot;
        </li>
        <li>
          Include the WhatsApp number used for bookings, the dashboard account
          email, or both, depending on what you want deleted.
        </li>
        <li>Complete a reasonable identity check if requested.</li>
      </ol>

      <h2>What happens next</h2>
      <p>
        We will confirm receipt and aim to complete a valid request within 30 days.
        Valid booking-data requests remove or anonymize the matching phone number,
        WhatsApp message ID, and message text. Anonymous appointment details may
        remain for operational totals. Without an earlier valid request, these
        fields become eligible 90 days after the appointment ends. The cleanup is
        operator-run rather than automatic, so data may remain longer until that
        process completes successfully.
      </p>
      <p>
        A dashboard-account request removes the account&apos;s shop membership and
        Supabase Authentication record. Sign out on each device to clear its local
        session cookie immediately; any remaining cookie stops working when its
        session expires or the account is removed. We may delay deletion where a
        security, fraud-prevention, legal, or active-dispute hold applies.
      </p>
    </LegalPage>
  );
}
