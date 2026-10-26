"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { apiRequest } from "../lib/api";
import { getDashboardPath } from "../lib/role-routing";

export type AuthUser = { id: string; email: string; role: string; firstName?: string; lastName?: string };

type AuthContextValue = { user: AuthUser | null; loading: boolean; logout: () => void; refreshProfile: () => Promise<AuthUser | null> };
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshProfile(): Promise<AuthUser | null> {
    let token: string | null = null;
    try {
      token = window.localStorage.getItem("token") || window.sessionStorage.getItem("token") || window.localStorage.getItem("access_token") || window.sessionStorage.getItem("access_token");
    } catch {
      // A browser that blocks storage should still be able to display the public login page.
    }
    if (!token) { setUser(null); setLoading(false); return null; }
    try {
      let profile = await apiRequest("/auth/profile");
      if (profile?.twoFactorRequired) {
        const code = window.prompt("Google Authenticator is enabled. Enter your 6-digit code to continue.");
        if (!code?.trim()) throw new Error("Two-factor authentication is required to continue.");
        await apiRequest("/auth/2fa/verify", { method: "POST", body: JSON.stringify({ token, code: code.trim() }) });
        profile = await apiRequest("/auth/profile");
      }
      const currentUser = profile as AuthUser;
      setUser(currentUser);
      if (currentUser?.role) {
        const dashboardPath = getDashboardPath(currentUser.role);
        const protectedDashboards = ["/dashboard", "/staff-dashboard", "/customer-dashboard"];
        if (protectedDashboards.includes(pathname || "") && pathname !== dashboardPath) {
          router.replace(dashboardPath);
        }
      }
      return currentUser;
    } catch (error) {
      if (error instanceof Error && error.message.includes("Two-factor authentication is required")) throw error;
      try {
        for (const storage of [window.localStorage, window.sessionStorage]) {
          for (const key of ["token", "access_token", "user", "pwfb_google_oidc_nonce"]) storage.removeItem(key);
        }
      } catch { /* Storage may be unavailable in a restricted browser context. */ }
      setUser(null); return null;
    } finally { setLoading(false); }
  }

  function logout() {
    // PWFB uses bearer JWT client sessions; there is intentionally no /auth/logout API call.
    // Clear every session key used by password, Google, passkey and Android handoff.
    const keys = ["token", "access_token", "user", "app_token"];
    for (const key of keys) {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    }
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("pwfb_google_oidc_nonce_")) localStorage.removeItem(key);
    }
    if (typeof window !== "undefined" && window.google?.accounts?.id?.disableAutoSelect) window.google.accounts.id.disableAutoSelect();
    setUser(null);
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const nativeApp = /PWFBAndroidApp/i.test(ua);
    // Return to the public frontend root; this deployment does not expose a /login page.
    const loginUrl = `${window.location.origin}/`;
    if (nativeApp) {
      window.location.href = "pwfb://open-app?logout=1&url=" + encodeURIComponent(loginUrl);
      window.setTimeout(() => router.replace("/"), 700);
      return;
    }
    window.location.assign(loginUrl);
  }

  useEffect(() => { refreshProfile().catch(() => undefined); }, [pathname]);
  return <AuthContext.Provider value={{ user, loading, logout, refreshProfile }}>{children}</AuthContext.Provider>;
}

export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error("useAuth must be used inside AuthProvider"); return context; }
