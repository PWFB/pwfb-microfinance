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
      localStorage.removeItem("token"); localStorage.removeItem("access_token"); localStorage.removeItem("user"); localStorage.removeItem("pwfb_google_oidc_nonce"); sessionStorage.removeItem("token"); sessionStorage.removeItem("access_token"); sessionStorage.removeItem("user"); sessionStorage.removeItem("pwfb_google_oidc_nonce"); setUser(null); return null;
    } finally { setLoading(false); }
  }

  function logout() {
    // PWFB uses bearer JWTs, so logout is a client-session termination:
    // remove every token/session marker before returning to the production login.
    const keys = ["token", "access_token", "user", "pwfb_google_oidc_nonce"];
    for (const key of keys) {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    }
    setUser(null);

    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const nativeApp = /PWFBAndroidApp/i.test(ua);
    const loginUrl = "https://pwfb-frontend.onrender.com/login";

    if (nativeApp) {
      window.location.href = "pwfb://open-app?logout=1&url=" + encodeURIComponent(loginUrl);
      window.setTimeout(() => window.location.assign("/login"), 700);
      return;
    }

    window.location.replace(loginUrl);
  }

  useEffect(() => { refreshProfile().catch(() => undefined); }, [pathname]);
  return <AuthContext.Provider value={{ user, loading, logout, refreshProfile }}>{children}</AuthContext.Provider>;
}

export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error("useAuth must be used inside AuthProvider"); return context; }
