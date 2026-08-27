import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "YallaQueue",
    template: "%s | YallaQueue",
  },
  description: "WhatsApp appointment booking for local service businesses.",
  icons: {
    icon: "/yallaqueue-app-icon.png",
    apple: "/yallaqueue-app-icon.png",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
