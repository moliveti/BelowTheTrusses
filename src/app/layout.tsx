import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Below the Trusses — Forecast & BI",
  description: "Forecast, pipeline, and revenue tracker for Below the Trusses.",
  icons: {
    icon: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans text-base antialiased">{children}</body>
    </html>
  );
}
