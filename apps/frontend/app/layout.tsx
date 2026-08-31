import "./globals.css";
import "./desktop-ui.css";
import "./pwfb-ui-fixes.css";
import "./sidebar-scroll-fix.css";
import type { Metadata } from "next";
import AppShell from "../components/AppShell";

export const metadata: Metadata = {
  title: "PWFB Microfinance",
  description: "PWFB Microfinance Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
