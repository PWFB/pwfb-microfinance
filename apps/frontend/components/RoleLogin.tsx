"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../lib/api";
import { useAuth } from "../context/AuthContext";

type LoginMode = "SUPER_ADMIN" | "STAFF" | "CUSTOMER";
type GooglePayload = { credential: string; client_id: string; nonce: string; loginMode: LoginMode };

declare global {
  interface Window {
    google?: any;
    PWFBNative?: { signInWithGoogle: (loginMode?: string) => void; registerPasskey?: (replaceExisting: boolean, token: string) => void };
    __pwfbNativeGoogleResult?: (payload: any) => void;
  }
}

const GOOGLE_NONCE_PREFIX = "pwfb_google_oidc_nonce_";
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

const cards: Array<{ mode: LoginMode; title: string; subtitle: string; placeholder: string; icon: string; tone: string }> = [
  { mode: "SUPER_ADMIN", title: "Super Admin Login", subtitle: "Access the complete system management and administrative controls.", placeholder: "Email Address", icon: "🔐", tone: "admin" },
  { mode: "STAFF", title: "Staff Login", subtitle: "Access your work dashboard and manage your assigned operations.", placeholder: "Email Address", icon: "👥", tone: "staff" },
  { mode: "CUSTOMER", title: "Customer Login", subtitle: "Access your account, check your balance, make transactions and more.", placeholder: "Customer ID / Email / Phone Number", icon: "👤", tone: "customer" },
];

