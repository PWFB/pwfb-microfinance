"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { startRegistration } from "@simplewebauthn/browser";
import { apiRequest } from "../../../lib/api";

const CHROME_HANDOFF = "pwfb://open-chrome?url=";

export default function RegisterPasskeyPage() {
  const router = useRouter();
  const [status, setStatus] = useState("Ready to secure your PWFB account.");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [chromeNeeded, setChromeNeeded] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    if (!token) router.replace("/login?registerPasskey=1");
  }, [router]);

  function openChromeForPasskey() {
    const target = `${window.location.origin}/passkey/register?newDevice=1&chrome=1`;
    window.location.href = `${CHROME_HANDOFF}${encodeURIComponent(target)}`;
  }
  function returnToApp() {
    const target = `${window.location.origin}/passkey/register?newDevice=1&registered=1`;
    window.location.href = `pwfb://open-app?url=${encodeURIComponent(target)}`;
  }
  function browserSupportsPasskeys() { return "credentials" in navigator && "PublicKeyCredential" in window; }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    if (!token || browserSupportsPasskeys()) return;
    setChromeNeeded(true);
    setStatus("PWFB needs Chrome on this phone to register the fingerprint/passkey.");
    const timer = window.setTimeout(() => openChromeForPasskey(), 500);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("registered") === "1") {
      setDone(true); setStatus("This phone's PWFB fingerprint/passkey is now registered.");
    }
  }, []);

  async function register() {
    setLoading(true); setError("");
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      if (!token) throw new Error("Please sign in with your email and password first.");
      if (!browserSupportsPasskeys()) { setChromeNeeded(true); openChromeForPasskey(); return; }
      setStatus("Preparing a new passkey for this phone…");
      const options = await apiRequest("/auth/passkey/register/options", { method: "POST" });
      setStatus("Follow the Android security prompt and approve this phone's fingerprint/passkey.");
      const credential = await startRegistration({ optionsJSON: options });
      const result = await apiRequest("/auth/passkey/register/verify", { method: "POST", body: JSON.stringify({ credential, challenge: options.challenge }) });
      if (!result?.verified) throw new Error(result?.message || "PWFB could not verify this passkey.");
      setDone(true); setStatus("This phone's PWFB fingerprint/passkey is now registered.");
      if (new URLSearchParams(window.location.search).get("chrome") === "1") setTimeout(returnToApp, 500);
    } catch (e: any) {
      setStatus("We could not finish passkey setup.");
      if (e?.name === "NotAllowedError") setError("Passkey setup was cancelled. Tap Register Passkey and try again.");
      else setError(e instanceof Error ? e.message : "Passkey registration failed.");
    } finally { setLoading(false); }
  }

  return <main className="pk-page"><section className="pk-card"><img className="logo" src="/pwfb-login-logo.svg" alt="PWFB"/><div className="icon">⌁</div><small>PWFB SECURITY</small><h1>Register this phone</h1><p>Your old phone's passkey stays untouched. This adds a separate passkey for this phone.</p><div className="steps"><div><b>1</b> Sign in normally first</div><div><b>2</b> Tap Register Passkey</div><div><b>3</b> Approve the Android fingerprint/security prompt</div></div><div className={`status ${done ? "success" : error ? "error" : ""}`}>{status}</div>{error && <div className="errorBox">{error}</div>}{chromeNeeded && !done ? <button onClick={openChromeForPasskey}>Open PWFB in Chrome</button> : done ? <button onClick={() => router.back()}>Continue to PWFB</button> : <button disabled={loading} onClick={register}>{loading ? "Registering…" : "Register Passkey"}</button>}<button className="cancel" onClick={() => router.back()}>Cancel</button></section><style jsx>{`*{box-sizing:border-box}.pk-page{min-height:100dvh;padding:18px;display:grid;place-items:center;background:linear-gradient(145deg,#075d2a,#087534);font-family:Inter,system-ui,sans-serif}.pk-card{width:min(450px,100%);padding:28px 24px;border-radius:22px;background:#fff;text-align:center;box-shadow:0 24px 70px rgba(0,0,0,.25)}.logo{width:min(260px,88%);margin-bottom:14px}.icon{margin:auto;width:66px;height:66px;border-radius:50%;display:grid;place-items:center;background:#eaf7ef;color:#087534;font-size:38px}.pk-card small{display:block;color:#f47712;font-weight:900;letter-spacing:2px;margin:10px}.pk-card h1{color:#087534;margin:8px 0}.pk-card p{color:#657169;font-size:13px;line-height:1.6}.steps{display:grid;gap:8px;text-align:left;margin:18px 0}.steps div{padding:10px;border-radius:9px;background:#f5f8f6;color:#435048;font-size:12px}.steps b{display:inline-grid;place-items:center;width:24px;height:24px;margin-right:8px;border-radius:50%;background:#087534;color:#fff}.status,.errorBox{padding:10px;border-radius:9px;margin:10px 0;font-size:11px;background:#f5f8f6;color:#59635d}.success{background:#eaf7ef;color:#087534}.error,.errorBox{background:#fff4e5;color:#9b4800}.pk-card button{width:100%;height:48px;border:0;border-radius:9px;background:#087534;color:#fff;font-weight:900}.pk-card button:disabled{opacity:.6}.pk-card .cancel{margin-top:10px;background:none;color:#68736d;height:36px;font-weight:500}`}</style></main>;
}
