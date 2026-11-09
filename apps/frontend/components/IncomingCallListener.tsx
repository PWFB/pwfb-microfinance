"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { pwfbApi } from "../lib/pwfb-api";

type IncomingCall = {
  id: string;
  type: "STAFF" | "CLIENT";
  status: string;
  direction: "INCOMING" | "OUTGOING";
  branchName?: string;
  callerFirstName?: string;
  callerLastName?: string;
  callerRole?: string;
  recipientFirstName?: string;
  recipientLastName?: string;
  recipientRole?: string;
};

export default function IncomingCallListener() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [call, setCall] = useState<IncomingCall | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading || !user) {
      setCall(null);
      return;
    }
    let alive = true;
    const refresh = async () => {
      try {
        const items: IncomingCall[] = await pwfbApi.calls.list();
        if (!alive || pathname.startsWith("/calls")) return;
        const list = Array.isArray(items) ? items : [];
        const next = list.find((item) => item.direction === "INCOMING" && item.status === "RINGING")
          || list.find((item) => item.status === "ACCEPTED")
          || null;
        setCall(next);
      } catch {
        if (alive) setCall(null);
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 2500);
    return () => { alive = false; window.clearInterval(timer); };
  }, [loading, user?.id, user?.role, pathname]);

  if (!call || pathname.startsWith("/calls")) return null;
  const incoming = call.direction === "INCOMING" && call.status === "RINGING";
  const displayName = incoming
    ? [call.callerFirstName, call.callerLastName].filter(Boolean).join(" ") || "PWFB caller"
    : call.direction === "OUTGOING"
      ? [call.recipientFirstName, call.recipientLastName].filter(Boolean).join(" ") || "PWFB contact"
      : [call.callerFirstName, call.callerLastName].filter(Boolean).join(" ") || "PWFB caller";

  const accept = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (incoming) await pwfbApi.calls.accept(call.id);
      setCall(null);
      router.push("/calls?callId=" + encodeURIComponent(call.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to open this call");
    } finally {
      setBusy(false);
    }
  };

  const decline = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await pwfbApi.calls.decline(call.id);
      setCall(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to decline this call");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pwfb-call-incoming-backdrop" role="dialog" aria-modal="true" aria-label="PWFB incoming call">
      <section className="pwfb-call-incoming-card">
        <div className="pwfb-call-ring">☎</div>
        <small>{incoming ? "INCOMING PWFB VOICE CALL" : "ACTIVE PWFB VOICE CALL"}</small>
        <h2>{displayName}</h2>
        <p>{incoming
          ? (call.callerRole || "Authorized PWFB contact").replaceAll("_", " ") + " is calling your account"
          : "Your PWFB voice call is in progress"}</p>
        <span className="pwfb-call-branch">{call.branchName || "Branch communication"}</span>
        {error && <p className="pwfb-call-error">{error}</p>}
        <div className="pwfb-call-listener-actions">
          {incoming && <button type="button" className="pwfb-call-decline" disabled={busy} onClick={() => void decline()}>Decline</button>}
          <button type="button" className="pwfb-call-open" disabled={busy} onClick={() => void accept()}>{busy ? "Connecting…" : incoming ? "Accept call" : "Return to call"}</button>
        </div>
        <span className="pwfb-call-listener-note">Keep the PWFB app open to receive incoming calls.</span>
      </section>
    </div>
  );
}
