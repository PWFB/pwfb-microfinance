"use client";

import { AuthProvider } from "../context/AuthContext";
import AppShellContent from "./AppShellContent";
import { ThemeProvider } from "./ThemeProvider";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppShellContent>{children}</AppShellContent>
      </AuthProvider>
    </ThemeProvider>
  );
}
