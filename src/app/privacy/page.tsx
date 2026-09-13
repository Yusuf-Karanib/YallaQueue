import type { Metadata } from "next";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        This policy explains how YallaQueue handles information when you use its
        WhatsApp appointment-booking service.
      </p>

      <h2>Information we handle</h2>
      <ul>
        <li>Your WhatsApp phone number and messages sent to the service.</li>
        <li>Requested appointment date, time, status, and queue number.</li>
        <li>Dashboard account email, sign-in session cookie, and shop access.</li>
        <li>Business contact details and operating hours.</li>
        <li>Technical logs needed for security and reliability.</li>
      </ul>

      <h2>How we use it</h2>
      <p>
        We use this information to process appointment requests, prevent duplicate
        bookings, send confirmations, notify the relevant business, secure the
        service, and investigate failures.
      </p>

      <h2>Service providers</h2>
      <p>
        Information is processed using Meta&apos;s WhatsApp Cloud API, Amazon Web
        Services, and Supabase. These providers process data under their own terms
        and security controls. We do not sell personal information.
      </p>

      <h2>Retention and deletion</h2>
      <p>
        The project includes a cleanup that can remove the customer phone number,
        WhatsApp message ID, and booking message once an appointment has been over
        for 90 days. This cleanup is not automatic. Before real customer use, a
        named operator must run and verify it weekly. Until that operating process
        is active, data may remain longer than 90 days. The cleanup keeps anonymous
        appointment details such as time, queue number, and status.
      </p>
      <p>
        We keep a dashboard account email while that account remains active. The
        sign-in cookie is used only to keep the dashboard session active; signing
        out clears the local session, and otherwise it expires under the configured
        Supabase session settings. Security, legal, or active-dispute needs may
        require a longer hold. You may request deletion using our{" "}
        <a href="/data-deletion">data-deletion instructions</a>.
      </p>

      <h2>Your choices</h2>
      <p>
        You may stop messaging the service at any time. You may also ask to access,
        correct, or delete information associated with your WhatsApp number by
        contacting us.
      </p>
    </LegalPage>
  );
}
