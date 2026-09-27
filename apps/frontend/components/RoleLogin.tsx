"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { startAuthentication } from "@simplewebauthn/browser";
import { apiRequest } from "../lib/api";
import { useAuth } from "../context/AuthContext";

type LoginMode = "SUPER_ADMIN" | "ADMIN" | "STAFF" | "CUSTOMER";
type GooglePayload = { credential: string; client_id: string; nonce: string; loginMode: LoginMode };

declare global {
  interface Window {
    google?: any;
    PWFBNative?: {
      signInWithGoogle?: (loginMode?: string) => void;
      signInWithPasskey?: (loginMode?: string, identifier?: string) => void;
      registerPasskey?: (replaceExisting: boolean, token: string) => void;
    };
    __pwfbNativeGoogleResult?: (payload: any) => void;
    __pwfbNativePasskeyResult?: (payload: any) => void;
  }
}

const GOOGLE_NONCE_PREFIX = "pwfb_google_oidc_nonce_";
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

const cards: Array<{ mode: LoginMode; title: string; subtitle: string; placeholder: string; tone: string }> = [
  { mode: "SUPER_ADMIN", title: "Super Admin", subtitle: "Full system control", placeholder: "Email Address", tone: "super" },
  { mode: "ADMIN", title: "Admin", subtitle: "Administrative access", placeholder: "Email Address", tone: "admin" },
  { mode: "STAFF", title: "Staff", subtitle: "Staff operations", placeholder: "Email Address", tone: "staff" },
  { mode: "CUSTOMER", title: "Customer", subtitle: "Customer account access", placeholder: "Customer ID / Email / Phone", tone: "customer" },
];

function RoleIcon({ mode }: { mode: LoginMode }) {
  const common = { viewBox: "0 0 64 64", className: "pwfb-role-svg", "aria-hidden": true };
  if (mode === "SUPER_ADMIN") return <svg {...common}><path d="M32 5 53 13v16c0 14-9 25-21 31C20 54 11 43 11 29V13L32 5Z" fill="none" stroke="currentColor" strokeWidth="4"/><path d="M23 30h18v14H23z" fill="currentColor"/><path d="M27 30v-5a5 5 0 0 1 10 0v5" fill="none" stroke="currentColor" strokeWidth="4"/><circle cx="32" cy="36" r="2" fill="white"/></svg>;
  if (mode === "ADMIN") return <svg {...common}><path d="M32 7 51 14v15c0 13-8 23-19 29-11-6-19-16-19-29V14L32 7Z" fill="currentColor"/><path d="M22 31h20v12H22z" fill="white"/><path d="M26 31v-4a6 6 0 0 1 12 0v4" fill="none" stroke="currentColor" strokeWidth="3"/></svg>;
  if (mode === "STAFF") return <svg {...common}><circle cx="32" cy="17" r="9" fill="currentColor"/><circle cx="14" cy="25" r="7" fill="currentColor"/><circle cx="50" cy="25" r="7" fill="currentColor"/><path d="M19 51c1-12 7-18 13-18s12 6 13 18M4 50c1-9 5-14 10-14s9 5 10 14M40 50c1-9 5-14 10-14s9 5 10 14" fill="currentColor"/></svg>;
  return <svg {...common}><circle cx="32" cy="19" r="11" fill="currentColor"/><path d="M12 57c2-15 8-23 20-23s18 8 20 23" fill="currentColor"/></svg>;
}

