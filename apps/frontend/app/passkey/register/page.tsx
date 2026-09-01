"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { startRegistration } from "@simplewebauthn/browser";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

async function request(endpoint: string, token: string, options: RequestInit = {}) {
  const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) } });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || "Request failed");
  return data;
}

function openChrome() {
  const url = window.location.href;
  try {
    const chromeUrl = `intent://${url.replace(/^https?:\/\//, "")}#Intent;scheme=https;package=com.android.chrome;end`;
    window.location.href = chromeUrl;
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export default function RegisterPasskeyPage() {
  const router = useRouter();
  const [status, setStatus] = useState("Ready to secure your PWFB account.");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [newDevice, setNewDevice] = useState(false);
  const [needsChrome, setNeedsChrome] = useState(false);

  useEffect(() => { setNewDevice(new URLSearchParams(window.location.search).get("newDevice") === "1"); }, []);

  async function register() {
    setLoading(true); setError(""); setNeedsChrome(false);
    setStatus(newDevice ? "Preparing a new passkey for this phone…" : "Preparing secure passkey registration…");
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      if (!token) throw new Error("Please connect to Google and sign in to PWFB first.");
      if (!("credentials" in navigator) || !("PublicKeyCredential" in window)) throw new Error("PASSKEY_BROWSER_UNSUPPORTED");
      setStatus("Follow the Android security prompt to save your fingerprint/passkey.");
      const options = await request("/auth/passkey/register/options", token, { method: "POST" });
      const credential = await startRegistration({ optionsJSON: options });
      const result = await request("/auth/passkey/register/verify", token, { method: "POST", body: JSON.stringify({ credential, challenge: options.challenge }) });
      if (!result?.verified) throw new Error("PWFB could not verify the new passkey.");
      setDone(true); setStatus("Your new PWFB passkey is registered and ready to use on this phone.");
    } catch (e: any) {
      if (e?.message === "PASSKEY_BROWSER_UNSUPPORTED" || e?.name === "NotSupportedError") {
        setNeedsChrome(true);
        setError("This Android app browser did not expose passkeys. Open this PWFB page in Chrome to use your phone fingerprint, then return to the app.");
      } else if (e?.name === "NotAllowedError") setError("Passkey setup was cancelled. Tap Register Passkey to try again.");
      else setError(e instanceof Error ? e.message : "Passkey registration failed.");
      setStatus("We could not finish passkey setup.");
    } finally { setLoading(false); }
  }

  const finish = () => { sessionStorage.removeItem("pwfb_new_device_passkey"); router.replace(newDevice ? "/dashboard" : "/login"); };

  return <main className="pk-page"><section className="pk-card"><div className="pk-logo"><img src="/pwfb-login-logo.svg" alt="PWFB" /></div><div className="pk-icon">⌁</div><p className="pk-label">PWFB SECURITY</p><h1>{newDevice ? "Set up your new phone" : "Set up your new passkey"}</h1><p className="pk-copy">{newDevice ? "Your old phone passkey stays untouched. We are adding a new passkey to this phone so you can use its fingerprint to sign in." : "Use your phone fingerprint, face unlock, or device screen lock for a faster and more secure PWFB login."}</p><div className="pk-steps"><div><b>1</b><span>Tap <strong>Register Passkey</strong></span></div><div><b>2</b><span>Approve this phone's Android security prompt</span></div><div><b>3</b><span>Use this phone's fingerprint next time</span></div></div><div className={`pk-status ${error ? "error" : done ? "success" : ""}`}>{status}</div>{error && <div className="pk-error" role="alert">{error}</div>}{needsChrome && <button className="pk-chrome" onClick={openChrome}>Open PWFB in Chrome</button>}{done ? <button className="pk-button" onClick={finish}>{newDevice ? "Continue to PWFB" : "Back to Login"}</button> : <button className="pk-button" disabled={loading} onClick={register}>{loading ? "Setting up…" : "Register Passkey"}</button>}<button className="pk-back" onClick={() => router.back()}>Cancel</button></section><style jsx>{`*{box-sizing:border-box}.pk-page{min-height:100dvh;padding:24px;display:grid;place-items:center;background:linear-gradient(145deg,#075d2a,#087534);font-family:Inter,ui-sans-serif,system-ui,sans-serif}.pk-card{width:min(100%,450px);padding:30px;border-radius:24px;background:#fff;box-shadow:0 24px 70px rgba(0,0,0,.25);text-align:center}.pk-logo img{width:min(250px,80%);height:auto;margin-bottom:20px}.pk-icon{width:72px;height:72px;margin:0 auto 12px;display:grid;place-items:center;border-radius:50%;background:#eaf7ef;color:#087534;font-size:42px;font-weight:900;transform:rotate(180deg)}.pk-label{margin:0;color:#f47712;font-size:10px;font-weight:900;letter-spacing:2px}.pk-card h1{margin:8px 0;color:#087534;font-size:25px}.pk-copy{margin:0 auto 20px;max-width:370px;color:#66736b;font-size:13px;line-height:1.6}.pk-steps{display:grid;gap:9px;text-align:left;margin:20px 0}.pk-steps div{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;background:#f5f8f6;color:#435048;font-size:12px}.pk-steps b{width:25px;height:25px;display:grid;place-items:center;border-radius:50%;background:#087534;color:#fff;font-size:11px}.pk-status{margin:14px 0;padding:11px;border-radius:9px;background:#f5f8f6;color:#59635d;font-size:11px;line-height:1.5}.pk-status.success{background:#eaf7ef;color:#087534}.pk-status.error{background:#fff4e5;color:#9b4800}.pk-error{margin:10px 0;padding:10px;border-radius:9px;background:#fff4e5;color:#9b4800;font-size:11px}.pk-button,.pk-chrome{width:100%;height:48px;border:0;border-radius:9px;color:#fff;font-weight:900;font-size:13px}.pk-button{background:#087534}.pk-chrome{margin-bottom:10px;background:#4285f4}.pk-button:disabled{opacity:.6}.pk-back{margin-top:12px;border:0;background:none;color:#68736d;font-size:11px}@media(max-width:520px){.pk-page{padding:14px}.pk-card{padding:24px 19px;border-radius:20px}.pk-card h1{font-size:22px}.pk-logo img{width:min(235px,88%)}}`}</style></main>;
}
