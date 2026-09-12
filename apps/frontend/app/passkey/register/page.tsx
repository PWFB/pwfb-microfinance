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
    __pwfbNativePasskeyResult?: (payload: any) => void;
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
          let done = false;
          const finish = () => { if (!done) { done = true; resolve(); } };
          window.__pwfbNativePasskeyStatus = (text) => setMessage(text);
          window.__pwfbNativePasskeyResult = (payload) => {
            if (payload?.ok) { setMessage(payload.message || "Fingerprint registered successfully."); finish(); }
            else { setError(payload?.message || "Fingerprint registration failed."); finish(); }
          };
          window.PWFBNative!.registerPasskey(true, token);
          window.setTimeout(() => { if (!done) { setError("Fingerprint registration timed out. Please try again."); finish(); } }, 60000);
        });
        return;
      }
      if (!("credentials" in navigator) || !("PublicKeyCredential" in window)) {
        throw new Error("Fingerprint/passkey authentication is not available on this device.");
      }
      await apiRequest("/auth/passkey/unregister-all", { method: "POST" });
      const options = await apiRequest("/auth/passkey/register/options", { method: "POST", body: JSON.stringify({ replaceExisting: true }) });
      const credential = await startRegistration({ optionsJSON: options });
      await apiRequest("/auth/passkey/register/verify", { method: "POST", body: JSON.stringify({ credential, challenge: options.challenge }) });
      setMessage("Fingerprint registered successfully on this device.");
    } catch (e: any) {
      setError(e?.message || "Fingerprint registration failed.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      delete window.__pwfbNativePasskeyStatus;
      delete window.__pwfbNativePasskeyResult;
    };
  }, []);

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <section style={{ width: "100%", maxWidth: 520, borderRadius: 24, padding: 28, background: "var(--card, #fff)", boxShadow: "0 20px 60px rgba(0,0,0,.10)" }}>
        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1.5, color: "#138a4b" }}>PWFB SECURITY</div>
        <h1 style={{ marginBottom: 8 }}>Register this fingerprint</h1>
        <p style={{ opacity: .72 }}>Register a fresh device passkey. Your Android fingerprint/security prompt will protect future PWFB sign-ins.</p>
        {message && <div style={{ marginTop: 18, padding: 14, borderRadius: 12, background: "#edf9f1" }}>{message}</div>}
        {error && <div style={{ marginTop: 18, padding: 14, borderRadius: 12, background: "#fff0f0", color: "#b42318" }}>{error}</div>}
        <button type="button" onClick={register} disabled={loading} style={{ width: "100%", marginTop: 22, padding: 15, border: 0, borderRadius: 12, fontWeight: 800, cursor: loading ? "wait" : "pointer" }}>
          {loading ? "Registering fingerprint…" : "Register Fresh Fingerprint"}
        </button>
      </section>
    </main>
  );
}
