"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../lib/api";

export type AuthUser = {
  id: string;
  email: string;
  role: string;
  firstName?: string;
  lastName?: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  logout: () => void;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshProfile() {
    const token = localStorage.getItem("token");

    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const profile = await apiRequest("/auth/profile");
      setUser(profile);
    } catch {
      localStorage.removeItem("token");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("token");
    setUser(null);
    router.replace("/login");
  }

  useEffect(() => {
    refreshProfile();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
