"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../lib/api";

interface Customer {
  id: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  email?: string;
  phone?: string;
  status?: string;
  createdAt?: string;
}

const initials = (c: Customer) => `${c.firstName?.[0] || ""}${c.lastName?.[0] || ""}`.toUpperCase();
const fullName = (c: Customer) => [c.firstName, c.middleName, c.lastName].filter(Boolean).join(" ");

const operations = [
  { label: "Customer", description: "Profiles & onboarding", href: "/customers", icon: "👥" },
  { label: "Loan", description: "Loans & repayments", href: "/loans", icon: "▣" },
  { label: "Staff", description: "Staff & access", href: "/staff", icon: "♙" },
  { label: "Savings", description: "Savings accounts", href: "/savings", icon: "₦" },
  { label: "Daily Deposits", description: "Today's deposits", href: "/banking?operation=deposit", icon: "↓" },
  { label: "Daily Withdrawals", description: "Today's withdrawals", href: "/banking?operation=withdraw", icon: "↑" },
  { label: "Transfer", description: "Customer transfers", href: "/banking?operation=transfer", icon: "⇄" },
];

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [view, setView] = useState<"directory" | "recent">("directory");

  useEffect(() => {
    apiRequest("/customers")
      .then((d) => setCustomers(Array.isArray(d) ? d : d?.data ?? []))
      .catch(() => setCustomers([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () =>
      customers.filter((c) => {
        const q = search.trim().toLowerCase();
        const match = !q || `${fullName(c)} ${c.email || ""} ${c.phone || ""} ${c.id}`.toLowerCase().includes(q);
        const active = (c.status || "ACTIVE").toUpperCase() === "ACTIVE";
        return match && (status === "all" || (status === "active" ? active : !active));
      }),
    [customers, search, status],
  );

  const active = customers.filter((c) => (c.status || "ACTIVE").toUpperCase() === "ACTIVE").length;
  const recent = [...filtered].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const rows = view === "recent" ? recent : filtered;

  return (
    <main className="pwfb-customer-management" style={{ maxWidth: 1500, margin: "0 auto" }}>
      <div className="pwfb-page-header" style={{ alignItems: "flex-start" }}>
        <div>
          <p className="pwfb-eyebrow">CUSTOMER MANAGEMENT</p>
          <h1 className="pwfb-page-title">Customer Management</h1>
          <p className="pwfb-page-description">A single workspace for customer profiles, onboarding, contact records and account activity.</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/dashboard" className="pwfb-secondary-button">← Dashboard</Link>
          <Link href="/customers/add" className="pwfb-primary-button">+ Add Customer</Link>
        </div>
      </div>

      <section className="pwfb-panel" style={{ marginBottom: 18, background: "linear-gradient(135deg,#075c32 0%,#0b7441 100%)", color: "#fff", border: "none", boxShadow: "0 14px 34px rgba(7,92,50,.16)" }}>
        <div style={{ padding: "22px 20px 16px" }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 800, letterSpacing: 1.4, opacity: .82 }}>OPERATIONAL CONTROL CENTER</p>
          <h2 style={{ margin: "6px 0 4px", color: "#fff", fontSize: 24 }}>Daily Operations</h2>
          <p style={{ margin: 0, color: "rgba(255,255,255,.78)" }}>Quick access to customer, loan, staff, savings and daily transaction operations.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: 10, padding: "0 20px 20px" }}>
          {operations.map((item) => (
            <Link key={item.label} href={item.href} style={{ textDecoration: "none", color: "#fff", background: "rgba(255,255,255,.11)", border: "1px solid rgba(255,255,255,.16)", borderRadius: 14, padding: "14px 12px", minHeight: 92, transition: "transform .15s ease,background .15s ease" }}>
              <span style={{ display: "flex", width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 10, background: "rgba(255,255,255,.15)", fontSize: 18, fontWeight: 800 }}>{item.icon}</span>
              <strong style={{ display: "block", marginTop: 10, fontSize: 14 }}>{item.label}</strong>
              <small style={{ display: "block", marginTop: 3, color: "rgba(255,255,255,.68)", lineHeight: 1.3 }}>{item.description}</small>
            </Link>
          ))}
        </div>
      </section>

      <section className="pwfb-stat-grid" style={{ gridTemplateColumns: "repeat(4,minmax(0,1fr))", marginBottom: 18 }}>
        <div className="pwfb-stat-card"><span>Total Customers</span><strong>{loading ? "—" : customers.length.toLocaleString()}</strong><small>All registered customers</small></div>
        <div className="pwfb-stat-card"><span>Active</span><strong>{loading ? "—" : active.toLocaleString()}</strong><small>Currently active profiles</small></div>
        <div className="pwfb-stat-card pwfb-stat-orange"><span>Inactive</span><strong>{loading ? "—" : (customers.length - active).toLocaleString()}</strong><small>Require attention</small></div>
        <div className="pwfb-stat-card"><span>Workspace</span><strong>Live</strong><small>Customer records connected</small></div>
      </section>

      <section className="pwfb-panel" style={{ marginBottom: 18 }}>
        <div className="pwfb-panel-header" style={{ alignItems: "center" }}>
          <div><h2>Customer workspace</h2><p>Find a customer quickly or switch between the main directory and recent records.</p></div>
          <span className="pwfb-record-count" style={{ background: "#e9f7ef", color: "#126b35", borderRadius: 999, padding: "8px 12px", fontWeight: 800, whiteSpace: "nowrap" }}>{filtered.length} matching</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 190px auto", gap: 12, alignItems: "end", padding: "0 18px 18px" }}>
          <label style={{ fontWeight: 700, color: "#126b35" }}>Search customer<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, phone, email or customer ID" style={{ display: "block", width: "100%", marginTop: 7, padding: "12px 13px", border: "1px solid #d0d5dd", borderRadius: 11, boxSizing: "border-box" }} /></label>
          <label style={{ fontWeight: 700, color: "#126b35" }}>Status<select value={status} onChange={(e) => setStatus(e.target.value)} style={{ display: "block", width: "100%", marginTop: 7, padding: "12px 13px", border: "1px solid #d0d5dd", borderRadius: 11, background: "#fff", boxSizing: "border-box" }}><option value="all">All customers</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
          <div style={{ display: "flex", gap: 7 }}><button type="button" onClick={() => setView("directory")} style={{ padding: "11px 14px", borderRadius: 10, border: "1px solid #d0d5dd", background: view === "directory" ? "#e9f7ef" : "#fff", color: "#126b35", fontWeight: 800 }}>Directory</button><button type="button" onClick={() => setView("recent")} style={{ padding: "11px 14px", borderRadius: 10, border: "1px solid #d0d5dd", background: view === "recent" ? "#e9f7ef" : "#fff", color: "#126b35", fontWeight: 800 }}>Recent</button></div>
        </div>
      </section>

      <section className="pwfb-panel">
        <div className="pwfb-panel-header"><div><h2>{view === "directory" ? "Customer Directory" : "Recent Customers"}</h2><p>{view === "directory" ? "Profiles available to authorized staff for customer service and operations." : "Newest customer records first."}</p></div></div>
        {loading ? <div className="pwfb-empty-state"><div className="pwfb-loading-dot" /><p>Loading customer records...</p></div> : rows.length === 0 ? <div className="pwfb-empty-state"><div className="pwfb-empty-icon">👥</div><h3>No customers found</h3><p>Try changing the search or filters, or add a new customer.</p><Link href="/customers/add" className="pwfb-secondary-button">Add Customer</Link></div> : <div className="pwfb-table-wrap"><table className="pwfb-table"><thead><tr><th>Customer</th><th>Contact</th><th>Customer ID</th><th>Status</th><th>Actions</th></tr></thead><tbody>{rows.map((c) => { const ok = (c.status || "ACTIVE").toUpperCase() === "ACTIVE"; return <tr key={c.id}><td><div className="pwfb-customer-cell"><div className="pwfb-avatar">{initials(c)}</div><div><strong>{fullName(c)}</strong><small>{c.email || "No email provided"}</small></div></div></td><td>{c.phone || "—"}</td><td><code>{c.id}</code></td><td><span className="pwfb-status-badge" style={!ok ? { background: "#f2f4f7", color: "#475467" } : undefined}>{ok ? "Active" : "Inactive"}</span></td><td><div className="pwfb-actions"><Link href={`/customers/view/${c.id}`} className="pwfb-action-view">View</Link><Link href={`/customers/view/${c.id}`} className="pwfb-action-edit">Manage</Link></div></td></tr>; })}</tbody></table></div>}
      </section>

      <style jsx>{`
        @media (max-width: 900px) {
          .pwfb-panel :global(.pwfb-panel-header) { flex-direction: column; align-items: flex-start !important; }
          .pwfb-customer-management section > div[style*="repeat(7"] { grid-template-columns: repeat(4, minmax(0,1fr)) !important; }
        }
        @media (max-width: 640px) {
          .pwfb-customer-management { width: 100%; }
          .pwfb-customer-management section > div[style*="repeat(7"] { grid-template-columns: repeat(2, minmax(0,1fr)) !important; padding: 0 14px 14px !important; }
          .pwfb-customer-management section > div[style*="minmax(0,1fr) 190px auto"] { grid-template-columns: 1fr !important; }
          .pwfb-customer-management section > div[style*="minmax(0,1fr) 190px auto"] > div { width: 100%; }
          .pwfb-customer-management section > div[style*="minmax(0,1fr) 190px auto"] button { flex: 1; }
          .pwfb-stat-grid { grid-template-columns: repeat(2,minmax(0,1fr)) !important; }
        }
      `}</style>
    </main>
  );
}
