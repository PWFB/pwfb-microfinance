"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

function UserIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c.7-4 3.4-6 8-6s7.3 2 8 6"/></svg>;
}

function LockIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>;
}

function EyeIcon({ crossed = false }: { crossed?: boolean }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/>{crossed && <path d="M4 4l16 16"/>}</svg>;
}

function FingerprintIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.2 7.2A5.3 5.3 0 0 1 12 5.7a5.3 5.3 0 0 1 5.3 5.3c0 2.2-.5 4.5-1.6 6.5"/><path d="M5.7 10.7A6.4 6.4 0 0 1 12 4.3a6.4 6.4 0 0 1 6.4 6.4c0 3-.8 5.8-2.2 8.3"/><path d="M10.1 10.3A2.2 2.2 0 0 1 12 9.2a2.2 2.2 0 0 1 2.2 2.2c0 2.1-.4 4.2-1.1 6.1"/><path d="M7.5 13.3c0 3-.7 5.1-1.7 6.7"/><path d="M11.9 13.1c0 2.7-.5 4.8-1.2 6.4"/></svg>;
}

export default function LoginPage() {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setLoading(true);
    try {
      const data = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (!data.access_token) {
        setMessage(data.message || "Login failed");
        return;
      }
      if (remember) localStorage.setItem("token", data.access_token);
      else sessionStorage.setItem("token", data.access_token);
      await refreshProfile();
      if (data.user?.role === "CUSTOMER") router.replace("/customer-dashboard");
      else if (data.user?.role === "SUPER_ADMIN") router.replace("/dashboard");
      else router.replace("/staff-dashboard");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to connect to the server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="pwfb-reference-login">
      <section className="pwfb-login-phone" aria-label="PWFB login">
        <div className="pwfb-login-inner">
          <header className="pwfb-reference-brand">
            <img src="/pwfb-logo.svg" alt="PWFB Microfinance" className="pwfb-logo-art" />
            <p className="pwfb-reference-company">Perfect Wisdom For Better Ltd</p>
            <p className="pwfb-reference-tagline">...Moving Together For Better Living</p>
          </header>

          <div className="pwfb-reference-welcome">
            <h1>Welcome Back!</h1>
            <p>Sign in to your account</p>
          </div>

          <form onSubmit={handleSubmit} className="pwfb-reference-form">
            <label className="pwfb-reference-input">
              <span className="pwfb-input-icon"><UserIcon /></span>
              <input
                id="email"
                type="email"
                placeholder="Staff ID or Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
              />
            </label>

            <label className="pwfb-reference-input">
              <span className="pwfb-input-icon"><LockIcon /></span>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button type="button" className="pwfb-eye-button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"}>
                <EyeIcon crossed={!showPassword} />
              </button>
            </label>

            <div className="pwfb-reference-options">
              <label className="pwfb-reference-remember">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                <span>Remember me</span>
              </label>
              <button type="button" className="pwfb-reference-forgot" onClick={() => setMessage("Please contact your administrator to reset your password.")}>Forgot Password?</button>
            </div>

            {message && <div className="pwfb-reference-message" role="alert">{message}</div>}

            <button type="submit" disabled={loading} className="pwfb-reference-login-button">
              {loading ? "Signing in..." : "Login"}
            </button>

            <div className="pwfb-reference-divider"><span>OR</span></div>

            <button type="button" className="pwfb-reference-secondary" onClick={() => setMessage("Google sign-in is not enabled yet.")}>
              <span className="pwfb-google-mark">G</span>
              <span>Continue with Google</span>
            </button>

            <button type="button" className="pwfb-reference-secondary" onClick={() => setMessage("Fingerprint login is not enabled yet.")}>
              <span className="pwfb-fingerprint-mark"><FingerprintIcon /></span>
              <span>Login with Fingerprint</span>
            </button>
          </form>

          <footer className="pwfb-reference-footer">
            <span>Secure</span><i>•</i><span>Reliable</span><i>•</i><span>Always With You</span>
          </footer>
        </div>
        <div className="pwfb-reference-wave" aria-hidden="true" />
      </section>

      <style jsx>{`
        .pwfb-reference-login { min-height:100dvh; width:100%; display:flex; align-items:center; justify-content:center; padding:16px; background:#eef3ef; }
        .pwfb-login-phone { position:relative; width:min(100%,420px); aspect-ratio:9 / 16; min-height:620px; max-height:calc(100dvh - 24px); overflow:hidden; border:1px solid #d9e3dc; border-radius:28px; background:#fff; box-shadow:0 20px 55px rgba(12,63,34,.16); }
        .pwfb-login-inner { position:relative; z-index:2; height:100%; overflow:auto; padding:34px 24px 24px; scrollbar-width:none; }
        .pwfb-login-inner::-webkit-scrollbar { display:none; }
        .pwfb-reference-brand { text-align:center; margin:4px auto 0; }
        .pwfb-logo-art { display:block; width:250px; max-width:86%; height:auto; margin:0 auto 0; object-fit:contain; filter:drop-shadow(0 2px 2px rgba(0,0,0,.04)); }
        .pwfb-reference-company { margin:-5px 0 0; color:#0d6d31; font-size:12px; font-weight:800; }
        .pwfb-reference-tagline { margin:4px 0 0; color:#ef7d12; font-size:10px; font-style:italic; font-weight:700; }
        .pwfb-reference-welcome { text-align:center; margin:30px 0 20px; }
        .pwfb-reference-welcome h1 { margin:0; color:#0b6f31; font-size:20px; line-height:1.2; font-weight:900; }
        .pwfb-reference-welcome p { margin:5px 0 0; color:#6b726e; font-size:11px; }
        .pwfb-reference-form { display:flex; flex-direction:column; gap:12px; }
        .pwfb-reference-input { height:46px; display:flex; align-items:center; gap:10px; padding:0 12px; border:1px solid #d6ddd9; border-radius:7px; background:#fff; box-shadow:0 1px 2px rgba(0,0,0,.02); }
        .pwfb-reference-input:focus-within { border-color:#0f7b35; box-shadow:0 0 0 3px rgba(15,123,53,.08); }
        .pwfb-input-icon { width:20px; flex:0 0 20px; display:grid; place-items:center; color:#4c5550; }
        .pwfb-input-icon svg,.pwfb-eye-button svg { width:18px; height:18px; fill:none; stroke:currentColor; stroke-width:1.7; stroke-linecap:round; stroke-linejoin:round; }
        .pwfb-reference-input input { min-width:0; flex:1; border:0; outline:0; background:transparent; color:#202621; font-size:11px; }
        .pwfb-reference-input input::placeholder { color:#777d79; opacity:1; }
        .pwfb-eye-button { width:24px; height:30px; display:grid; place-items:center; padding:0; border:0; background:transparent; color:#4f5753; }
        .pwfb-reference-options { display:flex; align-items:center; justify-content:space-between; gap:8px; margin:0 1px 2px; }
        .pwfb-reference-remember { display:flex; align-items:center; gap:7px; color:#5c625e; font-size:10px; }
        .pwfb-reference-remember input { width:14px; height:14px; margin:0; accent-color:#0f7b35; }
        .pwfb-reference-forgot { padding:0; border:0; background:transparent; color:#f47712; font-size:10px; font-weight:700; }
        .pwfb-reference-message { padding:8px 10px; border-radius:6px; background:#fff4e5; color:#a94d00; font-size:10px; line-height:1.35; text-align:center; }
        .pwfb-reference-login-button { height:43px; border:0; border-radius:6px; background:#087534; color:#fff; font-size:12px; font-weight:800; box-shadow:0 5px 12px rgba(8,117,52,.16); }
        .pwfb-reference-login-button:hover { background:#075f2b; }
        .pwfb-reference-login-button:disabled { opacity:.65; }
        .pwfb-reference-divider { display:flex; align-items:center; gap:12px; margin:0; color:#777d79; font-size:10px; }
        .pwfb-reference-divider::before,.pwfb-reference-divider::after { content:""; height:1px; flex:1; background:#e1e5e3; }
        .pwfb-reference-secondary { height:43px; position:relative; display:flex; align-items:center; justify-content:center; gap:9px; border:1px solid #d9dfdc; border-radius:6px; background:#fff; color:#252a27; font-size:11px; font-weight:600; }
        .pwfb-reference-secondary:hover { background:#fafcfb; border-color:#c5d1c9; }
        .pwfb-google-mark { position:absolute; left:14px; font-size:18px; line-height:1; font-family:Arial,sans-serif; font-weight:800; color:#4285f4; }
        .pwfb-fingerprint-mark { position:absolute; left:14px; display:grid; place-items:center; color:#0f8a45; }
        .pwfb-fingerprint-mark svg { width:22px; height:22px; fill:none; stroke:currentColor; stroke-width:1.45; stroke-linecap:round; stroke-linejoin:round; }
        .pwfb-reference-footer { position:relative; z-index:3; display:flex; align-items:center; justify-content:center; gap:6px; margin-top:24px; color:#77807a; font-size:9px; }
        .pwfb-reference-footer i { color:#c0c7c2; font-style:normal; }
        .pwfb-reference-wave { position:absolute; z-index:1; left:-8%; right:-8%; bottom:-48px; height:105px; border-radius:50% 50% 0 0; background:linear-gradient(175deg,#f57912 0 12%,#f57912 12% 19%,#0d7535 20% 100%); transform:rotate(-3deg); }
        @media (max-width:560px) { .pwfb-reference-login { padding:0; background:#fff; } .pwfb-login-phone { width:100%; max-height:none; min-height:100dvh; aspect-ratio:9/16; border:0; border-radius:0; box-shadow:none; } }
        @media (max-height:760px) and (min-width:561px) { .pwfb-login-inner { padding-top:20px; } .pwfb-reference-welcome { margin-top:18px; margin-bottom:14px; } .pwfb-reference-form { gap:9px; } .pwfb-reference-secondary,.pwfb-reference-login-button,.pwfb-reference-input { height:40px; } .pwfb-reference-footer { margin-top:12px; } }
      `}</style>
    </main>
  );
}
