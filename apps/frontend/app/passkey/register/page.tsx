"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [nativeApp, setNativeApp] = useState(false);
  const [supported, setSupported] = useState(true);

  const token = typeof window !== "undefined"
    ? localStorage.getItem("token") || sessionStorage.getItem("token") || ""
    : "";

  const stepState = useMemo(() => {
    if (message) return "complete";
    if (loading) return "active";
    return "ready";
  }, [loading, message]);

  const register = async () => {
    setError("");
    setMessage("");
    setLoading(true);

    try {
      if (!token) throw new Error("Please sign in first before registering a fingerprint.");

      if (window.PWFBNative?.registerPasskey) {
        setMessage("Waiting for your Android security prompt…");
        await new Promise<void>((resolve) => {
          let done = false;
          const finish = () => {
            if (!done) {
              done = true;
              resolve();
            }
          };

          window.__pwfbNativePasskeyStatus = (text) => setMessage(text);
          window.__pwfbNativePasskeyResult = (payload) => {
            if (payload?.ok) {
              setMessage(payload.message || "Fingerprint registered successfully.");
            } else {
              setError(payload?.message || "Fingerprint registration failed.");
              setMessage("");
            }
            finish();
          };

          window.PWFBNative!.registerPasskey(true, token);
          window.setTimeout(() => {
            if (!done) {
              setError("Fingerprint registration timed out. Please try again.");
              setMessage("");
              finish();
            }
          }, 60000);
        });
        return;
      }

      if (!("credentials" in navigator) || !("PublicKeyCredential" in window)) {
        throw new Error("Fingerprint/passkey authentication is not available on this device.");
      }

      await apiRequest("/auth/passkey/unregister-all", { method: "POST" });
      const options = await apiRequest("/auth/passkey/register/options", {
        method: "POST",
        body: JSON.stringify({ replaceExisting: true }),
      });
      const credential = await startRegistration({ optionsJSON: options });
      await apiRequest("/auth/passkey/register/verify", {
        method: "POST",
        body: JSON.stringify({ credential, challenge: options.challenge }),
      });
      setMessage("Fingerprint registered successfully on this device.");
    } catch (e: any) {
      setError(e?.message || "Fingerprint registration failed.");
      setMessage("");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const isNative = typeof window !== "undefined" && !!window.PWFBNative;
    setNativeApp(isNative);
    setSupported(Boolean(
      ("credentials" in navigator) && ("PublicKeyCredential" in window)
    ));

    return () => {
      delete window.__pwfbNativePasskeyStatus;
      delete window.__pwfbNativePasskeyResult;
    };
  }, []);

  return (
    <main className="passkey-page">
      <section className="passkey-shell">
        <div className="security-topline" />

        <header className="brand-row">
          <div className="brand-mark">
            <img src="/pwfb-login-logo.svg" alt="PWFB" />
          </div>
          <div className="secure-badge">
            <span className="shield">✓</span>
            Secure setup
          </div>
        </header>

        <div className="content">
          <div className="icon-orbit" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="fingerprint-icon">
              <span>⌁</span>
            </div>
          </div>

          <div className="eyebrow">PWFB SECURITY</div>
          <h1>Register your fingerprint</h1>
          <p className="intro">
            Add this device as a trusted PWFB sign-in method. Your phone will use
            its secure fingerprint or screen-lock protection to approve future logins.
          </p>

          <div className="device-card">
            <div className="device-icon">▣</div>
            <div>
              <strong>{nativeApp ? "Android security" : "Device passkey"}</strong>
              <span>{nativeApp ? "Fingerprint / device security prompt" : "Biometric or device security"}</span>
            </div>
            <span className="status-dot" />
          </div>

          <div className="steps" aria-label="Fingerprint registration steps">
            <div className={`step ${stepState !== "ready" ? "done" : "current"}`}>
              <span>1</span>
              <div><b>Start secure setup</b><small>Confirm this device</small></div>
            </div>
            <div className={`step ${stepState === "active" ? "current" : stepState === "complete" ? "done" : ""}`}>
              <span>2</span>
              <div><b>Verify your fingerprint</b><small>Follow the security prompt</small></div>
            </div>
            <div className={`step ${stepState === "complete" ? "done" : ""}`}>
              <span>3</span>
              <div><b>Fingerprint saved</b><small>Use it for faster sign-in</small></div>
            </div>
          </div>

          {message && (
            <div className="success" role="status">
              <span>✓</span>
              <div>
                <strong>{loading ? "Security check in progress" : "Fingerprint registered"}</strong>
                <p>{message}</p>
              </div>
            </div>
          )}

          {error && (
            <div className="error" role="alert">
              <span>!</span>
              <div>
                <strong>Registration needs attention</strong>
                <p>{error}</p>
              </div>
            </div>
          )}

          {!supported && !nativeApp && !loading && !message && (
            <div className="warning" role="status">
              Fingerprint/passkey support is not available in this browser. Use the PWFB Android app or a supported browser/device.
            </div>
          )}

          <button
            type="button"
            className="register-button"
            onClick={register}
            disabled={loading || (!supported && !nativeApp)}
          >
            <span className="button-icon">⌁</span>
            {loading ? "Waiting for fingerprint…" : message ? "Register Again" : "Register Fingerprint"}
            <span className="arrow">→</span>
          </button>

          <div className="privacy-note">
            <span>🔒</span>
            <p>
              <b>Your biometric data stays on your device.</b><br />
              PWFB receives a secure passkey credential, not your fingerprint.
            </p>
          </div>

          <a className="back-link" href="/login">← Back to PWFB sign in</a>
        </div>

        <footer>
          <span>PERFECT WISDOM FOR BETTER LTD</span>
          <span>Moving Forward Together For Better Living</span>
        </footer>
      </section>

      <style jsx>{`
        * { box-sizing: border-box; }
        .passkey-page {
          min-height: 100dvh;
          display: grid;
          place-items: center;
          padding: 24px;
          background:
            radial-gradient(circle at 15% 10%, rgba(244,119,18,.10), transparent 28%),
            radial-gradient(circle at 90% 85%, rgba(8,117,52,.12), transparent 32%),
            #f2f7f4;
          color: #17231c;
          font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .passkey-shell {
          width: min(610px, 100%);
          overflow: hidden;
          border: 1px solid #dce8e1;
          border-radius: 30px;
          background: #fff;
          box-shadow: 0 28px 80px rgba(5,55,28,.16);
        }
        .security-topline { height: 6px; background: linear-gradient(90deg, #087534 0 72%, #f47712 72%); }
        .brand-row { display:flex; align-items:center; justify-content:space-between; padding: 22px 28px 8px; }
        .brand-mark { width: 176px; }
        .brand-mark img { width:100%; display:block; }
        .secure-badge { display:flex; align-items:center; gap:7px; padding:8px 11px; border-radius:999px; background:#eef8f2; color:#087534; font-size:10px; font-weight:900; letter-spacing:.4px; }
        .shield { width:18px; height:18px; display:grid; place-items:center; border-radius:50%; background:#087534; color:#fff; font-size:10px; }
        .content { padding: 20px 46px 34px; text-align:center; }
        .icon-orbit { position:relative; width:116px; height:116px; margin:8px auto 20px; display:grid; place-items:center; }
        .orbit { position:absolute; inset:8px; border:1px solid rgba(8,117,52,.20); border-radius:50%; }
        .orbit-two { inset:0; border-style:dashed; border-color:rgba(244,119,18,.28); transform:rotate(24deg); }
        .fingerprint-icon { width:76px; height:76px; border-radius:24px; display:grid; place-items:center; background:linear-gradient(145deg,#087534,#0b8b40); box-shadow:0 14px 32px rgba(8,117,52,.25), inset 0 -4px 0 rgba(244,119,18,.9); color:#fff; }
        .fingerprint-icon span { font-size:48px; line-height:1; transform:rotate(-10deg); }
        .eyebrow { color:#f47712; font-size:10px; font-weight:900; letter-spacing:2px; }
        h1 { margin:7px 0 9px; color:#075e2c; font-size:32px; line-height:1.1; letter-spacing:-.8px; }
        .intro { max-width:490px; margin:0 auto; color:#68766e; font-size:13px; line-height:1.7; }
        .device-card { margin:22px 0 17px; padding:13px 15px; display:flex; align-items:center; gap:12px; text-align:left; border:1px solid #dfeae4; border-radius:14px; background:#f9fcfa; }
        .device-icon { width:38px; height:38px; display:grid; place-items:center; border-radius:11px; background:#eaf7ef; color:#087534; font-size:17px; }
        .device-card div:nth-child(2) { flex:1; }
        .device-card strong,.device-card span { display:block; }
        .device-card strong { color:#26332c; font-size:12px; }
        .device-card div span { margin-top:3px; color:#7c8881; font-size:10px; }
        .status-dot { width:9px; height:9px; border-radius:50%; background:#21a05a; box-shadow:0 0 0 4px #e4f5ea; }
        .steps { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:20px; }
        .step { min-height:83px; padding:10px 7px; border:1px solid #e2ebe6; border-radius:12px; background:#fbfdfc; }
        .step > span { width:24px; height:24px; margin:0 auto 7px; display:grid; place-items:center; border-radius:50%; background:#edf2ee; color:#7c8881; font-size:10px; font-weight:900; }
        .step b,.step small { display:block; }
        .step b { color:#526059; font-size:9px; }
        .step small { margin-top:3px; color:#9aa49e; font-size:8px; line-height:1.3; }
        .step.current { border-color:#b9dcc7; background:#f4fbf6; }
        .step.current > span { background:#087534; color:#fff; }
        .step.done > span { background:#087534; color:#fff; }
        .success,.error { display:flex; gap:11px; align-items:flex-start; text-align:left; margin:0 0 14px; padding:12px 13px; border-radius:12px; font-size:10px; }
        .success { background:#edf9f1; color:#176b3b; border:1px solid #ccebd7; }
        .error { background:#fff1f0; color:#9f2f27; border:1px solid #f1cbc7; }
        .success > span,.error > span { width:22px; height:22px; flex:none; display:grid; place-items:center; border-radius:50%; background:currentColor; color:#fff; font-weight:900; }
        .success strong,.error strong { display:block; font-size:10px; }
        .success p,.error p { margin:3px 0 0; line-height:1.5; }
        .warning { margin-bottom:14px; padding:11px 13px; border-radius:11px; background:#fff7eb; color:#8a510f; font-size:10px; line-height:1.5; border-left:3px solid #f47712; text-align:left; }
        .register-button { width:100%; height:54px; display:flex; align-items:center; justify-content:center; gap:11px; border:0; border-radius:12px; background:#087534; color:#fff; font-size:12px; font-weight:900; cursor:pointer; box-shadow:0 10px 22px rgba(8,117,52,.18); border-bottom:4px solid #f47712; }
        .register-button:hover:not(:disabled) { background:#07652d; transform:translateY(-1px); }
        .register-button:disabled { cursor:wait; opacity:.65; }
        .button-icon { font-size:23px; transform:rotate(-10deg); }
        .arrow { margin-left:auto; margin-right:15px; font-size:18px; }
        .privacy-note { margin:16px 0 11px; display:flex; align-items:flex-start; gap:9px; padding:11px 13px; border-radius:11px; background:#f6f9f7; text-align:left; }
        .privacy-note p { margin:0; color:#77827c; font-size:9px; line-height:1.55; }
        .privacy-note b { color:#536059; }
        .back-link { color:#087534; font-size:10px; font-weight:900; text-decoration:none; }
        .back-link:hover { color:#f47712; }
        footer { display:flex; justify-content:space-between; gap:10px; padding:14px 28px; border-top:1px solid #edf1ee; color:#a0aaa4; font-size:7px; letter-spacing:.5px; }
        @media (max-width:620px) {
          .passkey-page { padding:0; background:#087534; }
          .passkey-shell { min-height:100dvh; border:0; border-radius:0; box-shadow:none; }
          .brand-row { padding:19px 20px 7px; }
          .brand-mark { width:155px; }
          .secure-badge { font-size:9px; padding:7px 9px; }
          .content { padding:16px 20px 25px; }
          .icon-orbit { margin-top:8px; transform:scale(.88); }
          h1 { font-size:28px; }
          .intro { font-size:12px; }
          .steps { gap:5px; }
          .step { min-height:78px; padding:9px 4px; }
          .step b { font-size:8px; }
          .step small { font-size:7px; }
          footer { padding:13px 20px; flex-direction:column; text-align:center; }
        }
      `}</style>
    </main>
  );
}
