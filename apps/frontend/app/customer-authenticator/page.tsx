"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest } from "../../lib/api";

export default function CustomerAuthenticatorPage() {
  const [enabled, setEnabled] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [secret, setSecret] = useState("");
  const [otpauthUri, setOtpauthUri] = useState("");
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadStatus() {
    try {
      const result = await apiRequest("/auth/authenticator/status");
      setEnabled(Boolean(result?.enabled));
      setConfigured(Boolean(result?.configured));
    } catch (e: any) {
      setError(e?.message || "Unable to load authenticator status.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadStatus(); }, []);

  async function beginSetup() {
    setBusy(true); setError(""); setMessage(""); setRecoveryCodes([]);
    try {
      const result = await apiRequest("/auth/authenticator/setup", { method: "POST" });
      setSecret(result.secret || "");
      setOtpauthUri(result.otpauthUri || "");
      setConfigured(true);
      setMessage("Authenticator setup created. Add the PWFB account to Google Authenticator, then enter the 6-digit code below.");
    } catch (e: any) {
      setError(e?.message || "Unable to start authenticator setup.");
    } finally { setBusy(false); }
  }

  async function verifySetup() {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await apiRequest("/auth/authenticator/verify", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      setEnabled(Boolean(result?.enabled));
      setRecoveryCodes(result?.recoveryCodes || []);
      setSecret(""); setOtpauthUri(""); setCode("");
      setMessage(result?.message || "Google Authenticator enabled.");
    } catch (e: any) {
      setError(e?.message || "The authenticator code is not valid.");
    } finally { setBusy(false); }
  }

  async function disableAuthenticator() {
    if (!code.trim()) { setError("Enter your current 6-digit authenticator code first."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await apiRequest("/auth/authenticator/disable", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      setEnabled(false); setConfigured(false); setSecret(""); setOtpauthUri(""); setCode("");
      setMessage(result?.message || "Authenticator disabled.");
    } catch (e: any) {
      setError(e?.message || "Unable to disable authenticator.");
    } finally { setBusy(false); }
  }

  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setMessage("Copied to clipboard."); } catch { setError("Copy failed. Select and copy the value manually."); }
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-12">
      <div className="mx-auto w-full max-w-2xl px-4 pb-10 pt-5">
        <Link href="/customer-more" className="text-sm font-semibold text-emerald-700">← Back to More</Link>

        <header className="mt-4 rounded-3xl bg-emerald-700 p-6 text-white shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-100">Account Security</p>
          <h1 className="mt-1 text-2xl font-bold">Authenticator</h1>
          <p className="mt-1 text-sm leading-6 text-emerald-100">Protect your PWFB account with a time-based 6-digit verification code from Google Authenticator.</p>
        </header>

        {error && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>}
        {message && <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">{message}</div>}

        <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Two-step verification</h2>
              <p className="mt-1 text-sm text-slate-500">Status: {loading ? "Checking…" : enabled ? "Enabled" : "Not enabled"}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{enabled ? "ON" : "OFF"}</span>
          </div>

          {!enabled && !secret && (
            <button disabled={busy || loading} onClick={beginSetup} className="mt-5 w-full rounded-2xl bg-emerald-700 px-5 py-3.5 text-sm font-bold text-white shadow-sm disabled:opacity-50">
              {busy ? "Preparing setup…" : "Set up Google Authenticator"}
            </button>
          )}

          {secret && !enabled && (
            <div className="mt-5 space-y-5">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-bold text-slate-900">1. Add PWFB to Google Authenticator</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Open Google Authenticator → + → Enter a setup key. Use the key below. The key is only shown during setup.</p>
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
                  <code className="min-w-0 flex-1 break-all text-sm font-bold tracking-wider text-slate-800">{secret}</code>
                  <button onClick={() => copy(secret)} className="shrink-0 rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700">Copy</button>
                </div>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-bold text-amber-900">Manual setup details</p>
                <p className="mt-1 text-xs leading-5 text-amber-800">Type: Time-based (TOTP) · Digits: 6 · Period: 30 seconds · Algorithm: SHA-1</p>
                <button onClick={() => copy(otpauthUri)} className="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-bold text-amber-900 shadow-sm">Copy setup URI</button>
              </div>

              <div>
                <p className="text-sm font-bold text-slate-900">2. Enter the 6-digit code</p>
                <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-4 text-center text-2xl font-bold tracking-[0.45em] outline-none focus:border-emerald-500" />
                <button disabled={busy || code.length !== 6} onClick={verifySetup} className="mt-3 w-full rounded-2xl bg-emerald-700 px-5 py-3.5 text-sm font-bold text-white disabled:opacity-50">{busy ? "Verifying…" : "Verify and enable"}</button>
              </div>
            </div>
          )}

          {enabled && (
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl bg-emerald-50 p-4">
                <p className="font-bold text-emerald-900">Google Authenticator is active</p>
                <p className="mt-1 text-sm leading-5 text-emerald-800">Keep the authenticator app on a device you control. Never share your 6-digit codes with anyone.</p>
              </div>
              <div>
                <label className="text-sm font-bold text-slate-900">Current 6-digit code</label>
                <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-4 text-center text-2xl font-bold tracking-[0.45em] outline-none focus:border-red-400" />
                <button disabled={busy || code.length !== 6} onClick={disableAuthenticator} className="mt-3 w-full rounded-2xl border border-red-200 bg-white px-5 py-3.5 text-sm font-bold text-red-600 disabled:opacity-50">{busy ? "Disabling…" : "Disable Authenticator"}</button>
              </div>
            </div>
          )}
        </section>

        {recoveryCodes.length > 0 && (
          <section className="mt-5 rounded-3xl border border-amber-300 bg-amber-50 p-5 shadow-sm">
            <h2 className="text-lg font-bold text-amber-950">Save your recovery codes</h2>
            <p className="mt-1 text-sm leading-5 text-amber-900">These codes are shown once. Store them somewhere private in case you lose access to Google Authenticator.</p>
            <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-white p-4">
              {recoveryCodes.map((value) => <code key={value} className="rounded-lg bg-slate-50 p-2 text-center text-sm font-bold tracking-wide text-slate-800">{value}</code>)}
            </div>
            <button onClick={() => copy(recoveryCodes.join("\n"))} className="mt-3 w-full rounded-2xl bg-amber-900 px-5 py-3.5 text-sm font-bold text-white">Copy recovery codes</button>
          </section>
        )}

        <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-bold text-slate-900">Important</h2>
          <ul className="mt-3 space-y-2 text-sm leading-5 text-slate-600">
            <li>• This is different from your Google OAuth Client ID or Google API key.</li>
            <li>• Your authenticator secret is encrypted before it is stored by PWFB.</li>
            <li>• Never send your setup key or 6-digit code to PWFB staff or anyone claiming to be support.</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
