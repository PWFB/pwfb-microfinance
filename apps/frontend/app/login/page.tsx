"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import { apiRequest } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

declare global {
  interface Window {
    google?: any;
  }
}

function UserIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c.7-4 3.4-6 8-6s7.3 2 8 6"/></svg>; }
function LockIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>; }
function EyeIcon({ crossed = false }: { crossed?: boolean }) { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/>{crossed && <path d="M4 4l16 16"/>}</svg>; }
function FingerprintIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.2 7.2A5.3 5.3 0 0 1 12 5.7a5.3 5.3 0 0 1 5.3 5.3c0 2.2-.5 4.5-1.6 6.5"/><path d="M5.7 10.7A6.4 6.4 0 0 1 12 4.3a6.4 6.4 0 0 1 6.4 6.4c0 3-.8 5.8-2.2 8.3"/><path d="M10.1 10.3A2.2 2.2 0 0 1 12 9.2a2.2 2.2 0 0 1 2.2 2.2c0 2.1-.4 4.2-1.1 6.1"/><path d="M7.5 13.3c0 3-.7 5.1-1.7 6.7"/><path d="M11.9 13.1c0 2.7-.5 4.8-1.2 6.4"/></svg>; }

export default function LoginPage() {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const goToRoleDashboard = (role?: string) => {
    if (role === "CUSTOMER") router.replace("/customer-dashboard");
    else if (role === "SUPER_ADMIN") router.replace("/dashboard");
    else router.replace("/staff-dashboard");
  };

  const storeToken = (token: string) => {
    if (remember) {
      localStorage.setItem("token", token);
      sessionStorage.removeItem("token");
    } else {
      sessionStorage.setItem("token", token);
      localStorage.removeItem("token");
    }
  };

  async function finishLogin(data: any) {
    if (!data?.access_token) throw new Error(data?.message || "Login failed");
    storeToken(data.access_token);
    await refreshProfile();
    goToRoleDashboard(data.user?.role);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setMessage(""); setLoading(true);
    try {
      const data = await apiRequest("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      await finishLogin(data);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to connect to the server"); }
    finally { setLoading(false); }
  }

  async function handleGoogleCredential(response: any) {
    setMessage(""); setLoading(true);
    try {
      const data = await apiRequest("/auth/google", {
        method: "POST",
        body: JSON.stringify({ credential: response.credential }),
      });
      await finishLogin(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleButtonRef.current) return;

    const renderGoogleButton = () => {
      if (!window.google?.accounts?.id || !googleButtonRef.current) return;
      googleButtonRef.current.innerHTML = "";
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        logo_alignment: "left",
        width: 330,
      });
    };

    if (window.google?.accounts?.id) {
      renderGoogleButton();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener("load", renderGoogleButton, { once: true });
      return () => existing.removeEventListener("load", renderGoogleButton);
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = renderGoogleButton;
    document.head.appendChild(script);

    return () => { script.onload = null; };
  }, []);

  async function fetchJson(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.message || "Request failed");
    return data;
  }

  async function handleFingerprintLogin() {
    setMessage(""); setLoading(true);
    try {
      if (!email.trim()) throw new Error("Enter your email first, then tap Login with Fingerprint.");
      if (!browserSupportsWebAuthn()) throw new Error("Fingerprint/passkey login is not supported by this browser.");

      let optionsResponse: Response;
      let optionsData: any;

      try {
        optionsResponse = await fetch(`${API_URL}/auth/passkey/login/options`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim().toLowerCase() }),
        });
        optionsData = await optionsResponse.json().catch(() => null);
      } catch {
        throw new Error("Unable to connect to the PWFB authentication server.");
      }

      if (!optionsResponse.ok && String(optionsData?.message || "").toLowerCase().includes("no fingerprint/passkey")) {
        if (!password) throw new Error("This account has no fingerprint registered. Enter your password once and tap Login with Fingerprint again to register this device.");

        const passwordLogin = await fetchJson("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
        });
        if (!passwordLogin.access_token) throw new Error("Password verification failed");
        storeToken(passwordLogin.access_token);

        const registrationOptions = await fetchJson("/auth/passkey/register/options", {
          method: "POST",
          headers: { Authorization: `Bearer ${passwordLogin.access_token}` },
        });
        const registrationResponse = await startRegistration({ optionsJSON: registrationOptions });
        const registered = await fetchJson("/auth/passkey/register/verify", {
          method: "POST",
          headers: { Authorization: `Bearer ${passwordLogin.access_token}` },
          body: JSON.stringify(registrationResponse),
        });
        if (!registered?.verified) throw new Error("Fingerprint registration could not be completed.");
        await refreshProfile();
        goToRoleDashboard(passwordLogin.user?.role);
        return;
      }

      if (!optionsResponse.ok) throw new Error(optionsData?.message || "Fingerprint login could not be started.");

      const authenticationResponse = await startAuthentication({ optionsJSON: optionsData });
      const verified = await fetchJson("/auth/passkey/login/verify", {
        method: "POST",
        body: JSON.stringify(authenticationResponse),
      });
      await finishLogin(verified);
    } catch (error: any) {
      if (error?.name === "NotAllowedError") setMessage("Fingerprint verification was cancelled or not completed.");
      else setMessage(error instanceof Error ? error.message : "Fingerprint login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="pwfb-reference-login">
      <section className="pwfb-login-phone" aria-label="PWFB login">
        <div className="pwfb-login-inner">
          <header className="pwfb-reference-brand"><img src="/pwfb-login-logo.svg" alt="PWFB Perfect Wisdom For Better Ltd" className="pwfb-logo-art" /></header>
          <div className="pwfb-reference-welcome"><h1>Welcome Back!</h1><p>Sign in to your account</p></div>
          <form onSubmit={handleSubmit} className="pwfb-reference-form">
            <label className="pwfb-reference-input"><span className="pwfb-input-icon"><UserIcon /></span><input id="email" type="email" placeholder="Staff ID or Email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username webauthn" /></label>
            <label className="pwfb-reference-input"><span className="pwfb-input-icon"><LockIcon /></span><input id="password" type={showPassword ? "text" : "password"} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password webauthn" /><button type="button" className="pwfb-eye-button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"}><EyeIcon crossed={!showPassword} /></button></label>
            <div className="pwfb-reference-options"><label className="pwfb-reference-remember"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /><span>Remember me</span></label><button type="button" className="pwfb-reference-forgot" onClick={() => setMessage("Please contact your administrator to reset your password.")}>Forgot Password?</button></div>
            {message && <div className="pwfb-reference-message" role="alert">{message}</div>}
            <button type="submit" disabled={loading} className="pwfb-reference-login-button">{loading ? "Signing in..." : "Login"}</button>
            <div className="pwfb-reference-divider"><span>OR</span></div>
            <div className="pwfb-reference-secondary pwfb-google-secondary">
              {GOOGLE_CLIENT_ID ? <div ref={googleButtonRef} className="pwfb-google-button" /> : <button type="button" className="pwfb-google-fallback" onClick={() => setMessage("Google login is not configured yet. Add NEXT_PUBLIC_GOOGLE_CLIENT_ID to the frontend and GOOGLE_CLIENT_ID to the backend.")}><span className="pwfb-google-mark">G</span><span>Continue with Google</span></button>}
            </div>
            <button type="button" disabled={loading} className="pwfb-reference-secondary" onClick={handleFingerprintLogin}><span className="pwfb-fingerprint-mark"><FingerprintIcon /></span><span>Login with Fingerprint</span></button>
          </form>
          <footer className="pwfb-reference-footer"><span>Secure</span><i>•</i><span>Reliable</span><i>•</i><span>Always With You</span></footer>
        </div>
        <div className="pwfb-reference-wave" aria-hidden="true" />
      </section>
      <style jsx>{`
        .pwfb-reference-login{min-height:100dvh;width:100%;display:flex;align-items:center;justify-content:center;padding:16px;background:#eef3ef}
        .pwfb-login-phone{position:relative;width:min(100%,420px);aspect-ratio:9/16;min-height:620px;max-height:calc(100dvh - 24px);overflow:hidden;border:1px solid #d9e3dc;border-radius:28px;background:#fff;box-shadow:0 20px 55px rgba(12,63,34,.16)}
        .pwfb-login-inner{position:relative;z-index:2;height:100%;overflow:auto;padding:30px 24px 24px;scrollbar-width:none}.pwfb-login-inner::-webkit-scrollbar{display:none}
        .pwfb-reference-brand{text-align:center;margin:2px auto 0}.pwfb-logo-art{display:block;width:270px;max-width:94%;height:auto;margin:0 auto;object-fit:contain}
        .pwfb-reference-welcome{text-align:center;margin:24px 0 20px}.pwfb-reference-welcome h1{margin:0;color:#0b6f31;font-size:20px;line-height:1.2;font-weight:900}.pwfb-reference-welcome p{margin:5px 0 0;color:#6b726e;font-size:11px}
        .pwfb-reference-form{display:flex;flex-direction:column;gap:12px}.pwfb-reference-input{height:46px;display:flex;align-items:center;gap:10px;padding:0 12px;border:1px solid #d6ddd9;border-radius:7px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.02)}.pwfb-reference-input:focus-within{border-color:#0f7b35;box-shadow:0 0 0 3px rgba(15,123,53,.08)}
        .pwfb-input-icon{width:20px;flex:0 0 20px;display:grid;place-items:center;color:#4c5550}.pwfb-input-icon svg,.pwfb-eye-button svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.pwfb-reference-input input{min-width:0;flex:1;border:0;outline:0;background:transparent;color:#202621;font-size:11px}.pwfb-reference-input input::placeholder{color:#777d79;opacity:1}
        .pwfb-eye-button{width:24px;height:30px;display:grid;place-items:center;padding:0;border:0;background:transparent;color:#4f5753}.pwfb-reference-options{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 1px 2px}.pwfb-reference-remember{display:flex;align-items:center;gap:7px;color:#5c625e;font-size:10px}.pwfb-reference-remember input{width:14px;height:14px;margin:0;accent-color:#0f7b35}.pwfb-reference-forgot{padding:0;border:0;background:transparent;color:#f47712;font-size:10px;font-weight:700}
        .pwfb-reference-message{padding:8px 10px;border-radius:6px;background:#fff4e5;color:#a94d00;font-size:10px;line-height:1.35;text-align:center}.pwfb-reference-login-button{height:43px;border:0;border-radius:6px;background:#087534;color:#fff;font-size:12px;font-weight:800;box-shadow:0 5px 12px rgba(8,117,52,.16)}.pwfb-reference-login-button:hover{background:#075f2b}.pwfb-reference-login-button:disabled{opacity:.65}
        .pwfb-reference-divider{display:flex;align-items:center;gap:12px;margin:0;color:#777d79;font-size:10px}.pwfb-reference-divider:before,.pwfb-reference-divider:after{content:"";height:1px;flex:1;background:#e1e5e3}.pwfb-reference-secondary{height:43px;position:relative;display:flex;align-items:center;justify-content:center;gap:9px;border:1px solid #d9dfdc;border-radius:6px;background:#fff;color:#252a27;font-size:11px;font-weight:600}.pwfb-reference-secondary:hover{background:#fafcfb;border-color:#c5d1c9}.pwfb-reference-secondary:disabled{opacity:.6}
        .pwfb-google-secondary{padding:0;overflow:hidden}.pwfb-google-button{width:100%;height:43px;display:flex;align-items:center;justify-content:center}.pwfb-google-fallback{position:relative;width:100%;height:43px;border:0;background:#fff;color:#252a27;font-size:11px;font-weight:600}.pwfb-google-mark{position:absolute;left:14px;font-size:18px;line-height:1;font-family:Arial,sans-serif;font-weight:800;color:#4285f4}
        .pwfb-fingerprint-mark{position:absolute;left:14px;display:grid;place-items:center;color:#0f8a45}.pwfb-fingerprint-mark svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.45;stroke-linecap:round;stroke-linejoin:round}
        .pwfb-reference-footer{position:relative;z-index:3;display:flex;align-items:center;justify-content:center;gap:6px;margin-top:24px;color:#77807a;font-size:9px}.pwfb-reference-footer i{color:#c0c7c2;font-style:normal}.pwfb-reference-wave{position:absolute;z-index:1;left:-8%;right:-8%;bottom:-48px;height:105px;border-radius:50% 50% 0 0;background:linear-gradient(175deg,#f57912 0 12%,#f57912 12% 19%,#0d7535 20% 100%);transform:rotate(-3deg)}
        @media(max-width:560px){.pwfb-reference-login{padding:0;background:#fff}.pwfb-login-phone{width:100%;max-height:none;min-height:100dvh;aspect-ratio:9/16;border:0;border-radius:0;box-shadow:none}}@media(max-height:760px) and (min-width:561px){.pwfb-login-inner{padding-top:18px}.pwfb-reference-welcome{margin-top:12px;margin-bottom:12px}.pwfb-reference-form{gap:9px}.pwfb-reference-secondary,.pwfb-reference-login-button,.pwfb-reference-input{height:40px}.pwfb-reference-footer{margin-top:10px}}
      `}</style>
    </main>
  );
}
