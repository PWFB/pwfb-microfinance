"use client";

import { useEffect, useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import { apiRequest } from "../../../lib/api";

declare global {
  interface Window {
    PWFBNative?: {
      signInWithGoogle: () => void;
      registerPasskey: (replaceExisting: boolean, token: string) => void;
    };
    __pwfbNativePasskeyStatus?: (message: string) => void;
    __pwfbNativePasskeyResult?: (payload: { ok: boolean; message?: string; result?: any }) => void;
  }
}

export default function RegisterPasskeyPage() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") || sessionStorage.getItem("token") || "" : "";

  const register = async () => {
    setError(""); setMessage(""); setLoading(true);
    try {
      if (!token) throw new Error("Please sign in first before registering a fingerprint.");
      if (window.PWFBNative?.registerPasskey) {
        await new Promise<void>((resolve) => {
          let settled = false;
          const finish = () => { if (!settled) { settled = true; resolve(); } };
          window.__pwfbNativePasskeyStatus = (m) => setMessage(m);
          window.__pwfbNativePasskeyResult = (payload) => {
            if (payload?.ok) setMessage(payload.message || "Fresh PWFB fingerprint registered successfully on this device.");
            else setError(payload?.message || "We could not finish fingerprint registration.");
            finish();
          };
          window.PWFBNative!.registerPasskey(true, token);
          window.setTimeout(() => finish(), 30000);
        });
        return;
      }

      await apiRequest("/auth/passkey/unregister-all", { method: "POST" });
      const options = await apiRequest("/auth/passkey/register/options", {
        method: "POST",
        body: JSON.stringify({ replaceExisting: true }),
      });
      const result = await startRegistration({ optionsJSON: options });
      await apiRequest("/auth/passkey/register/verify", {
        method: "POST",
        body: JSON.stringify({ credential: result, challenge: options.challenge }),
      });
      setMessage("Fresh PWFB fingerprint registered successfully on this device.");
    } catch (e: any) {
      setError(e?.message || "Fingerprint registration failed.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) setError("Sign in first, then register your fingerprint on this device.");
  }, [token]);

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "linear-gradient(135deg,#f4fff8,#fff8ed)" }}>
      <section style={{ width: "min(520px,100%)", background: "white", borderRadius: 28, padding: 32, boxShadow: "0 20px 60px rgba(0,0,0,.10)" }}>
        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1.5, color: "#16834b" }}>PWFB SECURITY</div>
        <h1 style={{ margin: "8px 0" }}>Register this fingerprint</h1>
        <p style={{ color: "#667085", lineHeight: 1.6 }}>Register a fresh device passkey. Your old PWFB passkey is removed when replacement is requested.</p>
        {message && <div style={{ marginTop: 18, padding: 14, borderRadius: 14, background: "#ecfdf3", color: "#11643a" }}>{message}</div>}
        {error && <div style={{ marginTop: 18, padding: 14, borderRadius: 14, background: "#fff1f2", color: "#b42318" }}>{error}</div>}
        <button type="button" onClick={register} disabled={loading || !token} style={{ width: "100%", marginTop: 24, padding: 16, border: 0, borderRadius: 14, background: "#f28c28", color: "white", fontWeight: 800, cursor: loading || !token ? "not-allowed" : "pointer" }}>
          {loading ? "Registering fingerprint…" : "Register Fresh Fingerprint"}
        </button>
      </section>
    </main>
  );
}
