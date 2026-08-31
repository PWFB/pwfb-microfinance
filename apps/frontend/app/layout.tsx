import "./globals.css";
import "./desktop-ui.css";
import "./pwfb-ui-fixes.css";
import "./sidebar-scroll-fix.css";
import type { Metadata } from "next";
import AppShell from "../components/AppShell";

export const metadata: Metadata = {
  title: "PWFB Microfinance",
  description: "PWFB Microfinance Management System",
  manifest: "/manifest.webmanifest",
  applicationName: "PWFB Microfinance",
  themeColor: "#075d2a",
  icons: {
    icon: "/pwfb-app-icon.svg",
    apple: "/pwfb-app-icon.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "PWFB Microfinance",
  },
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
        <script
          dangerouslySetInnerHTML={{
            __html: `if ('serviceWorker' in navigator) { window.addEventListener('load', function () { navigator.serviceWorker.register('/sw.js').catch(function () {}); }); }`,
          }}
        />
      </body>
    </html>
  );
}
