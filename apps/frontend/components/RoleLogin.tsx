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
  const selectedCard = cards.find(card => card.mode === selectedMode) ?? cards[0];

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
  }, []);

  return (
    <main className="pwfb-login-page">
      <header className="pwfb-brand">
        <img src="/pwfb-login-logo.svg" alt="PWFB Microfinance" />
        <p>Empowering People · Building Better Futures</p>
      </header>

      <section className="pwfb-login-story" aria-label="About PWFB Microfinance">
        <div className="pwfb-story-kicker"><span /> FINANCIAL SERVICES, MADE CLEAR</div>
        <h2>Build your future with <em>confidence.</em></h2>
        <p className="pwfb-story-copy">A simpler way to access your PWFB account, follow your savings, and manage your financial activities securely.</p>
        <div className="pwfb-story-art" aria-hidden="true">
          <div className="pwfb-art-orbit pwfb-art-orbit-one" />
          <div className="pwfb-art-orbit pwfb-art-orbit-two" />
          <div className="pwfb-art-glow" />
          <div className="pwfb-art-card">
            <div className="pwfb-art-card-top"><span className="pwfb-art-mark">P</span><span className="pwfb-art-chip" /></div>
            <small>PWFB FINANCIAL SERVICES</small>
            <strong>Your goals.<br />Your next chapter.</strong>
            <div className="pwfb-art-card-bottom"><span>SECURE ACCESS</span><span>✦</span></div>
          </div>
          <div className="pwfb-art-float pwfb-art-float-top"><span>✓</span><div><b>Secure access</b><small>Protected sign-in</small></div></div>
          <div className="pwfb-art-float pwfb-art-float-bottom"><span>↗</span><div><b>Move forward</b><small>Manage your account</small></div></div>
        </div>
        <div className="pwfb-story-features">
          <div><span className="pwfb-feature-icon">₦</span><span><b>Savings & deposits</b><small>Keep track of your activity</small></span></div>
          <div><span className="pwfb-feature-icon">↗</span><span><b>Loans & repayments</b><small>Follow your loan journey</small></span></div>
          <div><span className="pwfb-feature-icon">⌑</span><span><b>Security first</b><small>Sign in with trusted methods</small></span></div>
        </div>
        <p className="pwfb-story-footnote"><span>●</span> Your financial journey, with PWFB.</p>
      </section>

      {message && <div className="pwfb-login-notice" role="alert">{message}</div>}

      <section className={"pwfb-login-shell " + selectedCard.tone}>
        <div className="pwfb-role-selector">
          <button
            type="button"
            className="pwfb-role-folder"
            aria-expanded={roleMenuOpen}
            aria-haspopup="listbox"
            onClick={() => setRoleMenuOpen(open => !open)}
          >
            <span className="pwfb-role-folder-icon"><RoleIcon mode={selectedCard.mode} /></span>
            <span className="pwfb-role-folder-copy">
              <small>LOGIN ROLE</small>
              <strong>{selectedCard.title}</strong>
            </span>
            <span className="pwfb-role-folder-arrow">{roleMenuOpen ? "⌃" : "⌄"}</span>
          </button>

          {roleMenuOpen && (
            <div className="pwfb-role-menu" role="listbox" aria-label="Select login role">
              {cards.map(card => (
                <button
                  key={card.mode}
                  type="button"
                  role="option"
                  aria-selected={selectedMode === card.mode}
                  className={"pwfb-role-option " + card.tone + (selectedMode === card.mode ? " selected" : "")}
                  onClick={() => {
                    setSelectedMode(card.mode);
                    setRoleMenuOpen(false);
                    setMessage("");
                    setLoading(null);
                  }}
                >
                  <span className="pwfb-option-icon"><RoleIcon mode={card.mode} /></span>
                  <span className="pwfb-option-copy"><strong>{card.title}</strong></span>
                  {selectedMode === card.mode && <b className="pwfb-option-check">✓</b>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="pwfb-login-card">
          <div className="pwfb-role-hero">
            <div className="pwfb-role-hero-icon"><RoleIcon mode={selectedCard.mode} /></div>
            <h1>{selectedCard.title} Login</h1>
            <p>
              {selectedCard.mode === "SUPER_ADMIN"
                ? "Access the complete system management and administrative controls."
                : selectedCard.mode === "ADMIN"
                  ? "Access administrative controls, staff management and daily operations."
                  : selectedCard.mode === "STAFF"
                    ? "Access your work dashboard and manage your assigned operations."
                    : "Access your account, check your balance, make transactions and more."}
            </p>
          </div>

          <form onSubmit={event => login(event, selectedCard.mode)}>
            <label>
              <span>{selectedCard.mode === "CUSTOMER" ? "Customer ID / Email / Phone Number" : "Email Address"}</span>
              <div className="pwfb-input">
                <span className="pwfb-input-icon">♙</span>
                <input
                  value={values[selectedCard.mode]}
                  onChange={e => setValues(v => ({ ...v, [selectedCard.mode]: e.target.value }))}
                  placeholder={selectedCard.placeholder}
                  type={selectedCard.mode === "CUSTOMER" ? "text" : "email"}
                  autoComplete="username"
                  required
                />
              </div>
            </label>

            <label>
              <span>Password</span>
              <div className="pwfb-input">
                <span className="pwfb-input-icon">♙</span>
                <input
                  value={passwords[selectedCard.mode]}
                  onChange={e => setPasswords(v => ({ ...v, [selectedCard.mode]: e.target.value }))}
                  placeholder="Password"
                  type={showPassword[selectedCard.mode] ? "text" : "password"}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="pwfb-show-password"
                  aria-label={showPassword[selectedCard.mode] ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword(v => ({ ...v, [selectedCard.mode]: !v[selectedCard.mode] }))}
                >
                  {showPassword[selectedCard.mode] ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            <div className="pwfb-options">
              <label className="remember">
                <input
                  type="checkbox"
                  checked={remember[selectedCard.mode]}
                  onChange={e => setRemember(v => ({ ...v, [selectedCard.mode]: e.target.checked }))}
                />
                Remember me
              </label>
              <button type="button" onClick={forgotPassword}>Forgot password?</button>
            </div>

            <button className="pwfb-login-submit" disabled={loading !== null}>
              {loading === selectedCard.mode ? "Signing in…" : "Login"}
              <span>→</span>
            </button>
          </form>

          <div className="pwfb-divider"><span>Other Login Options</span></div>

          <div className="pwfb-biometric-row">
            <button
              type="button"
              className="pwfb-biometric"
              disabled={loading !== null}
              onClick={() => biometricLogin(selectedCard.mode)}
            >
              <span className="bio-icon">◉</span>
              <span>
                <strong>Fingerprint / Face Unlock</strong>
                <small>Use your device passkey</small>
              </span>
            </button>
            {nativeApp ? (
              <button
                className="pwfb-google-native"
                type="button"
                disabled={loading !== null}
                onClick={() => {
                  setLoading(selectedCard.mode);
                  window.PWFBNative?.signInWithGoogle?.(selectedCard.mode);
                }}
              >
                <strong>G</strong>
                <span>Google</span>
              </button>
            ) : (
              <div
                className={"pwfb-google-web " + (googleReady[selectedCard.mode] ? "ready" : "")}
                ref={node => { googleRefs.current[selectedCard.mode] = node; }}
              />
            )}
          </div>

          {selectedCard.mode === "CUSTOMER" ? (
            <div className="pwfb-helper-card customer-helper">
              <div className="helper-icon">◌</div>
              <div>
                <strong>New customer?</strong>
                <span>Visit a branch or contact our support team to register your account.</span>
              </div>
              <button type="button" onClick={() => router.push("/register")}>Create Customer Account →</button>
            </div>
          ) : (
            <div className="pwfb-helper-actions">
              {selectedCard.mode !== "SUPER_ADMIN" && (
                <button type="button" onClick={() => { setSelectedMode("SUPER_ADMIN"); setRoleMenuOpen(false); }}>
                  ← Back to Super Admin Login
                </button>
              )}
              {selectedCard.mode === "SUPER_ADMIN" && (
                <>
                  <button type="button" onClick={() => { setSelectedMode("STAFF"); setRoleMenuOpen(false); }}>
                    <span>♙</span><strong>Staff Login</strong><small>For employees</small>
                  </button>
                  <button type="button" onClick={() => { setSelectedMode("CUSTOMER"); setRoleMenuOpen(false); }}>
                    <span>♙</span><strong>Customer Login</strong><small>For existing customers</small>
                  </button>
                </>
              )}
              {selectedCard.mode === "ADMIN" && (
                <button type="button" onClick={() => { setSelectedMode("STAFF"); setRoleMenuOpen(false); }}>
                  <span>♙</span><strong>Staff Login</strong><small>For employees</small>
                </button>
              )}
              {selectedCard.mode === "STAFF" && (
                <button type="button" onClick={() => { setSelectedMode("CUSTOMER"); setRoleMenuOpen(false); }}>
                  <span>♙</span><strong>Customer Login</strong><small>For existing customers</small>
                </button>
              )}
            </div>
          )}

          <p className="pwfb-security-note">🔒 Biometric data stays on your device. PWFB receives only a secure passkey.</p>
        </div>
      </section>

      <footer className="pwfb-login-footer">
        <strong>🔒 PWFB Microfinance</strong>
        <span>Secure · Reliable · Trusted</span>
      </footer>

      <style jsx>{`
        *{box-sizing:border-box}
        .pwfb-login-page{min-height:100dvh;padding:18px 12px 28px;background:radial-gradient(circle at 12% 4%,rgba(255,161,45,.16),transparent 27%),radial-gradient(circle at 90% 12%,rgba(39,141,83,.12),transparent 30%),linear-gradient(145deg,#fffaf1 0%,#f6fbf8 48%,#eef7ff 100%);font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#173d2b}
        .pwfb-brand{width:min(600px,100%);margin:0 auto 14px;text-align:center}
        .pwfb-brand img{width:min(330px,78vw);height:auto;max-height:110px;object-fit:contain;display:block;margin:0 auto}
        .pwfb-brand p{margin:5px 0 0;color:#596960;font-size:11px;letter-spacing:.02em}
        .pwfb-login-notice{width:min(600px,100%);margin:0 auto 10px;padding:10px 12px;border-left:4px solid #f47712;border-radius:9px;background:#fff4e7;color:#754000;font-size:10px}
        .pwfb-login-shell{width:min(520px,100%);margin:0 auto}
        .pwfb-role-selector{position:relative;z-index:30}
        .pwfb-role-folder{width:100%;min-height:67px;border:1px solid #dce8e0;border-radius:15px;background:rgba(255,255,255,.97);box-shadow:0 8px 25px rgba(15,75,42,.10);display:grid;grid-template-columns:43px 1fr 32px;align-items:center;gap:11px;padding:9px 12px;text-align:left;cursor:pointer}
        .pwfb-role-folder-icon{width:43px;height:43px;display:grid;place-items:center;border-radius:13px;background:#fff2df;color:#e86e08}
        .pwfb-login-shell.staff .pwfb-role-folder-icon{background:#eaf8ef;color:#087534}
        .pwfb-login-shell.customer .pwfb-role-folder-icon{background:#eaf4fd;color:#247db6}
        .pwfb-role-svg{width:31px;height:31px}
        .pwfb-role-folder-copy small,.pwfb-role-folder-copy strong{display:block}
        .pwfb-role-folder-copy small{font-size:8px;letter-spacing:.12em;color:#84918a;font-weight:900}
        .pwfb-role-folder-copy strong{margin-top:2px;font-size:17px;color:#164c31}
        .pwfb-role-folder-arrow{width:29px;height:29px;border-radius:50%;display:grid;place-items:center;background:#edf7f0;color:#087534;font-size:18px;font-weight:900}
        .pwfb-role-menu{position:absolute;top:calc(100% + 6px);left:0;right:0;padding:7px;border:1px solid #dce8e0;border-radius:14px;background:#fff;box-shadow:0 16px 35px rgba(12,70,40,.17)}
        .pwfb-role-option{width:100%;min-height:57px;border:0;border-radius:10px;background:#fff;display:grid;grid-template-columns:39px 1fr 22px;align-items:center;gap:9px;padding:7px 9px;text-align:left;cursor:pointer}
        .pwfb-role-option:hover,.pwfb-role-option.selected{background:#f4faf6}
        .pwfb-role-option.admin.selected{background:#fff8ef}
        .pwfb-role-option.customer.selected{background:#f1f8fe}
        .pwfb-option-icon{width:39px;height:39px;display:grid;place-items:center;border-radius:10px;background:#edf8f1;color:#087534}
        .pwfb-role-option.admin .pwfb-option-icon{background:#fff2df;color:#e16d09}
        .pwfb-role-option.customer .pwfb-option-icon{background:#edf6ff;color:#237db7}
        .pwfb-option-icon .pwfb-role-svg{width:26px;height:26px}
        .pwfb-role-option strong,.pwfb-role-option small{display:block}
        .pwfb-role-option strong{font-size:12px;color:#164c31}
        .pwfb-role-option small{margin-top:2px;font-size:8px;color:#7a8780}
        .pwfb-option-check{color:#087534;font-size:14px}
        .pwfb-login-card{margin-top:10px;border:1px solid #dce8e0;border-radius:16px;background:rgba(255,255,255,.97);box-shadow:0 10px 30px rgba(12,70,40,.08);padding:18px 18px 16px}
        .pwfb-role-hero{text-align:center;padding:4px 4px 15px}
        .pwfb-role-hero-icon{width:66px;height:66px;margin:0 auto 9px;display:grid;place-items:center;border-radius:19px;background:#fff2df;color:#f47712}
        .pwfb-login-shell.staff .pwfb-role-hero-icon{background:#eaf8ef;color:#087534}
        .pwfb-login-shell.customer .pwfb-role-hero-icon{background:#eaf4fd;color:#247db6}
        .pwfb-role-hero-icon .pwfb-role-svg{width:46px;height:46px}
        .pwfb-role-hero h1{margin:0;color:#0f4d31;font-size:25px;line-height:1.12;font-weight:900}
        .pwfb-role-hero p{max-width:390px;margin:7px auto 0;color:#617169;font-size:12px;line-height:1.45}
        .pwfb-login-card form{display:grid;gap:12px}
        .pwfb-login-card form>label>span{display:block;margin-bottom:5px;color:#64736b;font-size:9px;font-weight:900}
        .pwfb-input{height:53px;display:flex;align-items:center;gap:9px;padding:0 12px;border:1px solid #d5e1da;border-radius:11px;background:#fff}
        .pwfb-input:focus-within{border-color:#087534;box-shadow:0 0 0 3px rgba(8,117,52,.08)}
        .pwfb-input-icon{color:#087534;font-size:20px;width:20px;text-align:center}
        .pwfb-input input{flex:1;min-width:0;height:100%;border:0;outline:0;background:transparent;font-size:13px;color:#1c3027}
        .pwfb-input input::placeholder{color:#7a8781}
        .pwfb-show-password{border:0;background:transparent;color:#617169;font-size:10px;font-weight:800;cursor:pointer}
        .pwfb-options{display:flex;align-items:center;justify-content:space-between;font-size:10px}
        .pwfb-options button{border:0;background:transparent;color:#087534;font-weight:800;cursor:pointer}
        .remember{display:flex;align-items:center;gap:6px;color:#68766f}
        .remember input{accent-color:#087534}
        .pwfb-login-submit{height:53px;border:0;border-radius:11px;background:#078448;color:#fff;font-size:15px;font-weight:900;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 8px 17px rgba(8,125,69,.18);cursor:pointer}
        .pwfb-login-submit span{font-size:20px;line-height:1}
        .pwfb-login-submit:disabled,.pwfb-biometric:disabled,.pwfb-google-native:disabled{opacity:.6;cursor:wait}
        .pwfb-divider{display:flex;align-items:center;gap:10px;margin:16px 0 10px;color:#89958e;font-size:9px}
        .pwfb-divider:before,.pwfb-divider:after{content:"";height:1px;background:#e1e9e4;flex:1}
        .pwfb-biometric-row{display:grid;grid-template-columns:1fr 92px;gap:8px}
        .pwfb-biometric{min-height:54px;border:1px solid #d9e7df;border-radius:11px;background:#f5faf7;display:flex;align-items:center;gap:9px;padding:8px 10px;text-align:left;color:#183127;cursor:pointer}
        .bio-icon{width:34px;height:34px;flex:0 0 34px;display:grid;place-items:center;border-radius:50%;background:#087534;color:#fff;font-size:15px}
        .pwfb-biometric strong,.pwfb-biometric small{display:block}
        .pwfb-biometric strong{font-size:10px}
        .pwfb-biometric small{margin-top:2px;color:#7a8780;font-size:8px}
        .pwfb-google-native{min-height:54px;border:1px solid #d9e2dd;border-radius:11px;background:#fff;color:#26342e;display:flex;align-items:center;justify-content:center;gap:6px;font-weight:900;cursor:pointer}
        .pwfb-google-native strong{color:#4285f4;font-size:18px}
        .pwfb-google-web{min-height:54px;display:flex;align-items:center;justify-content:center;overflow:hidden}
        .pwfb-google-web:not(.ready){visibility:hidden}
        .pwfb-helper-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:11px}
        .pwfb-helper-actions>button{flex:1;min-width:145px;min-height:52px;border:1px solid #e1e9e4;border-radius:11px;background:#fffaf3;color:#165038;display:grid;grid-template-columns:24px 1fr;grid-template-rows:auto auto;column-gap:6px;align-items:center;text-align:left;padding:7px 10px;cursor:pointer}
        .pwfb-helper-actions>button>span{grid-row:1 / span 2;align-self:center;font-size:19px;color:#087534}
        .pwfb-helper-actions strong{font-size:10px}.pwfb-helper-actions small{font-size:8px;color:#7a8780}
        .pwfb-helper-actions>button:first-child{width:100%;display:block;text-align:center;background:#fff}
        .pwfb-helper-card{margin-top:11px;padding:11px;border-radius:11px;background:#f0f7fd;display:grid;grid-template-columns:34px 1fr;gap:8px;align-items:start}
        .helper-icon{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:#e2f0fb;color:#247db6;font-size:18px}
        .pwfb-helper-card strong,.pwfb-helper-card span{display:block}
        .pwfb-helper-card strong{font-size:10px;color:#174c36}
        .pwfb-helper-card span{margin-top:2px;font-size:8px;line-height:1.4;color:#6e7d75}
        .pwfb-helper-card button{grid-column:1 / -1;height:40px;border:1px solid #247db6;border-radius:9px;background:#fff;color:#247db6;font-size:10px;font-weight:900;cursor:pointer}
        .pwfb-security-note{margin:11px 0 0;color:#89958e;text-align:center;font-size:8px;line-height:1.45}\n        .pwfb-login-card:after{content:"";display:block;height:5px;margin:14px -18px -16px;border-radius:0 0 16px 16px;background:linear-gradient(90deg,#f47712 0 50%,#087534 50% 100%)}\n        .pwfb-login-footer{position:relative;padding-top:12px}\n        .pwfb-login-footer:before{content:"";position:absolute;top:0;left:50%;transform:translateX(-50%);width:76px;height:3px;border-radius:99px;background:linear-gradient(90deg,#f47712 0 50%,#087534 50% 100%)}\n        .pwfb-login-footer span{display:inline-flex;align-items:center;gap:6px}\n        .pwfb-login-footer span:before,.pwfb-login-footer span:after{content:"";width:22px;height:2px;border-radius:99px}\n        .pwfb-login-footer span:before{background:#f47712}.pwfb-login-footer span:after{background:#087534}
        .pwfb-login-footer{display:flex;flex-direction:column;align-items:center;gap:3px;margin-top:13px;color:#7c8983;font-size:9px}
        .pwfb-login-footer strong{color:#087534;font-size:10px}
        @media(max-width:520px){
          .pwfb-login-page{padding:12px 8px 22px}
          .pwfb-brand img{width:min(300px,86vw)}
          .pwfb-brand p{font-size:10px}
          .pwfb-login-card{padding:15px 12px 14px}\n          .pwfb-login-card:after{margin-left:-12px;margin-right:-12px;margin-bottom:-14px}
          .pwfb-role-hero h1{font-size:22px}
          .pwfb-role-hero p{font-size:11px}
          .pwfb-biometric-row{grid-template-columns:1fr 82px}
          .pwfb-biometric{min-width:0}
          .pwfb-biometric strong{font-size:9px}
          .pwfb-helper-actions>button{min-width:130px}
        }
      `}</style>
    </main>
  );
}