export default function RoleLogin() {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const googleRefs = useRef<Record<LoginMode, HTMLDivElement | null>>({ SUPER_ADMIN: null, STAFF: null, CUSTOMER: null });
  const [values, setValues] = useState<Record<LoginMode, string>>({ SUPER_ADMIN: "", STAFF: "", CUSTOMER: "" });
  const [passwords, setPasswords] = useState<Record<LoginMode, string>>({ SUPER_ADMIN: "", STAFF: "", CUSTOMER: "" });
  const [showPassword, setShowPassword] = useState<Record<LoginMode, boolean>>({ SUPER_ADMIN: false, STAFF: false, CUSTOMER: false });
  const [remember, setRemember] = useState<Record<LoginMode, boolean>>({ SUPER_ADMIN: true, STAFF: true, CUSTOMER: true });
  const [loading, setLoading] = useState<LoginMode | null>(null);
  const [message, setMessage] = useState("");
  const [nativeApp, setNativeApp] = useState(false);
  const [googleReady, setGoogleReady] = useState<Record<LoginMode, boolean>>({ SUPER_ADMIN: false, STAFF: false, CUSTOMER: false });
  const [expanded, setExpanded] = useState<LoginMode>("SUPER_ADMIN");
  const openMode = (mode: LoginMode) => setExpanded(mode);

  const destination = (role?: string) => role === "CUSTOMER" ? "/customer-dashboard" : role === "SUPER_ADMIN" ? "/dashboard" : "/staff-dashboard";

  const saveSession = (data: any, mode: LoginMode) => {
    if (!data?.access_token) throw new Error(data?.message || "Login failed");
    const token = String(data.access_token);
    if (remember[mode]) localStorage.setItem("token", token); else localStorage.removeItem("token");
    sessionStorage.setItem("token", token);
    localStorage.setItem("access_token", token);
    sessionStorage.setItem("access_token", token);
    localStorage.setItem("user", JSON.stringify(data.user || {}));
    sessionStorage.setItem("user", JSON.stringify(data.user || {}));
  };

  const completeLogin = async (data: any, mode: LoginMode) => {
    saveSession(data, mode);
    const role = data.user?.role || (await refreshProfile())?.role;
    if ((mode === "SUPER_ADMIN" && role !== "SUPER_ADMIN") || (mode === "STAFF" && role === "SUPER_ADMIN") || (mode === "CUSTOMER" && role !== "CUSTOMER")) {
      localStorage.removeItem("token"); localStorage.removeItem("access_token"); localStorage.removeItem("user");
      sessionStorage.removeItem("token"); sessionStorage.removeItem("access_token"); sessionStorage.removeItem("user");
      throw new Error(mode === "SUPER_ADMIN" ? "This account is not a Super Admin account. Use Staff or Customer Login." : mode === "STAFF" ? "Super Admin accounts must use Super Admin Login." : "This account is not a Customer account. Use Staff or Super Admin Login.");
    }
    window.location.assign(destination(role));
  };

  const login = async (event: React.FormEvent, mode: LoginMode) => {
    event.preventDefault(); setMessage(""); setLoading(mode);
    try {
      await completeLogin(await apiRequest("/auth/login", { method: "POST", body: JSON.stringify({ identifier: values[mode].trim(), password: passwords[mode], loginMode: mode }) }), mode);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to connect to PWFB"); setLoading(null); }
  };

  const googleLogin = async (payload: GooglePayload) => {
    setMessage(""); setLoading(payload.loginMode);
    try {
      await completeLogin(await apiRequest("/auth/google", { method: "POST", body: JSON.stringify(payload) }), payload.loginMode);
      localStorage.removeItem(GOOGLE_NONCE_PREFIX + payload.loginMode);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Google sign-in failed."); setLoading(null); }
  };

  useEffect(() => {
    const app = typeof window !== "undefined" && !!window.PWFBNative;
    setNativeApp(app);
    if (app) return;
    let active = true;
    const renderGoogle = (clientId: string) => {
      if (!active || !window.google?.accounts?.id) return;
      cards.forEach(({ mode }) => {
        const host = googleRefs.current[mode];
        if (!host) return;
        const configNonce = new Uint8Array(32); crypto.getRandomValues(configNonce);
        const nonce = Array.from(configNonce, value => value.toString(16).padStart(2, "0")).join("");
        localStorage.setItem(GOOGLE_NONCE_PREFIX + mode, nonce);
        host.innerHTML = "";
        window.google.accounts.id.initialize({
          client_id: clientId,
          nonce,
          auto_select: false,
          cancel_on_tap_outside: false,
          use_fedcm_for_prompt: false,
          context: "signin",
          callback: (response: any) => googleLogin({
            credential: response.credential,
            client_id: clientId,
            nonce: localStorage.getItem(GOOGLE_NONCE_PREFIX + mode) || nonce,
            loginMode: mode,
          }),
        });
        window.google.accounts.id.renderButton(host, { type: "standard", theme: "outline", size: "large", text: "continue_with", shape: "rectangular", logo_alignment: "left", width: 360 });
        setGoogleReady(previous => ({ ...previous, [mode]: true }));
      });
    };
    const load = async () => {
      try {
        const config = await apiRequest("/auth/google/config", { method: "GET" });
        const clientId = String(config?.client_id || GOOGLE_CLIENT_ID).trim();
        if (!clientId) return;
        if (window.google?.accounts?.id) { renderGoogle(clientId); return; }
        const script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true; script.defer = true; script.onload = () => renderGoogle(clientId);
        document.head.appendChild(script);
      } catch {}
    };
    load();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.__pwfbNativeGoogleResult = async (payload) => {
      const mode = (payload?.loginMode || "CUSTOMER") as LoginMode;
      if (!payload?.ok || !payload?.access_token) { setMessage(payload?.message || "Google sign-in could not be completed."); setLoading(null); return; }
      try { await completeLogin({ access_token: payload.access_token, user: payload.user }, mode); }
      catch (error) { setMessage(error instanceof Error ? error.message : "Google sign-in failed."); setLoading(null); }
    };
    return () => { delete window.__pwfbNativeGoogleResult; };
  }, [remember]);

  const nativeGoogle = (mode: LoginMode) => {
    setMessage(""); setLoading(mode);
    if (!window.PWFBNative?.signInWithGoogle) { setLoading(null); setMessage("Google sign-in is not available here. Use the Google button."); return; }
    window.PWFBNative.signInWithGoogle(mode);
  };

  const forgotPassword = () => setMessage("Password reset is available through PWFB account support. Please contact your branch or administrator.");

  return (
    <main className="pwfb-login-page">
      <div className="pwfb-login-brand"><img src="/pwfb-login-logo.svg" alt="PWFB Microfinance" /><p>Empowering People <b>•</b> Building Better Futures</p></div>
      {message && <div className="pwfb-login-notice" role="alert">{message}</div>}
      <section className="pwfb-login-grid">
        {cards.map(card => (
          <article className={`pwfb-login-card ${card.tone}`} key={card.mode}>
            <button type="button" className="pwfb-card-toggle" aria-expanded={expanded === card.mode} onClick={() => openMode(card.mode)}>
              <span className="pwfb-card-icon">{card.icon}</span>
              <span className="pwfb-card-heading"><strong>{card.title}</strong><small>{card.subtitle}</small></span>
              <span className={`pwfb-card-chevron ${expanded === card.mode ? "open" : ""}`}>⌄</span>
            </button>
            {expanded === card.mode && <div className="pwfb-card-body">
<form onSubmit={event => login(event, card.mode)}>
              <label><span>{card.mode === "CUSTOMER" ? "Customer Login ID" : "Email Address"}</span><div className="pwfb-input"><b>♙</b><input value={values[card.mode]} onChange={e => setValues(v => ({ ...v, [card.mode]: e.target.value }))} placeholder={card.placeholder} type={card.mode === "CUSTOMER" ? "text" : "email"} autoComplete="username" required /></div></label>
              <label><span>Password</span><div className="pwfb-input"><b>▣</b><input value={passwords[card.mode]} onChange={e => setPasswords(v => ({ ...v, [card.mode]: e.target.value }))} placeholder="Password" type={showPassword[card.mode] ? "text" : "password"} autoComplete="current-password" required /><button type="button" onClick={() => setShowPassword(v => ({ ...v, [card.mode]: !v[card.mode] }))}>{showPassword[card.mode] ? "Hide" : "◉"}</button></div></label>
              <div className="pwfb-options"><label className="remember"><input type="checkbox" checked={remember[card.mode]} onChange={e => setRemember(v => ({ ...v, [card.mode]: e.target.checked }))} /> <span>Remember me</span></label><button type="button" onClick={forgotPassword}>Forgot password?</button></div>
              <button className="pwfb-login-submit" disabled={loading !== null}>{loading === card.mode ? "Signing in…" : "Login →"}</button>
            </form>
            <div className="pwfb-divider"><i /><span>Other Login Options</span><i /></div>
            {nativeApp ? <button className="pwfb-google-native" type="button" disabled={loading !== null} onClick={() => nativeGoogle(card.mode)}><strong>G</strong> Continue with Google</button> : <div className={`pwfb-google-web ${googleReady[card.mode] ? "ready" : ""}`} ref={node => { googleRefs.current[card.mode] = node; }} />}
            {card.mode === "SUPER_ADMIN" && <div className="pwfb-alt-grid"><button type="button" onClick={() => openMode("STAFF")}><b>👥</b><span><strong>Staff Login</strong><small>For employees</small></span></button><button type="button" onClick={() => openMode("CUSTOMER")}><b>👤</b><span><strong>Customer Login</strong><small>For existing customers</small></span></button></div>}
            {card.mode === "STAFF" && <div className="pwfb-help"><span>Not a staff member?</span><button type="button" onClick={() => document.querySelector<HTMLInputElement>("input[placeholder='Customer ID / Email / Phone Number']")?.focus()}>Customer Login →</button></div>}
            {card.mode === "CUSTOMER" && <div className="pwfb-help customer-help"><span><strong>New customer?</strong><small>Register for a PWFB customer account.</small></span><button type="button" onClick={() => router.push("/register")}>Create Account →</button></div>}
            </div>}
            <footer>🔒 PWFB Microfinance<br /><small>Secure • Reliable • Trusted</small></footer>
          </article>
        ))}
      </section>
      <p className="pwfb-login-footer">Perfect Wisdom For Better Ltd · Moving Forward Together For Better Living</p>
      <style jsx>{`
        *{box-sizing:border-box}.pwfb-login-page{min-height:100dvh;padding:24px 18px 30px;background:linear-gradient(135deg,#fff7ec 0%,#f5fbf7 50%,#f1f8ff 100%);font-family:Inter,system-ui,sans-serif;color:#193027}.pwfb-login-brand{text-align:center;margin:0 auto 20px}.pwfb-login-brand img{width:min(290px,68vw);max-height:88px;object-fit:contain}.pwfb-login-brand p{margin:7px 0 0;color:#52635a;font-size:13px}.pwfb-login-brand b{color:#f28c18;margin:0 5px}.pwfb-login-grid{width:min(1480px,100%);margin:auto;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;align-items:start}.pwfb-login-card{position:relative;min-width:0;padding:0 28px 20px;border:1px solid rgba(18,80,45,.12);border-radius:20px;background:rgba(255,255,255,.91);box-shadow:0 15px 42px rgba(19,76,45,.10);overflow:hidden}.pwfb-card-toggle{position:relative;width:calc(100% + 56px);margin-left:-28px;padding:27px 28px 22px;border:0;border-bottom:1px solid #edf1ee;background:transparent;display:grid;grid-template-columns:64px 1fr 28px;align-items:center;gap:13px;text-align:left;cursor:pointer;color:inherit}.pwfb-card-toggle:focus-visible{outline:3px solid rgba(8,117,52,.18);outline-offset:-3px}.pwfb-card-heading{min-width:0}.pwfb-card-heading strong,.pwfb-card-heading small{display:block}.pwfb-card-heading strong{color:#075e2c;font-size:26px;letter-spacing:-.035em}.pwfb-login-card.customer .pwfb-card-heading strong{color:#176e9f}.pwfb-card-heading small{margin-top:7px;color:#617068;font-size:13px;line-height:1.5}.pwfb-card-chevron{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:#eef8f1;color:#087534;font-size:20px;font-weight:900;transition:transform .2s ease,background .2s ease}.pwfb-card-chevron.open{transform:rotate(180deg);background:#e2f2e8}.pwfb-card-body{padding-top:21px}.pwfb-login-card:before{content:"";position:absolute;left:0;right:0;top:0;height:7px;background:#f28c18}.pwfb-login-card.staff:before{background:#16804a}.pwfb-login-card.customer:before{background:#247ab6}.pwfb-card-icon{width:64px;height:64px;display:grid;place-items:center;border-radius:18px;background:#eef8f1;color:#087534;font-size:31px}.pwfb-login-card.admin .pwfb-card-icon{background:#fff1df;color:#f28c18}.pwfb-login-card.customer .pwfb-card-icon{background:#edf6ff;color:#247ab6}.pwfb-login-card form{display:grid;gap:13px}.pwfb-login-card form>label>span{display:block;margin:0 0 5px;color:#53635b;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.08em}.pwfb-input{height:51px;display:flex;align-items:center;gap:9px;padding:0 12px;border:1px solid #d7e2dc;border-radius:10px;background:#fff}.pwfb-input:focus-within{border-color:#0b7b3d;box-shadow:0 0 0 3px rgba(11,123,61,.09)}.pwfb-input>b{color:#087534;font-size:17px}.pwfb-input input{width:100%;height:100%;min-width:0;border:0;outline:0;background:transparent;font-size:13px;color:#20322a}.pwfb-input button{border:0;background:transparent;color:#718078;font-size:11px;cursor:pointer}.pwfb-options{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:10px}.pwfb-options button{border:0;background:transparent;color:#087534;font-weight:800;cursor:pointer}.remember{display:flex!important;align-items:center;gap:6px!important;color:#53635b!important;font-size:10px!important;text-transform:none!important;letter-spacing:0!important;font-weight:500!important;margin:0!important}.remember input{accent-color:#087534}.pwfb-login-submit{height:51px;border:0;border-radius:10px;background:#087f46;color:#fff;font-size:15px;font-weight:900;box-shadow:0 8px 17px rgba(8,127,70,.18);cursor:pointer}.pwfb-login-submit:disabled{opacity:.65;cursor:wait}.pwfb-divider{display:flex;align-items:center;gap:10px;margin:17px 0 10px;color:#76827c;font-size:10px;white-space:nowrap}.pwfb-divider i{height:1px;flex:1;background:#e0e8e3}.pwfb-google-web{min-height:44px;display:flex;justify-content:center;overflow:hidden}.pwfb-google-web:not(.ready){visibility:hidden}.pwfb-google-native{width:100%;height:45px;display:flex;align-items:center;justify-content:center;gap:10px;border:1px solid #d9e2dd;border-radius:9px;background:#fff;color:#27352e;font-size:12px;font-weight:800;cursor:pointer}.pwfb-google-native strong{font-size:20px;color:#4285f4}.pwfb-alt-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:12px}.pwfb-alt-grid button{min-height:68px;display:flex;align-items:center;gap:8px;padding:9px;border:1px solid #edf0ee;border-radius:10px;background:#fffaf3;color:#18372a;text-align:left;cursor:pointer}.pwfb-alt-grid button:last-child{background:#f6fbff}.pwfb-alt-grid b{font-size:19px}.pwfb-alt-grid span strong,.pwfb-alt-grid span small{display:block}.pwfb-alt-grid strong{font-size:10px}.pwfb-alt-grid small{margin-top:2px;color:#7b8780;font-size:9px}.pwfb-help{margin-top:12px;padding:12px;border:1px solid #e0eee5;border-radius:11px;background:#f5fbf7;text-align:center;color:#53635b;font-size:10px}.pwfb-help button{display:block;width:100%;margin-top:8px;height:37px;border:1px solid #17834b;border-radius:8px;background:#fff;color:#087534;font-size:11px;font-weight:900;cursor:pointer}.pwfb-help.customer-help{display:flex;align-items:center;justify-content:space-between;gap:10px;text-align:left;background:#f4f9fd;border-color:#dfeef8}.pwfb-help.customer-help span strong,.pwfb-help.customer-help span small{display:block}.pwfb-help.customer-help span small{margin-top:3px;color:#718078}.pwfb-help.customer-help button{width:auto;padding:0 11px;margin:0;white-space:nowrap}.pwfb-login-card footer{text-align:center;margin-top:17px;padding-top:12px;border-top:1px solid #edf1ee;color:#087534;font-size:10px;font-weight:800}.pwfb-login-card footer small{display:block;margin-top:3px;color:#8a958f;font-weight:500}.pwfb-login-notice{width:min(900px,100%);margin:0 auto 15px;padding:11px 14px;border-left:4px solid #f28c18;border-radius:9px;background:#fff4e8;color:#754000;font-size:11px}.pwfb-login-footer{text-align:center;margin:17px 0 0;color:#8a958f;font-size:10px}@media(max-width:1050px){.pwfb-login-grid{grid-template-columns:1fr;max-width:650px}.pwfb-login-card{padding:0 24px 20px}.pwfb-card-toggle{width:calc(100% + 48px);margin-left:-24px;padding:24px}.pwfb-card-heading strong{font-size:24px}}@media(max-width:560px){.pwfb-login-page{padding:14px 10px 24px}.pwfb-login-brand{margin-bottom:13px}.pwfb-login-brand img{width:245px}.pwfb-login-brand p{font-size:11px}.pwfb-login-grid{gap:12px}.pwfb-login-card{padding:0 16px 17px;border-radius:17px}.pwfb-card-toggle{width:calc(100% + 32px);margin-left:-16px;padding:20px 16px;grid-template-columns:52px 1fr 26px;gap:10px}.pwfb-card-icon{width:52px;height:52px;font-size:26px}.pwfb-card-heading strong{font-size:21px}.pwfb-card-heading small{font-size:11px}.pwfb-card-body{padding-top:17px}.pwfb-alt-grid{grid-template-columns:1fr}.pwfb-help.customer-help{align-items:flex-start;flex-direction:column}.pwfb-help.customer-help button{width:100%}}
      `}</style>
    </main>
  );
}
