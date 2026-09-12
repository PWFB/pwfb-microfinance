"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { apiRequest } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

const ENV_GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
const GOOGLE_NONCE_KEY = "pwfb_google_oidc_nonce";

declare global {
  interface Window {
    google?: any;
    PWFBNative?: { signInWithGoogle: () => void; registerPasskey: (replaceExisting: boolean, token: string) => void };
    __pwfbNativeGoogleResult?: (payload: any) => void;
    __pwfbNativePasskeyStatus?: (message: string) => void;
    __pwfbNativePasskeyResult?: (payload: any) => void;
  }
}

export default function LoginPage() {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const googleRef = useRef<HTMLDivElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [fingerprintReady, setFingerprintReady] = useState(false);
  const [nativeApp, setNativeApp] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);

  const destinationFor = (role?: string) => role === "CUSTOMER" ? "/customer-dashboard" : role === "SUPER_ADMIN" ? "/dashboard" : "/staff-dashboard";
  const registerFlow = () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("registerPasskey") === "1";

  const saveSession = (data: any) => {
    if (!data?.access_token) throw new Error(data?.message || "Login failed");
    const token = String(data.access_token);
    localStorage.setItem("token", token);
    sessionStorage.setItem("token", token);
    return token;
  };

  const goToDashboard = async (data: any) => {
    const token = saveSession(data);
    let role = data.user?.role;
    if (!role) {
      try { role = (await refreshProfile())?.role; } catch {}
    }
    window.location.assign(destinationFor(role));
    return token;
  };

  const registerFreshFingerprint = async (token: string) => {
    setMessage("Google sign-in successful. Save your fingerprint for next time…");
    if (window.PWFBNative?.registerPasskey) {
      await new Promise<void>((resolve) => {
        let finished = false;
        const finish = () => { if (!finished) { finished = true; resolve(); } };
        window.__pwfbNativePasskeyStatus = (status) => setMessage(status);
        window.__pwfbNativePasskeyResult = (payload) => {
          if (payload?.ok) setMessage("Fingerprint saved. You can now use Use fingerprint without entering Gmail.");
          else setMessage(payload?.message || "Fingerprint registration was not completed. You can still continue to your dashboard.");
          finish();
        };
        window.PWFBNative!.registerPasskey(true, token);
        window.setTimeout(finish, 30000);
      });
      return;
    }
    if (!("credentials" in navigator) || !("PublicKeyCredential" in window)) return;
    try {
      await apiRequest("/auth/passkey/unregister-all", { method: "POST" });
      const options = await apiRequest("/auth/passkey/register/options", { method: "POST", body: JSON.stringify({ replaceExisting: true }) });
      const credential = await startRegistration({ optionsJSON: options });
      await apiRequest("/auth/passkey/register/verify", { method: "POST", body: JSON.stringify({ credential, challenge: options.challenge }) });
      setMessage("Fingerprint saved. You can now use Use fingerprint without entering Gmail.");
    } catch (e: any) {
      setMessage(e?.name === "NotAllowedError" ? "Fingerprint setup was cancelled. You can register it later from Security." : "Google login succeeded. Fingerprint was not saved yet.");
    }
  };

  const completeGoogleLogin = async (data: any) => {
    const token = saveSession(data);
    await registerFreshFingerprint(token);
    let role = data.user?.role;
    if (!role) { try { role = (await refreshProfile())?.role; } catch {} }
    window.location.assign(destinationFor(role));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setMessage(""); setLoading(true);
    try { await goToDashboard(await apiRequest("/auth/login", { method: "POST", body: JSON.stringify({ email: email.trim().toLowerCase(), password }) })); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Unable to connect to PWFB"); }
    finally { setLoading(false); }
  };

  const nativeGoogleLogin = () => {
    setMessage(""); setLoading(true);
    if (!window.PWFBNative?.signInWithGoogle) { setLoading(false); setMessage("Google sign-in is not available in this browser. Use the Google button below."); return; }
    window.PWFBNative.signInWithGoogle();
  };

  const fingerprintLogin = async () => {
    setMessage(""); setLoading(true);
    try {
      if (!("credentials" in navigator) || !("PublicKeyCredential" in window)) throw new Error("Fingerprint sign-in is not available on this device.");
      const options = await apiRequest("/auth/passkey/login/options", { method: "POST", body: JSON.stringify({}) });
      const credential = await startAuthentication({ optionsJSON: options });
      const data = await apiRequest("/auth/passkey/login/verify", { method: "POST", body: JSON.stringify({ credential, challenge: options.challenge }) });
      await goToDashboard(data);
    } catch (e: any) {
      if (e?.name === "NotAllowedError") setMessage("Fingerprint sign-in was cancelled. Try again or use Google.");
      else setMessage(e instanceof Error ? e.message : "No PWFB fingerprint is registered on this device yet. Sign in with Google once to save it.");
    } finally { setLoading(false); }
  };

  useEffect(() => {
    const isApp = typeof window !== "undefined" && !!window.PWFBNative;
    setNativeApp(isApp);
    setFingerprintReady(Boolean(("credentials" in navigator) && ("PublicKeyCredential" in window)));
    if (!isApp) {
      let active = true;
      const load = async () => {
        try {
          const config = await apiRequest("/auth/google/config", { method: "GET" });
          const clientId = String(config?.client_id || ENV_GOOGLE_CLIENT_ID || "").trim();
          if (!clientId) return;
          const render = () => {
            if (!active || !window.google?.accounts?.id || !googleRef.current) return;
            const bytes = new Uint8Array(32); crypto.getRandomValues(bytes);
            const nonce = Array.from(bytes, v => v.toString(16).padStart(2, "0")).join("");
            localStorage.setItem(GOOGLE_NONCE_KEY, nonce);
            googleRef.current.innerHTML = "";
            window.google.accounts.id.initialize({ client_id: clientId, callback: async (response: any) => {
              try { const data = await apiRequest("/auth/google", { method: "POST", body: JSON.stringify({ credential: response.credential, client_id: clientId, nonce: localStorage.getItem(GOOGLE_NONCE_KEY) }) }); localStorage.removeItem(GOOGLE_NONCE_KEY); await completeGoogleLogin(data); }
              catch (e) { setMessage(e instanceof Error ? e.message : "Google sign-in failed"); setLoading(false); }
            }, nonce, auto_select: false, cancel_on_tap_outside: false, use_fedcm_for_prompt: false, context: "signin" });
            window.google.accounts.id.renderButton(googleRef.current, { type: "standard", theme: "outline", size: "large", text: "signin_with", shape: "rectangular", logo_alignment: "left", width: 350 });
            setGoogleReady(true);
          };
          if (window.google?.accounts?.id) render();
          else { const script = document.createElement("script"); script.src = "https://accounts.google.com/gsi/client"; script.async = true; script.defer = true; script.onload = render; document.head.appendChild(script); }
        } catch {}
      };
      load(); return () => { active = false; };
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.__pwfbNativeGoogleResult = async (payload) => {
      if (!payload?.ok || !payload?.access_token) { setMessage(payload?.message || "Google sign-in could not be completed."); setLoading(false); return; }
      try { await completeGoogleLogin({ access_token: payload.access_token, user: payload.user }); }
      catch (e) { setMessage(e instanceof Error ? e.message : "Google sign-in failed"); setLoading(false); }
    };
    return () => { delete window.__pwfbNativeGoogleResult; };
  }, []);

  return <main className="auth-page"><section className="auth-shell"><aside className="hero"><div className="logo-wrap"><img src="/pwfb-login-logo.svg" alt="PWFB"/></div><div className="hero-copy"><span>PWFB MICROFINANCE</span><h1>Secure banking.<br/><em>Simple access.</em></h1><p>One account. One dashboard. Your fingerprint when you need it.</p></div><div className="hero-bottom"><b>● Secure</b><b>● Fast</b><b>● Reliable</b></div></aside><section className="card"><div className="mobile-logo"><img src="/pwfb-login-logo.svg" alt="PWFB"/></div><div className="heading"><span>WELCOME BACK</span><h2>Sign in to PWFB</h2><p>Choose the quickest secure way to access your account.</p></div>{message && <div className="notice">{message}</div>}<form onSubmit={submit}><label><span>Email address</span><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="username" required/></label><label><span>Password</span><div className="password"><input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password" required/><button type="button" onClick={() => setShowPassword(v => !v)}>{showPassword ? "Hide" : "Show"}</button></div></label><button className="primary" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</button></form><div className="divider"><i/>OR<i/></div>{nativeApp ? <button className="google-native" type="button" disabled={loading} onClick={nativeGoogleLogin}><span className="g">G</span> Continue with Google</button> : <div className={`google-web ${googleReady ? "ready" : ""}`} ref={googleRef}/>}<button className="fingerprint" type="button" disabled={loading || !fingerprintReady} onClick={fingerprintLogin}><span className="finger">⌁</span><span><b>Use fingerprint</b><small>No email needed</small></span><strong>›</strong></button><p className="hint">After your first Google sign-in, PWFB saves this device fingerprint. Next time, tap <b>Use fingerprint</b> directly.</p><footer>Perfect Wisdom For Better Ltd · Moving Forward Together For Better Living</footer></section></section><style jsx>{`*{box-sizing:border-box}.auth-page{min-height:100dvh;background:#f2f7f4;display:grid;place-items:center;padding:28px;font-family:Inter,system-ui,sans-serif;color:#18221d}.auth-shell{width:min(1080px,100%);min-height:650px;display:grid;grid-template-columns:46% 54%;background:#fff;border-radius:30px;overflow:hidden;box-shadow:0 28px 80px rgba(5,55,28,.18)}.hero{padding:54px;background:linear-gradient(155deg,#064c28,#087534);color:#fff;display:flex;flex-direction:column;position:relative}.hero:after{content:"";position:absolute;bottom:0;left:0;right:0;height:7px;background:#f47712}.logo-wrap{background:#fff;border-radius:13px;padding:9px 12px;width:270px;border-bottom:4px solid #f47712}.logo-wrap img{width:100%;display:block}.hero-copy{margin:auto 0}.hero-copy>span{font-size:11px;letter-spacing:2px;color:#ffb06d;font-weight:900}.hero-copy h1{font-size:48px;line-height:1.02;margin:14px 0;font-weight:900}.hero-copy h1 em{font-style:normal;color:#ffad68}.hero-copy p{max-width:370px;line-height:1.7;color:#dcebe2;font-size:14px}.hero-bottom{display:flex;gap:22px;font-size:11px;color:#d5e7db}.hero-bottom b{font-weight:600}.card{padding:54px 65px;display:flex;flex-direction:column;justify-content:center}.mobile-logo{display:none}.heading{margin-bottom:23px}.heading span{font-size:10px;letter-spacing:2px;color:#f47712;font-weight:900}.heading h2{margin:6px 0;color:#075e2c;font-size:31px}.heading p{margin:0;color:#718078;font-size:12px}.card form{display:grid;gap:14px}.card label>span{display:block;font-size:11px;font-weight:800;margin-bottom:6px;color:#536059}.card input{width:100%;height:48px;border:1px solid #dbe5df;border-radius:10px;padding:0 13px;outline:none;font-size:13px;background:#fbfdfc}.card input:focus{border-color:#087534;box-shadow:0 0 0 3px #08753412}.password{position:relative}.password input{padding-right:60px}.password button{position:absolute;right:8px;top:8px;height:32px;border:0;background:transparent;color:#f47712;font-size:10px;font-weight:800}.primary{height:49px;border:0;border-radius:10px;background:#087534;color:#fff;font-weight:900;border-bottom:4px solid #f47712}.divider{display:flex;align-items:center;gap:12px;color:#98a19c;font-size:9px;margin:19px 0 13px}.divider i{height:1px;background:#e5ebe7;flex:1}.google-native,.fingerprint{width:100%;height:50px;border-radius:10px;background:#fff;border:1px solid #dce5df}.google-native{display:flex;align-items:center;justify-content:center;gap:12px;font-size:13px;font-weight:800;color:#27312c}.g{font-size:20px;font-weight:900;color:#4285f4}.google-web{min-height:50px;display:flex;justify-content:center}.google-web:not(.ready){visibility:hidden}.fingerprint{margin-top:11px;display:flex;align-items:center;padding:0 14px;gap:12px;text-align:left;border-bottom:3px solid #f47712}.finger{width:32px;height:32px;border-radius:8px;background:#eaf7ef;color:#087534;display:grid;place-items:center;font-size:21px}.fingerprint span:nth-child(2){flex:1}.fingerprint b,.fingerprint small{display:block}.fingerprint b{font-size:12px}.fingerprint small{font-size:9px;color:#7a857e;margin-top:2px}.fingerprint strong{font-size:23px;color:#087534}.notice{padding:10px 12px;border-radius:9px;background:#fff3e7;color:#974700;border-left:3px solid #f47712;font-size:11px;margin-bottom:12px}.hint{font-size:10px;line-height:1.6;text-align:center;color:#7b867f;margin:12px 0}.hint b{color:#087534}.card footer{text-align:center;font-size:8px;color:#a0aaa4;margin-top:13px}@media(max-width:760px){.auth-page{padding:0;background:#087534}.auth-shell{min-height:100dvh;border-radius:0;display:block}.hero{height:145px;padding:20px 24px;align-items:center;justify-content:center}.hero:after{height:6px}.logo-wrap{width:240px}.hero-copy,.hero-bottom{display:none}.card{min-height:calc(100dvh - 145px);padding:28px 24px;justify-content:flex-start}.mobile-logo{display:none}.heading h2{font-size:26px}.google-native,.fingerprint{height:52px}}`}</style></main>;
}
