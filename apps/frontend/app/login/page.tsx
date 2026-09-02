"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { startAuthentication } from "@simplewebauthn/browser";
import { apiRequest } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
const GOOGLE_NONCE_KEY = "pwfb_google_oidc_nonce";

declare global { interface Window { google?: any } }

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { refreshProfile } = useAuth();
  const googleRef = useRef<HTMLDivElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const destinationFor = (role?: string) => role === "CUSTOMER" ? "/customer-dashboard" : role === "SUPER_ADMIN" ? "/dashboard" : "/staff-dashboard";

  const finishLogin = async (data: any) => {
    if (!data?.access_token) throw new Error(data?.message || "Login failed");
    (remember ? localStorage : sessionStorage).setItem("token", data.access_token);
    try { await refreshProfile(); } catch {}
    if (params.get("registerPasskey") === "1") router.replace("/passkey/register?newDevice=1");
    else window.location.replace(destinationFor(data.user?.role));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setMessage(""); setLoading(true);
    try { await finishLogin(await apiRequest("/auth/login", { method: "POST", body: JSON.stringify({ email: email.trim().toLowerCase(), password }) })); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Unable to connect to the server"); }
    finally { setLoading(false); }
  };

  const googleLogin = async (response: any) => {
    setLoading(true); setMessage("");
    try {
      const nonce = localStorage.getItem(GOOGLE_NONCE_KEY);
      if (!response?.credential || !nonce) throw new Error("Google sign-in session expired. Please try again.");
      await finishLogin(await apiRequest("/auth/google", { method: "POST", body: JSON.stringify({ credential: response.credential, client_id: GOOGLE_CLIENT_ID, nonce }) }));
      localStorage.removeItem(GOOGLE_NONCE_KEY);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Google sign-in failed"); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let active = true;
    const render = () => {
      if (!active || !window.google?.accounts?.id || !googleRef.current) return;
      const bytes = new Uint8Array(32); crypto.getRandomValues(bytes);
      const nonce = Array.from(bytes, v => v.toString(16).padStart(2, "0")).join("");
      localStorage.setItem(GOOGLE_NONCE_KEY, nonce);
      googleRef.current.innerHTML = "";
      window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: googleLogin, nonce, auto_select: false, cancel_on_tap_outside: true });
      window.google.accounts.id.renderButton(googleRef.current, { type: "standard", theme: "outline", size: "large", text: "signin_with", shape: "rectangular", logo_alignment: "left", width: 350 });
    };
    if (window.google?.accounts?.id) render();
    else { const script = document.createElement("script"); script.src = "https://accounts.google.com/gsi/client"; script.async = true; script.defer = true; script.onload = render; document.head.appendChild(script); }
    return () => { active = false; };
  }, []);

  const fingerprintLogin = async () => {
    setMessage(""); setLoading(true);
    try {
      if (!("credentials" in navigator) || !("PublicKeyCredential" in window)) throw new Error("PASSKEY_UNSUPPORTED");
      const options = await apiRequest("/auth/passkey/login/options", { method: "POST", body: JSON.stringify({ email: email.trim().toLowerCase() }) });
      const credential = await startAuthentication({ optionsJSON: options });
      await finishLogin(await apiRequest("/auth/passkey/login/verify", { method: "POST", body: JSON.stringify({ credential, challenge: options.challenge }) }));
    } catch (e: any) {
      if (e?.message === "PASSKEY_UNSUPPORTED" || e?.name === "NotSupportedError") setMessage("This browser cannot use passkeys. Sign in normally first, then register this phone in PWFB Security.");
      else if (e?.name === "NotAllowedError" || /not registered|not available|could not be used/i.test(e?.message || "")) setMessage("This phone has no PWFB passkey yet. Sign in with your password first, then register this phone's fingerprint.");
      else setMessage(e instanceof Error ? e.message : "Fingerprint login failed");
    } finally { setLoading(false); }
  };

  return <main className="login-page"><section className="login-shell"><div className="brand-panel"><div className="brand-mark"><img src="/pwfb-login-logo.svg" alt="PWFB Perfect Wisdom For Better Ltd" /></div><div className="brand-copy"><h2>Banking made<br/>simple &amp; secure.</h2><p>Moving Forward Together For Better Living..........</p></div><div className="brand-pills"><span>Secure</span><span>Reliable</span><span>Always With You</span></div></div><div className="login-card"><div className="mobile-logo"><img src="/pwfb-login-logo.svg" alt="PWFB"/></div><div className="welcome"><h1>Welcome Back!</h1><p>Sign in to your account</p></div><form onSubmit={submit}><label className="input"><span>◯</span><input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="username webauthn"/></label><label className="input"><span>🔒</span><input type={showPassword?"text":"password"} placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password"/><button type="button" onClick={()=>setShowPassword(v=>!v)}>{showPassword?"Hide":"Show"}</button></label><div className="options"><label><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/> Remember me</label><button type="button">Forgot Password?</button></div>{message&&<div className="message">{message}</div>}<button className="login-button" disabled={loading}>{loading?"Signing in…":"Login"}</button><div className="or"><span>OR</span></div><div className="google-slot" ref={googleRef}></div><button type="button" className="finger" disabled={loading} onClick={fingerprintLogin}>⌁ <span>Use fingerprint on this device</span></button></form><footer>Secure <b>•</b> Reliable <b>•</b> Always With You</footer></div></section><style jsx>{`*{box-sizing:border-box}.login-page{min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:40px;background:#087534;font-family:Inter,system-ui,sans-serif}.login-shell{width:min(1100px,100%);min-height:650px;display:grid;grid-template-columns:1fr 470px;border-radius:28px;overflow:hidden;background:#fff;box-shadow:0 28px 70px rgba(0,0,0,.22)}.brand-panel{padding:58px;background:linear-gradient(145deg,#075d2a,#087534 60%,#064820);color:#fff;display:flex;flex-direction:column;justify-content:center}.brand-mark{width:300px;padding:10px 14px;border-radius:14px;background:#fff}.brand-mark img,.mobile-logo img{display:block;width:100%;height:auto}.brand-copy{margin-top:40px}.brand-copy h2{font-size:42px;line-height:1.05;margin:0 0 16px;font-weight:900}.brand-copy p{font-size:15px;max-width:370px;line-height:1.7;color:rgba(255,255,255,.84)}.brand-pills{display:flex;gap:9px;margin-top:48px;flex-wrap:wrap}.brand-pills span{border:1px solid rgba(255,255,255,.2);padding:8px 12px;border-radius:99px;font-size:11px}.login-card{padding:64px 54px 35px;display:flex;flex-direction:column;justify-content:center}.mobile-logo{display:none}.welcome{text-align:center;margin-bottom:30px}.welcome h1{margin:0;color:#087534;font-size:30px;font-weight:900}.welcome p{margin:7px 0;color:#718078;font-size:13px}.login-card form{display:flex;flex-direction:column;gap:13px}.input{height:52px;border:1px solid #d9e2dc;border-radius:9px;display:flex;align-items:center;padding:0 13px;gap:10px}.input span{width:22px}.input input{border:0;outline:0;flex:1;min-width:0;font-size:13px}.input button,.options button{border:0;background:none;color:#ed7411;font-size:11px}.options{display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#68736d}.options label{display:flex;gap:6px;align-items:center}.login-button,.finger{height:48px;border-radius:8px;font-size:13px;font-weight:800}.login-button{border:0;background:#087534;color:#fff}.or{display:flex;align-items:center;gap:12px;color:#88918c;font-size:10px}.or:before,.or:after{content:"";height:1px;background:#e4e9e6;flex:1}.google-slot{min-height:48px;display:flex;align-items:center;justify-content:center;overflow:hidden}.finger{border:1px solid #d9e2dc;background:#fff;color:#29312d;display:flex;align-items:center;justify-content:center;gap:9px}.message{background:#fff2e6;color:#a34b00;padding:10px;border-radius:8px;text-align:center;font-size:11px}.login-card footer{text-align:center;color:#8a948e;font-size:9px;margin-top:26px}.login-card footer b{color:#f47712;margin:0 5px}@media(max-width:760px){.login-page{padding:0;background:#087534}.login-shell{display:block;width:100%;min-height:100dvh;border-radius:0}.brand-panel{height:145px;padding:0}.brand-mark,.brand-copy,.brand-pills{display:none}.login-card{min-height:calc(100dvh - 145px);padding:25px 24px;justify-content:flex-start}.mobile-logo{display:block;text-align:center;margin-top:-12px;margin-bottom:7px}.mobile-logo img{width:min(285px,88vw);background:#fff;border-radius:13px;padding:7px 10px}.welcome h1{font-size:23px}.google-slot{width:100%}}`}</style></main>;
}
