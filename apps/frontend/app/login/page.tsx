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
  const [remember, setRemember] = useState(true);
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

      if (remember) {
        localStorage.setItem("token", data.access_token);
      } else {
        sessionStorage.setItem("token", data.access_token);
      }

      await refreshProfile();

      if (data.role === "CUSTOMER") {
        router.replace("/customer-dashboard");
      } else if (data.role === "SUPER_ADMIN") {
        router.replace("/dashboard");
      } else {
        router.replace("/staff-dashboard");
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to connect to the server",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="pwfb-login-page">
      <div className="pwfb-login-card">

        {/* BRAND */}
        <div className="pwfb-login-brand">
          <div className="pwfb-login-logo">
            <span>PW</span>
            <small>FB</small>
          </div>

          <div>
            <div className="pwfb-login-brand-name">PWFB</div>
            <div className="pwfb-login-company">
              Perfect Wisdom For Better Ltd
            </div>
            <div className="pwfb-login-tagline">
              ...empowering lives
            </div>
          </div>
        </div>

        {/* WELCOME */}
        <div className="pwfb-login-heading">
          <h1>Welcome Back</h1>
          <p>Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="pwfb-login-form">

          {/* EMAIL / STAFF ID */}
          <div className="pwfb-login-field">
            <label htmlFor="email">
              <span className="pwfb-field-icon">◉</span>
              Staff ID / Email
            </label>

            <input
              id="email"
              type="email"
              placeholder="Enter your Staff ID or email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
            />
          </div>

          {/* PASSWORD */}
          <div className="pwfb-login-field">
            <label htmlFor="password">
              <span className="pwfb-field-icon">▣</span>
              Password
            </label>

            <input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {/* REMEMBER */}
          <div className="pwfb-login-options">
            <label className="pwfb-remember">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <span>Remember me</span>
            </label>

            <button
              type="button"
              className="pwfb-forgot"
              onClick={() =>
                setMessage(
                  "Please contact your administrator to reset your password.",
                )
              }
            >
              Forgot Password?
            </button>
          </div>

          {message && (
            <div className="pwfb-login-message">
              {message}
            </div>
          )}

          {/* LOGIN */}
          <button
            type="submit"
            disabled={loading}
            className="pwfb-login-button"
          >
            {loading ? "Signing in..." : "Login"}
          </button>

          {/* DIVIDER */}
          <div className="pwfb-login-divider">
            <span>OR</span>
          </div>

          {/* GOOGLE */}
          <button
            type="button"
            className="pwfb-social-button"
            onClick={() =>
              setMessage("Google sign-in is not enabled yet.")
            }
          >
            <span className="pwfb-google-icon">G</span>
            Continue with Google
          </button>

          {/* FINGERPRINT */}
          <button
            type="button"
            className="pwfb-social-button"
            onClick={() =>
              setMessage("Fingerprint login is not enabled yet.")
            }
          >
            <span className="pwfb-fingerprint">◉</span>
            Login with Fingerprint
          </button>
        </form>

        <div className="pwfb-login-footer">
          <span>Secure access to PWFB Microfinance</span>
        </div>
      </div>
    </main>
  );
}
