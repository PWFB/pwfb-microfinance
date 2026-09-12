"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../lib/api";

export type AuthUser = { id: string; email: string; role: string; firstName?: string; lastName?: string };

type AuthContextValue = { user: AuthUser | null; loading: boolean; logout: () => void; refreshProfile: () => Promise<AuthUser | null> };
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshProfile(): Promise<AuthUser | null> {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    if (!token) { setUser(null); setLoading(false); return null; }
    try {
      let profile = await apiRequest("/auth/profile");
      if (profile?.twoFactorRequired) {
        const code = window.prompt("Google Authenticator is enabled. Enter your 6-digit code to continue.");
        if (!code?.trim()) throw new Error("Two-factor authentication is required to continue.");
        await apiRequest("/auth/2fa/verify", { method: "POST", body: JSON.stringify({ token, code: code.trim() }) });
        profile = await apiRequest("/auth/profile");
      }
      setUser(profile); return profile as AuthUser;
    } catch (error) {
      if (error instanceof Error && error.message.includes("Two-factor authentication is required")) throw error;
      localStorage.removeItem("token"); localStorage.removeItem("user"); sessionStorage.removeItem("token"); sessionStorage.removeItem("user"); setUser(null); return null;
    } finally { setLoading(false); }
  }

  function logout() {
    localStorage.removeItem("token"); localStorage.removeItem("user"); sessionStorage.removeItem("token"); sessionStorage.removeItem("user"); setUser(null);
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const nativeApp = /PWFBAndroidApp/i.test(ua);
    if (nativeApp) {
      window.location.href = "pwfb://open-app?logout=1&url=" + encodeURIComponent("https://pwfb-frontend.onrender.com/login");
      window.setTimeout(() => router.replace("/login"), 700);
      return;
    }
    router.replace("/login");
  }

  useEffect(() => { refreshProfile().catch(() => undefined); }, []);
  return <AuthContext.Provider value={{ user, loading, logout, refreshProfile }}>{children}</AuthContext.Provider>;
}

export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error("useAuth must be used inside AuthProvider"); return context; }
