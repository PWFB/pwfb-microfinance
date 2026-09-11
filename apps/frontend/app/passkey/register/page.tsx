"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { startRegistration } from "@simplewebauthn/browser";
import { apiRequest } from "../../../lib/api";

declare global {
  interface Window {
    PWFBNative?: { registerPasskey: (replaceExisting: boolean, token: string) => void };
    __pwfbNativePasskeyStatus?: (message: string) => void;
    __pwfbNativePasskeyResult?: (payload: { ok: boolean; message?: string; result?: any }) => void;
  }
}

export default function RegisterPasskeyPage() {
  const router = useRouter();
  const [status, setStatus] = useState("Ready to secure your PWFB account.");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const isReplacementFlow = () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("replacePasskey") === "1";
  const hasNativeBridge = () => typeof window !== "undefined" && !!window.PWFBNative?.registerPasskey;
  const browserSupportsPasskeys = () => typeof window !== "undefined" && "credentials" in navigator && "PublicKeyCredential" in window;
  const tokenExpiry = (token: string) => { try { const part = token.split(".")[1]; if (!part) return 0; const payload = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/"))); return Number(payload?.exp || 0); } catch { return 0; } };

  useEffect(() => { const token = localStorage.getItem("token") || sessionStorage.getItem("token"); if (!token) router.replace("/login?registerPasskey=1&replacePasskey=1"); }, [router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.__pwfbNativePasskeyStatus = (message) => setStatus(message);
    window.__pwfbNativePasskeyResult = (payload) => {
      setLoading(false);
      if (payload?.ok) { setDone(true); setError(""); setStatus(payload.message || "Fresh PWFB passkey registered successfully on this device."); }
      else { setStatus("We could not finish passkey setup."); setError(payload?.message || "Native passkey registration failed."); if (/jwt expired|token expired|session has expired|unauthorized/i.test(payload?.message || "")) { localStorage.removeItem("token"); sessionStorage.removeItem("token"); setTimeout(() => router.replace("/login?registerPasskey=1&replacePasskey=1"), 250); } }
    };
    return () => { delete window.__pwfbNativePasskeyStatus; delete window.__pwfbNativePasskeyResult; };
  }, [router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    if (!token) return;
    if (tokenExpiry(token) && tokenExpiry(token) <= Math.floor(Date.now() / 1000)) { localStorage.removeItem("token"); sessionStorage.removeItem("token"); router.replace("/login?registerPasskey=1&replacePasskey=1"); return; }
    if (new URLSearchParams(window.location.search).get("registered") === "1") { setDone(true); setStatus("This device's PWFB passkey is now registered."); return; }
    if (hasNativeBridge()) setStatus("Native PWFB fingerprint registration is ready.");
    else if (!browserSupportsPasskeys()) { setStatus("This browser cannot access the phone's passkey authenticator."); setError("Native registration is available in the PWFB Android app. Please use the latest PWFB Android build for fingerprint registration."); }
  }, [router]);

  async function register() {
    setLoading(true); setError("");
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      if (!token) throw new Error("Please sign in with your email and password first.");
      if (tokenExpiry(token) && tokenExpiry(token) <= Math.floor(Date.now() / 1000)) { localStorage.removeItem("token"); sessionStorage.removeItem("token"); router.replace("/login?registerPasskey=1&replacePasskey=1"); return; }
      const replacing = isReplacementFlow();
      if (hasNativeBridge()) { setStatus(replacing ? "Removing the old PWFB passkey and preparing a fresh device credential…" : "Preparing native fingerprint registration…"); window.PWFBNative!.registerPasskey(replacing, token); return; }
      if (!browserSupportsPasskeys()) throw new Error("Native PWFB passkey registration is available only in the latest Android app build. No Chrome fallback is used.");
      if (replacing) { setStatus("Removing all existing PWFB passkeys from this account…"); await apiRequest("/auth/passkey/unregister-all", { method: "POST" }); }
      setStatus("Preparing a fresh passkey for this device…");
      const options = await apiRequest("/auth/passkey/register/options", { method: "POST", body: JSON.stringify({ replaceExisting: replacing }) });
      setStatus("Follow the security prompt and approve the device security method.");
      const credential = await startRegistration({ optionsJSON: options });
      const result = await apiRequest("/auth/passkey/register/verify", { method: "POST", body: JSON.stringify({ credential, challenge: options.challenge }) });
      if (!result?.verified) throw new Error(result?.message || "PWFB could not verify this passkey.");
      setDone(true); setStatus("Fresh PWFB passkey registered successfully on this device.");
    } catch (e: any) {
      setStatus("We could not finish passkey setup.");
      const detail = String(e?.message || "");
      if (e?.name === "InvalidStateError" || /previously registered|already registered|credential already exists|excluded credentials exists on the local device/i.test(detail)) setError("This device already has the old PWFB credential. The latest replacement flow creates a fresh credential instead of excluding the old local credential.");
      else if (e?.name === "NotAllowedError") setError("Passkey setup was cancelled. Tap Register Fresh Passkey and try again.");
      else setError(detail || "Passkey registration failed.");
      setLoading(false);
    }
  }

  return <main className="pk-page"><section className="pk-card"><img className="logo" src="/pwfb-login-logo.svg" alt="PWFB"/><div className="icon">⌁</div><small>PWFB SECURITY</small><h1>Register this device</h1><p>Register a real device passkey protected by your Android fingerprint or device security. The PWFB Android app performs registration through Android Credential Manager instead of relying on the WebView.</p><div className="steps"><div><b>1</b> Sign in with email and password</div><div><b>2</b> Replace any old PWFB passkey when requested</div><div><b>3</b> Approve the Android fingerprint/security prompt</div></div><div className={`status ${done ? "success" : error ? "error" : ""}`}>{status}</div>{error && <div className="errorBox">{error}</div>}{done ? <button onClick={() => router.back()}>Continue to PWFB</button> : <button disabled={loading} onClick={register}>{loading ? "Registering…" : "Register Fresh Passkey"}</button>}<button className="cancel" onClick={() => router.back()}>Cancel</button></section><style jsx>{`*{box-sizing:border-box}.pk-page{min-height:100dvh;padding:18px;display:grid;place-items:center;background:linear-gradient(145deg,#075d2a,#087534);font-family:Inter,system-ui,sans-serif}.pk-card{width:min(450px,100%);padding:28px 24px;border-radius:22px;background:#fff;text-align:center;box-shadow:0 24px 70px rgba(0,0,0,.25)}.logo{width:min(260px,88%);margin-bottom:14px}.icon{margin:auto;width:66px;height:66px;border-radius:50%;display:grid;place-items:center;background:#eaf7ef;color:#087534;font-size:38px}.pk-card small{display:block;color:#f47712;font-weight:900;letter-spacing:2px;margin:10px}.pk-card h1{color:#087534;margin:8px 0}.pk-card p{color:#657169;font-size:13px;line-height:1.6}.steps{display:grid;gap:8px;text-align:left;margin:18px 0}.steps div{padding:10px;border-radius:9px;background:#f5f8f6;color:#435048;font-size:12px}.steps b{display:inline-grid;place-items:center;width:24px;height:24px;margin-right:8px;border-radius:50%;background:#087534;color:#fff}.status,.errorBox{padding:10px;border-radius:9px;margin:10px 0;font-size:11px;background:#f5f8f6;color:#59635d}.success{background:#eaf7ef;color:#087534}.error,.errorBox{background:#fff4e5;color:#9b4800}.pk-card button{width:100%;height:48px;border:0;border-radius:9px;background:#087534;color:#fff;font-weight:900}.pk-card button:disabled{opacity:.6}.pk-card .cancel{margin-top:10px;background:none;color:#68736d;height:36px;font-weight:500}`}</style></main>;
}
