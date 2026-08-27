import Link from "next/link";

export default function Home() {
  return (
    <main className="shell">
      <section className="card">
        <p className="muted">WhatsApp appointment booking</p>
        <h1>YallaQueue</h1>
        <p>
          YallaQueue helps local service businesses receive appointment requests,
          confirm available times, and issue queue numbers through WhatsApp.
        </p>
        <nav className="links" aria-label="Legal information">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/data-deletion">Data deletion</Link>
        </nav>
      </section>
    </main>
  );
}