export default function RoleLogin() {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const googleRefs = useRef<Record<LoginMode, HTMLDivElement | null>>({ SUPER_ADMIN: null, ADMIN: null, STAFF: null, CUSTOMER: null });
  const [values, setValues] = useState<Record<LoginMode, string>>({ SUPER_ADMIN: "", ADMIN: "", STAFF: "", CUSTOMER: "" });
  const [passwords, setPasswords] = useState<Record<LoginMode, string>>({ SUPER_ADMIN: "", ADMIN: "", STAFF: "", CUSTOMER: "" });
  const [showPassword, setShowPassword] = useState<Record<LoginMode, boolean>>({ SUPER_ADMIN: false, ADMIN: false, STAFF: false, CUSTOMER: false });
  const [remember, setRemember] = useState<Record<LoginMode, boolean>>({ SUPER_ADMIN: true, ADMIN: true, STAFF: true, CUSTOMER: true });
  const [loading, setLoading] = useState<LoginMode | null>(null);
  const [message, setMessage] = useState("");
  const [nativeApp, setNativeApp] = useState(false);
  const [googleReady, setGoogleReady] = useState<Record<LoginMode, boolean>>({ SUPER_ADMIN: false, ADMIN: false, STAFF: false, CUSTOMER: false });
  const [selectedMode, setSelectedMode] = useState<LoginMode>("SUPER_ADMIN");
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);

  const destination = (role?: string) => role === "CUSTOMER" ? "/customer-dashboard" : role === "SUPER_ADMIN" ? "/dashboard" : "/staff-dashboard";

  const validateMode = (role: string | undefined, mode: LoginMode) => {
    if (mode === "SUPER_ADMIN" && role !== "SUPER_ADMIN") throw new Error("This account is not a Super Admin account. Use another login.");
    if (mode === "ADMIN" && role !== "ADMIN") throw new Error("This account is not an Admin account. Use another login.");
    if (mode === "STAFF" && (role === "SUPER_ADMIN" || role === "ADMIN")) throw new Error("Admin accounts must use Admin or Super Admin login.");
    if (mode === "CUSTOMER" && role !== "CUSTOMER") throw new Error("This account is not a Customer account. Use another login.");
  };

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
    try { validateMode(role, mode); } catch (error) {
      ["token","access_token","user"].forEach(key => { localStorage.removeItem(key); sessionStorage.removeItem(key); });
      throw error;
    }
    window.location.assign(destination(role));
  };

  const forgotPassword = () => {
    setMessage("Password recovery is not configured on this login screen yet. Please contact your PWFB administrator.");
  };

  const login = async (event: React.FormEvent, mode: LoginMode) => {
    event.preventDefault(); setMessage(""); setLoading(mode);
    try {
      await completeLogin(await apiRequest("/auth/login", { method: "POST", body: JSON.stringify({ identifier: values[mode].trim(), password: passwords[mode], loginMode: mode }) }), mode);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to connect to PWFB"); setLoading(null); }
  };

  const googleLogin = async (payload: GooglePayload) => {
    setMessage(""); setLoading(payload.loginMode);
    try { await completeLogin(await apiRequest("/auth/google", { method: "POST", body: JSON.stringify(payload) }), payload.loginMode); localStorage.removeItem(GOOGLE_NONCE_PREFIX + payload.loginMode); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Google sign-in failed."); setLoading(null); }
  };

  const biometricLogin = async (mode: LoginMode) => {
    setMessage(""); setLoading(mode);
    try {
      if (nativeApp && window.PWFBNative?.signInWithPasskey) {
        window.PWFBNative.signInWithPasskey(mode, values[mode].trim());
        return;
      }
      const options = await apiRequest("/auth/passkey/login/options", { method: "POST", body: JSON.stringify({ email: values[mode].includes("@") ? values[mode].trim() : undefined }) });
      const credential = await startAuthentication({ optionsJSON: options });
      await completeLogin(await apiRequest("/auth/passkey/login/verify", { method: "POST", body: JSON.stringify({ credential, challenge: options.challenge }) }), mode);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Fingerprint / Face Unlock failed."); setLoading(null); }
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
        const bytes = new Uint8Array(32); crypto.getRandomValues(bytes);
        const nonce = Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
        localStorage.setItem(GOOGLE_NONCE_PREFIX + mode, nonce);
        host.innerHTML = "";
        window.google.accounts.id.initialize({ client_id: clientId, nonce, auto_select: false, cancel_on_tap_outside: false, use_fedcm_for_prompt: false, context: "signin", callback: (response: any) => googleLogin({ credential: response.credential, client_id: clientId, nonce: localStorage.getItem(GOOGLE_NONCE_PREFIX + mode) || nonce, loginMode: mode }) });
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
        const script = document.createElement("script"); script.src = "https://accounts.google.com/gsi/client"; script.async = true; script.defer = true; script.onload = () => renderGoogle(clientId); document.head.appendChild(script);
      } catch {}
    };
    load(); return () => { active = false; };
  }, []);

  useEffect(() => {
    window.__pwfbNativeGoogleResult = async (payload) => {
      const mode = (payload?.loginMode || "CUSTOMER") as LoginMode;
      if (!payload?.ok || !payload?.access_token) { setMessage(payload?.message || "Google sign-in could not be completed."); setLoading(null); return; }
      try { await completeLogin({ access_token: payload.access_token, user: payload.user }, mode); } catch (error) { setMessage(error instanceof Error ? error.message : "Google sign-in failed."); setLoading(null); }
    };
    window.__pwfbNativePasskeyResult = async (payload) => {
      const mode = (payload?.loginMode || "CUSTOMER") as LoginMode;
      if (!payload?.ok || !payload?.access_token) { setMessage(payload?.message || "Fingerprint / Face Unlock could not be completed."); setLoading(null); return; }
      try { await completeLogin({ access_token: payload.access_token, user: payload.user }, mode); } catch (error) { setMessage(error instanceof Error ? error.message : "Biometric sign-in failed."); setLoading(null); }
    };
    return () => {
      delete window.__pwfbNativeGoogleResult;
      delete window.__pwfbNativePasskeyResult;
    };
  }, [remember]);

  const selectedCard = cards.find(card => card.mode === selectedMode) ?? cards[0];

  return (
    <main className="pwfb-login-page">
      <header className="pwfb-login-header">
        <img src="/pwfb-login-logo.svg" alt="PWFB Microfinance" />
        <div><strong>Secure Access</strong><span>Perfect Wisdom For Better Ltd</span></div>
      </header>
      {message && <div className="pwfb-login-notice" role="alert">{message}</div>}

      <section className={"pwfb-login-shell " + selectedCard.tone}>
        <div className="pwfb-role-selector">
          <button type="button" className="pwfb-role-folder" aria-expanded={roleMenuOpen} aria-haspopup="listbox" onClick={() => setRoleMenuOpen(open => !open)}>
            <span className="pwfb-role-folder-icon"><RoleIcon mode={selectedCard.mode} /></span>
            <span className="pwfb-role-folder-name">{selectedCard.title}</span>
            <span className="pwfb-role-folder-arrow">{roleMenuOpen ? "⌃" : "⌄"}</span>
          </button>
          {roleMenuOpen && <div className="pwfb-role-menu" role="listbox" aria-label="Select login role">
            {cards.map(card => <button key={card.mode} type="button" role="option" aria-selected={selectedMode === card.mode} className={"pwfb-role-option " + card.tone + (selectedMode === card.mode ? " selected" : "")} onClick={() => { setSelectedMode(card.mode); setRoleMenuOpen(false); setMessage(""); setLoading(null); }}>
              <span className="pwfb-option-icon"><RoleIcon mode={card.mode} /></span>
              <span><strong>{card.title}</strong><small>{card.subtitle}</small></span>
              {selectedMode === card.mode && <b className="pwfb-option-check">✓</b>}
            </button>)}
          </div>}
        </div>

        <div className="pwfb-login-panel">
          <div className="pwfb-login-panel-title">
            <div><span className="pwfb-login-kicker">{selectedCard.title} Login</span><h1>Welcome to PWFB</h1><p>{selectedCard.subtitle}</p></div>
            <span className="pwfb-current-role-badge">{selectedCard.title}</span>
          </div>
          <form onSubmit={event => login(event, selectedCard.mode)}>
            <label><span>{selectedCard.mode === "CUSTOMER" ? "Customer Login ID" : "Email Address"}</span><div className="pwfb-input"><b>⌾</b><input value={values[selectedCard.mode]} onChange={e => setValues(v => ({ ...v, [selectedCard.mode]: e.target.value }))} placeholder={selectedCard.placeholder} type={selectedCard.mode === "CUSTOMER" ? "text" : "email"} autoComplete="username" required /></div></label>
            <label><span>Password</span><div className="pwfb-input"><b>▣</b><input value={passwords[selectedCard.mode]} onChange={e => setPasswords(v => ({ ...v, [selectedCard.mode]: e.target.value }))} placeholder="Password" type={showPassword[selectedCard.mode] ? "text" : "password"} autoComplete="current-password" required /><button type="button" onClick={() => setShowPassword(v => ({ ...v, [selectedCard.mode]: !v[selectedCard.mode] }))}>{showPassword[selectedCard.mode] ? "Hide" : "Show"}</button></div></label>
            <div className="pwfb-options"><label className="remember"><input type="checkbox" checked={remember[selectedCard.mode]} onChange={e => setRemember(v => ({ ...v, [selectedCard.mode]: e.target.checked }))} /> Remember me</label><button type="button" onClick={forgotPassword}>Forgot password?</button></div>
            <button className="pwfb-login-submit" disabled={loading !== null}>{loading === selectedCard.mode ? "Signing in…" : "Login as " + selectedCard.title}</button>
          </form>
          <div className="pwfb-or"><span>OR</span></div>
          <div className="pwfb-biometric-row">
            <button type="button" className="pwfb-biometric" disabled={loading !== null} onClick={() => biometricLogin(selectedCard.mode)}><span className="bio-icon">◉</span><span><strong>Fingerprint / Face Unlock</strong><small>Use your device passkey</small></span></button>
            {nativeApp ? <button className="pwfb-google-native" type="button" disabled={loading !== null} onClick={() => { setLoading(selectedCard.mode); window.PWFBNative?.signInWithGoogle?.(selectedCard.mode); }}><strong>G</strong><span>Google</span></button> : <div className={"pwfb-google-web " + (googleReady[selectedCard.mode] ? "ready" : "")} ref={node => { googleRefs.current[selectedCard.mode] = node; }} />}
          </div>
          {selectedCard.mode === "CUSTOMER" && <button type="button" className="pwfb-register" onClick={() => router.push("/register")}>Create Customer Account</button>}
          <p className="pwfb-security-note">Biometric data stays on your device. PWFB receives only a secure passkey.</p>
        </div>
      </section>
      <footer className="pwfb-login-footer">PWFB Microfinance · Secure · Reliable · Trusted</footer>
      <style jsx>{`
        *{box-sizing:border-box}.pwfb-login-page{min-height:100dvh;padding:22px 14px 28px;background:radial-gradient(circle at top right,#fff2dc 0,#f6fbf8 38%,#eef6f1 100%);font-family:Inter,system-ui,sans-serif;color:#183127}.pwfb-login-header{width:min(560px,100%);margin:0 auto 18px;display:flex;align-items:center;justify-content:center;gap:12px}.pwfb-login-header img{width:170px;height:auto;max-height:65px;object-fit:contain}.pwfb-login-header div{border-left:1px solid #dbe8e0;padding-left:12px}.pwfb-login-header strong,.pwfb-login-header span{display:block}.pwfb-login-header strong{color:#087534;font-size:13px}.pwfb-login-header span{color:#7b8981;font-size:9px;margin-top:3px}.pwfb-login-shell{width:min(650px,100%);margin:auto}.pwfb-role-selector{position:relative;z-index:20}.pwfb-role-folder{width:100%;min-height:76px;border:1px solid #dbe8e0;border-radius:17px;background:#fff;box-shadow:0 8px 28px rgba(12,70,40,.09);display:grid;grid-template-columns:48px 1fr 34px;align-items:center;gap:12px;padding:12px 16px;text-align:left;cursor:pointer}.pwfb-role-folder-icon{width:48px;height:48px;display:grid;place-items:center;border-radius:14px;background:#fff2df;color:#f47712}.pwfb-login-shell.admin .pwfb-role-folder-icon{background:#fff2df;color:#e16d09}.pwfb-login-shell.staff .pwfb-role-folder-icon{background:#edf8f1;color:#087534}.pwfb-login-shell.customer .pwfb-role-folder-icon{background:#edf6ff;color:#237db7}.pwfb-role-svg{width:34px;height:34px}.pwfb-role-folder-name{font-size:18px;font-weight:900;color:#164c31}.pwfb-role-folder-arrow{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:#edf7f0;color:#087534;font-size:20px;font-weight:900}.pwfb-role-menu{position:absolute;top:calc(100% + 7px);left:0;right:0;padding:7px;border:1px solid #dbe8e0;border-radius:15px;background:#fff;box-shadow:0 16px 34px rgba(12,70,40,.15)}.pwfb-role-option{width:100%;min-height:62px;border:0;border-radius:11px;background:#fff;display:grid;grid-template-columns:40px 1fr 24px;align-items:center;gap:10px;padding:8px 10px;text-align:left;cursor:pointer}.pwfb-role-option:hover,.pwfb-role-option.selected{background:#f4faf6}.pwfb-role-option.admin.selected{background:#fff8ef}.pwfb-role-option.customer.selected{background:#f2f8fd}.pwfb-option-icon{width:40px;height:40px;display:grid;place-items:center;border-radius:11px;background:#edf8f1;color:#087534}.pwfb-role-option.admin .pwfb-option-icon{background:#fff2df;color:#e16d09}.pwfb-role-option.customer .pwfb-option-icon{background:#edf6ff;color:#237db7}.pwfb-option-icon .pwfb-role-svg{width:28px;height:28px}.pwfb-role-option strong,.pwfb-role-option small{display:block}.pwfb-role-option strong{font-size:13px;color:#164c31}.pwfb-role-option small{margin-top:2px;font-size:9px;color:#7a8780}.pwfb-option-check{color:#087534;font-size:15px}.pwfb-login-panel{margin-top:12px;border:1px solid #dbe8e0;border-radius:17px;background:rgba(255,255,255,.97);box-shadow:0 8px 28px rgba(12,70,40,.07);padding:18px 16px}.pwfb-login-panel-title{display:flex;align-items:center;justify-content:space-between;gap:10px;padding-bottom:14px;border-bottom:1px solid #edf2ee;margin-bottom:15px}.pwfb-login-kicker{display:block;color:#087534;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.1em}.pwfb-login-panel h1{margin:3px 0 2px;font-size:20px;color:#164c31}.pwfb-login-panel-title p{margin:0;color:#7b8981;font-size:10px}.pwfb-current-role-badge{padding:7px 9px;border-radius:999px;background:#edf7f0;color:#087534;font-size:9px;font-weight:900}.pwfb-login-shell.admin .pwfb-current-role-badge{background:#fff2df;color:#d96b09}.pwfb-login-shell.customer .pwfb-current-role-badge{background:#edf6ff;color:#237db7}.pwfb-login-panel form{display:grid;gap:12px}.pwfb-login-panel form>label>span{display:block;margin-bottom:5px;color:#64736b;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.08em}.pwfb-input{height:49px;display:flex;align-items:center;gap:8px;padding:0 11px;border:1px solid #d6e2da;border-radius:11px;background:#fff}.pwfb-input:focus-within{border-color:#087534;box-shadow:0 0 0 3px rgba(8,117,52,.08)}.pwfb-input>b{color:#087534}.pwfb-input input{flex:1;min-width:0;height:100%;border:0;outline:0;background:transparent;font-size:13px}.pwfb-input button{border:0;background:transparent;color:#6c7972;font-size:10px;font-weight:800}.pwfb-options{display:flex;align-items:center;justify-content:space-between;font-size:10px}.pwfb-options button{border:0;background:transparent;color:#087534;font-weight:800}.remember{display:flex;align-items:center;gap:6px;color:#68766f}.remember input{accent-color:#087534}.pwfb-login-submit{height:49px;border:0;border-radius:11px;background:#087d45;color:#fff;font-size:13px;font-weight:900;box-shadow:0 7px 15px rgba(8,125,69,.18)}.pwfb-login-submit:disabled,.pwfb-biometric:disabled,.pwfb-google-native:disabled{opacity:.6}.pwfb-or{display:flex;align-items:center;gap:9px;margin:14px 0 10px;color:#8a958f;font-size:9px}.pwfb-or:before,.pwfb-or:after{content:"";height:1px;background:#e1e9e4;flex:1}.pwfb-biometric-row{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:stretch}.pwfb-biometric{min-height:53px;border:1px solid #d9e7df;border-radius:11px;background:#f7fbf8;display:flex;align-items:center;gap:10px;padding:8px 11px;text-align:left;color:#183127;cursor:pointer}.bio-icon{width:34px;height:34px;display:grid;place-items:center;border-radius:50%;background:#087534;color:#fff;font-size:16px}.pwfb-biometric strong,.pwfb-biometric small{display:block}.pwfb-biometric strong{font-size:10px}.pwfb-biometric small{margin-top:2px;color:#7a8780;font-size:8px}.pwfb-google-native{min-width:78px;border:1px solid #d9e2dd;border-radius:11px;background:#fff;color:#26342e;display:flex;align-items:center;justify-content:center;gap:6px;font-weight:900}.pwfb-google-native strong{color:#4285f4;font-size:18px}.pwfb-google-web{min-width:120px;min-height:53px;display:flex;align-items:center;justify-content:center;overflow:hidden}.pwfb-google-web:not(.ready){visibility:hidden}.pwfb-register{width:100%;margin-top:10px;height:40px;border:1px solid #cfe0d6;border-radius:10px;background:#fff;color:#087534;font-size:10px;font-weight:900}.pwfb-security-note{margin:10px 0 0;color:#89958e;text-align:center;font-size:8px;line-height:1.45}.pwfb-login-notice{width:min(650px,100%);margin:0 auto 12px;padding:10px 12px;border-left:4px solid #f47712;border-radius:9px;background:#fff4e7;color:#754000;font-size:10px}.pwfb-login-footer{text-align:center;margin-top:15px;color:#8a958f;font-size:9px}@media(max-width:520px){.pwfb-login-page{padding:15px 9px 22px}.pwfb-login-header{margin-bottom:12px}.pwfb-login-header img{width:145px}.pwfb-login-header strong{font-size:11px}.pwfb-role-folder{min-height:68px;padding:10px 12px;grid-template-columns:44px 1fr 30px}.pwfb-role-folder-icon{width:44px;height:44px}.pwfb-role-folder-name{font-size:17px}.pwfb-login-panel{padding:15px 12px}.pwfb-login-panel-title{align-items:flex-start}.pwfb-login-panel h1{font-size:18px}.pwfb-biometric-row{grid-template-columns:1fr 82px}.pwfb-biometric{min-width:0}.pwfb-biometric strong{font-size:9px}}
      `}</style>
    </main>
  );
}
