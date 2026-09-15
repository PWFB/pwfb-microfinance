"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "";
const money = (v: any) => `₦${Number(v || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ApprovalsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    const r = await fetch(`${API}/approvals`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
    if (!r.ok) throw new Error("Unable to load approval queue.");
    setRows(await r.json());
  }, []);

  useEffect(() => { load().catch(e => setMessage(e.message)).finally(() => setLoading(false)); }, [load]);

  async function decide(id: string, action: "approve" | "reject") {
    const reason = action === "reject" ? window.prompt("Reason for rejection (optional):") || "" : "";
    if (action === "reject" && !window.confirm("Reject this loan disbursement?")) return;
    if (action === "approve" && !window.confirm("Approve and release this loan disbursement?")) return;
    setBusy(id + action); setMessage("");
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const r = await fetch(`${API}/approvals/${id}/${action}`, { method: "POST", headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json" }, body: JSON.stringify({ reason }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.message || `Unable to ${action} disbursement.`);
      setMessage(action === "approve" ? "Loan approved and disbursement request processed." : "Loan disbursement rejected.");
      await load();
    } catch (e: any) { setMessage(e.message || "Operation failed."); }
    finally { setBusy(""); }
  }

  return <main style={{ maxWidth: 1180, margin: "0 auto", padding: "10px 0 50px" }}>
    <section style={{ borderRadius: 24, padding: 30, color: "#fff", background: "linear-gradient(135deg,#063d2b,#0d6947)" }}>
      <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: ".14em", opacity: .75 }}>PWFB • APPROVAL CONTROL CENTER</span>
      <h1 style={{ margin: "8px 0", fontSize: "clamp(28px,4vw,38px)" }}>Approval Queue</h1>
      <p style={{ margin: 0, maxWidth: 760, lineHeight: 1.6, opacity: .9 }}>Review controlled loan disbursements within your organizational scope. Approval executes the existing secured disbursement workflow.</p>
    </section>

    <section style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12 }}>
      <div style={{ background: "#fff", border: "1px solid var(--pwfb-border)", borderRadius: 16, padding: 18 }}><small>Pending approvals</small><strong style={{ display: "block", fontSize: 30, marginTop: 5 }}>{rows.length}</strong></div>
      <div style={{ background: "#fff", border: "1px solid var(--pwfb-border)", borderRadius: 16, padding: 18 }}><small>Pending value</small><strong style={{ display: "block", fontSize: 22, marginTop: 8 }}>{money(rows.reduce((n, x) => n + Number(x.disbursementAmount ?? x.amount ?? 0), 0))}</strong></div>
      <Link href="/loans" style={{ background: "#fff", border: "1px solid var(--pwfb-border)", borderRadius: 16, padding: 18 }}><small>Loan operations</small><strong style={{ display: "block", marginTop: 8, color: "var(--pwfb-green-dark)" }}>Open loan register →</strong></Link>
    </section>

    {message && <div style={{ marginTop: 16, padding: 14, borderRadius: 12, background: "#fff8ed", border: "1px solid #f1dfc8" }}>{message}</div>}
    {loading ? <div style={{ marginTop: 20, padding: 24 }}>Loading approval queue…</div> : rows.length === 0 ? <div style={{ marginTop: 20, padding: 28, background: "#fff", border: "1px solid var(--pwfb-border)", borderRadius: 18 }}>No pending loan disbursements are waiting for approval.</div> : <section style={{ marginTop: 20, display: "grid", gap: 12 }}>{rows.map(x => <article key={x.id} style={{ background: "#fff", border: "1px solid var(--pwfb-border)", borderRadius: 18, padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><div><span style={{ fontSize: 11, fontWeight: 900, color: "#718078" }}>PENDING DISBURSEMENT</span><h2 style={{ margin: "5px 0" }}>{x.customerFirstName || "Customer"} {x.customerLastName || ""}</h2><div style={{ fontSize: 12, color: "#718078" }}>Loan {x.id} · {x.branchName || "Unassigned branch"}</div></div><strong style={{ fontSize: 23, color: "var(--pwfb-green-dark)" }}>{money(x.disbursementAmount ?? x.amount)}</strong></div>
      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10, fontSize: 12 }}><div><small>Branch</small><strong style={{ display: "block", marginTop: 4 }}>{x.branchName || "—"}</strong></div><div><small>Submitted</small><strong style={{ display: "block", marginTop: 4 }}>{x.createdAt ? new Date(x.createdAt).toLocaleString() : "—"}</strong></div><div><small>Customer ID</small><strong style={{ display: "block", marginTop: 4 }}>{x.customerId || "—"}</strong></div></div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 18 }}><Link href={`/loans/${x.id}`} style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid var(--pwfb-border)", fontWeight: 800 }}>View loan</Link><button disabled={!!busy} onClick={() => decide(x.id, "reject")} style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #edc9c1", background: "#fff5f2", fontWeight: 800 }}> {busy === x.id + "reject" ? "Rejecting…" : "Reject"}</button><button disabled={!!busy} onClick={() => decide(x.id, "approve")} style={{ padding: "10px 16px", borderRadius: 10, border: 0, background: "var(--pwfb-green)", color: "#fff", fontWeight: 900 }}>{busy === x.id + "approve" ? "Processing…" : "Approve & Disburse"}</button></div>
    </article>)}</section>}
  </main>;
}
