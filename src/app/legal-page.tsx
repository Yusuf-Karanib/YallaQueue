import Link from "next/link";
import type { ReactNode } from "react";

export function LegalPage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="shell">
      <Link className="brand" href="/">
        YallaQueue
      </Link>
      <article className="card">
        <h1>{title}</h1>
        <p className="muted">Effective 27 August 2026</p>
        {children}
      </article>
      <footer>
        Contact: <a href="mailto:Legionofoogabooga@gmail.com">Legionofoogabooga@gmail.com</a>
      </footer>
    </main>
  );
}
