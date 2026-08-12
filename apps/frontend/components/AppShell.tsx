"use client";

import { AuthProvider } from "../context/AuthContext";
import AppShellContent from "./AppShellContent";

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <AppShellContent>{children}</AppShellContent>
    </AuthProvider>
  );
}
