"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { refreshProfile } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setMessage("");
    setLoading(true);

    try {
      const data = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
        }),
      });

      if (!data.access_token) {
        setMessage(data.message || "Login failed");
        return;
      }

      localStorage.setItem("token", data.access_token);

      await refreshProfile();

      router.replace("/dashboard");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Connection error",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-lg">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-700 text-2xl font-bold text-white">
            P
          </div>

          <h1 className="mt-4 text-2xl font-bold text-slate-900">
            PWFB Microfinance
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Sign in to your account
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-5"
        >
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Email
            </label>

            <input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Password
            </label>

            <input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          {message && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </main>
  );
}
