"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { browserSupportsWebAuthn, startRegistration } from "@simplewebauthn/browser";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

async function request(endpoint: string, token: string, options: RequestInit = {}) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || "Request failed");
  return data;
}

export default function RegisterPasskeyPage() {
  const router = useRouter();
  const [status, setStatus] = useState("Preparing passkey registration…");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function register() {
      try {
        if (!browserSupportsWebAuthn()) throw new Error("This browser does not support passkeys.");
        const token = localStorage.getItem("token") || sessionStorage.getItem("token");
        if (!token) throw new Error("Your PWFB session has expired. Please sign in with Google first.");
        setStatus("Opening your device passkey prompt…");
        const options = await request("/auth/passkey/register/options", token, { method: "POST" });
        const credential = await startRegistration({ optionsJSON: options });
        setStatus("Saving your passkey securely…");
        const result = await request("/auth/passkey/register/verify", token, {
          method: "POST",
          body: JSON.stringify(credential),
        });
        if (!result?.verified) throw new Error("Passkey registration could not be verified.");
        if (!cancelled) { setDone(true); setStatus("Passkey registered successfully."); }
      } catch (e: any) {
        if (!cancelled) {
          if (e?.name === "NotAllowedError") setError("Passkey registration was cancelled. Tap Register Passkey to try again.");
          else setError(e instanceof Error ? e.message : "Passkey registration failed.");
        }
      }
    }
    register();
    return () => { cancelled = true; };
  }, []);

  async function retry() {
    setError(""); setDone(false); setStatus("Preparing passkey registration…");
    try {
      if (!browserSupportsWebAuthn()) throw new Error("This browser does not support passkeys.");
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      if (!token) throw new Error("Please sign in first.");
      const options = await request("/auth/passkey/register/options", token, { method: "POST" });
      const credential = await startRegistration({ optionsJSON: options });
      setStatus("Saving your passkey securely…");
      const result = await request("/auth/passkey/register/verify", token, { method: "POST", body: JSON.stringify(credential) });
      if (!result?.verified) throw new Error("Passkey registration could not be verified.");
      setDone(true); setStatus("Passkey registered successfully.");
    } catch (e: any) {
      if (e?.name === "NotAllowedError") setError("Passkey registration was cancelled.");
      else setError(e instanceof Error ? e.message : "Passkey registration failed.");
    }
  }

  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, background: "#eef3ef" }}>
      <section style={{ width: "min(100%, 420px)", padding: 28, borderRadius: 24, background: "#fff", boxShadow: "0 20px 55px rgba(12,63,34,.16)", textAlign: "center" }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>🔐</div>
        <h1 style={{ margin: 0, color: "#087534", fontSize: 24 }}>PWFB Passkey</h1>
        <p style={{ color: "#59635d", fontSize: 14, lineHeight: 1.5 }}>{status}</p>
        {error && <div role="alert" style={{ margin: "16px 0", padding: 12, borderRadius: 10, background: "#fff4e5", color: "#a94d00", fontSize: 13 }}>{error}</div>}
        {done ? (
          <button onClick={() => router.back()} style={{ width: "100%", padding: 13, border: 0, borderRadius: 9, background: "#087534", color: "#fff", fontWeight: 800 }}>Continue to PWFB</button>
        ) : (
          <button onClick={retry} disabled={!error} style={{ width: "100%", padding: 13, border: 0, borderRadius: 9, background: "#087534", color: "#fff", fontWeight: 800, opacity: error ? 1 : .6 }}>Register Passkey</button>
        )}
      </section>
    </main>
  );
}
