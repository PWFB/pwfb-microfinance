"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const labels: Record<string, string> = {
  WALLET_DEPOSIT: "Issue field cash",
  WALLET_WITHDRAWAL: "Settle field cash",
  BANK_TRANSFER: "Bank transfer",
  CUSTOMER_CREATE: "Register customer",
  CUSTOMER_EDIT: "Edit customer",
  SAVINGS_CREATE: "Savings deposit",
  SAVINGS_WITHDRAW: "Savings withdrawal",
  LOAN_CREATE: "Create loan",
  LOAN_DISBURSE: "Approve / disburse loan",
  COLLECTION_CREATE: "Record collection",
  COLLECTION_SETTLE: "Settle collection",
};

const routes: Record<string, { href: string; label: string; description: string }> = {
  WALLET_DEPOSIT: { href: "/staff-wallet/deposit", label: "Issue Field Cash", description: "Give a field staff member an approved working balance." },
  WALLET_WITHDRAWAL: { href: "/staff-wallet/withdrawal", label: "Settle Field Cash", description: "Return and reconcile field cash at the end of work." },
  BANK_TRANSFER: { href: "/banking?operation=transfer", label: "Bank Transfer", description: "Start an authorized banking transfer." },
  CUSTOMER_CREATE: { href: "/customers/add", label: "Register Customer", description: "Create a new customer record." },
  CUSTOMER_EDIT: { href: "/customers", label: "Customer Records", description: "Review and update customer information." },
  SAVINGS_CREATE: { href: "/savings/add", label: "Savings Deposit", description: "Create or post a customer savings deposit." },
  SAVINGS_WITHDRAW: { href: "/savings", label: "Savings Withdrawal", description: "Process an authorized savings withdrawal." },
  LOAN_CREATE: { href: "/loans/add", label: "Create Loan", description: "Prepare a new loan application." },
  LOAN_DISBURSE: { href: "/loans", label: "Loan Disbursement", description: "Review loans and perform authorized disbursement." },
  COLLECTION_CREATE: { href: "/collections", label: "Record Collection", description: "Record a customer collection against the correct operation." },
  COLLECTION_SETTLE: { href: "/collections", label: "Settle Collection", description: "Settle and reconcile recorded collections." },
};

export default function StaffAccessPage() {
  const [role, setRole] = useState("STAFF");
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/permissions/me`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      .then(async (response) => { if (!response.ok) throw new Error("Unable to load your operational access."); return response.json(); })
      .then((data) => { setRole(String(data.role || "STAFF")); setPermissions(data.permissions || {}); })
      .catch((e) => setError(e?.message || "Unable to load access."))
      .finally(() => setLoading(false));
  }, []);

  const allowed = useMemo(() => Object.keys(labels).filter((key) => permissions[key]), [permissions]);
  const restricted = useMemo(() => Object.keys(labels).filter((key) => permissions[key] === false), [permissions]);

  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: "10px 0 50px" }}>
      <section style={{ borderRadius: 24, padding: "30px", background: "linear-gradient(135deg,#063d2b,#0d6947)", color: "#fff", boxShadow: "0 18px 45px rgba(6,61,43,.16)" }}>
        <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: ".14em", opacity: .75 }}>PWFB • STAFF ACCESS</span>
        <h1 style={{ margin: "8px 0", fontSize: "clamp(28px,4vw,38px)" }}>My Operations</h1>
        <p style={{ margin: 0, maxWidth: 760, lineHeight: 1.65, opacity: .9 }}>Your operational workspace is controlled by your assigned role and the permissions granted to that role. Restricted actions remain blocked by the backend.</p>
        <div style={{ display: "inline-flex", marginTop: 18, padding: "8px 13px", borderRadius: 999, background: "rgba(255,255,255,.12)", fontSize: 12, fontWeight: 800 }}>{role.replaceAll("_", " ")}</div>
      </section>

      {loading ? <div style={{ marginTop: 20, padding: 24, border: "1px solid var(--pwfb-border)", borderRadius: 18, background: "#fff" }}>Loading your operational access…</div> : <>
        <section style={{ marginTop: 20, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12 }}>
          <div style={{ padding: 18, borderRadius: 16, background: "#fff", border: "1px solid var(--pwfb-border)" }}><small style={{ color: "#718078" }}>Allowed operations</small><strong style={{ display: "block", fontSize: 28, marginTop: 5 }}>{allowed.length}</strong></div>
          <div style={{ padding: 18, borderRadius: 16, background: "#fff", border: "1px solid var(--pwfb-border)" }}><small style={{ color: "#718078" }}>Restricted operations</small><strong style={{ display: "block", fontSize: 28, marginTop: 5 }}>{restricted.length}</strong></div>
          <div style={{ padding: 18, borderRadius: 16, background: "#fff", border: "1px solid var(--pwfb-border)" }}><small style={{ color: "#718078" }}>Access model</small><strong style={{ display: "block", fontSize: 15, marginTop: 8 }}>Role + Organization Scope</strong></div>
        </section>

        <section style={{ marginTop: 26 }}>
          <div style={{ marginBottom: 12 }}><span style={{ fontSize: 11, letterSpacing: ".13em", fontWeight: 900, color: "#718078" }}>AVAILABLE TO YOU</span><h2 style={{ margin: "4px 0", fontSize: 22 }}>Allowed operations</h2></div>
          {allowed.length === 0 ? <div style={{ padding: 22, borderRadius: 16, background: "#fff", border: "1px solid var(--pwfb-border)" }}>No financial operation permissions are currently assigned to this role.</div> : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 12 }}>{allowed.map((key) => { const item = routes[key]; return <Link key={key} href={item.href} style={{ display: "block", padding: 18, borderRadius: 16, background: "#fff", border: "1px solid var(--pwfb-border)", boxShadow: "var(--pwfb-shadow)" }}><strong style={{ display: "block", color: "var(--pwfb-green-dark)" }}>{item.label}</strong><span style={{ display: "block", marginTop: 6, color: "#718078", fontSize: 12, lineHeight: 1.5 }}>{item.description}</span><span style={{ display: "block", marginTop: 12, color: "var(--pwfb-orange-dark)", fontSize: 12, fontWeight: 800 }}>Open operation →</span></Link>; })}</div>}
        </section>

        <section style={{ marginTop: 26 }}>
          <div style={{ marginBottom: 12 }}><span style={{ fontSize: 11, letterSpacing: ".13em", fontWeight: 900, color: "#718078" }}>PROTECTED</span><h2 style={{ margin: "4px 0", fontSize: 22 }}>Restricted operations</h2></div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{restricted.map((key) => <span key={key} style={{ padding: "9px 12px", borderRadius: 999, background: "#fff4f1", border: "1px solid #f1d7d0", color: "#9b4a3b", fontSize: 12, fontWeight: 700 }}>🔒 {labels[key]}</span>)}</div>
        </section>
      </>}
      {error && <div style={{ marginTop: 18, padding: 14, borderRadius: 12, background: "#fff1f1", color: "#a13a3a" }}>{error}</div>}
    </main>
  );
}
