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
        <li>Include the WhatsApp number used with YallaQueue.</li>
        <li>Complete a reasonable identity check if requested.</li>
      </ol>

      <h2>What happens next</h2>
      <p>
        We will confirm receipt and aim to complete a valid request within 30 days.
        We will delete or anonymize associated booking and message information,
        except where retention is required for security, fraud prevention, legal
        compliance, or resolving an active dispute.
      </p>
    </LegalPage>
  );
}
