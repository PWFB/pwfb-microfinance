"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  { label: "Daily Withdrawals", description: "Today's withdrawals", href: "/banking?operation=cash-withdraw", icon: "↑" },
  { label: "Transfer", description: "Customer transfers", href: "/banking?operation=transfer", icon: "⇄" },
];

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [view, setView] = useState<"directory" | "recent">("directory");

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const d = await apiRequest("/customers");
      setCustomers(Array.isArray(d) ? d : d?.data ?? []);
    } catch (error) {
      setCustomers([]);
      setLoadError(error instanceof Error ? error.message : "Unable to load customer records.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadCustomers(); }, [loadCustomers]);

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

      <section aria-label="Customer shortcuts" className="pwfb-panel" style={{ marginBottom: 18, overflow: "hidden", border: "1px solid #f3d5bd", background: "linear-gradient(110deg,#fffaf6 0%,#ffffff 62%,#fff4e9 100%)" }}>
        <div style={{ padding: "20px 20px 14px", display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div><p style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: 1.3, color: "#b45309" }}>QUICK ACTIONS</p><h2 style={{ margin: "5px 0 4px", color: "#182230", fontSize: 21 }}>Customer operations</h2><p style={{ margin: 0, color: "#667085", fontSize: 14 }}>Jump directly to the service you need.</p></div>
          <Link href="/customers/add" className="pwfb-primary-button">+ Register customer</Link>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 10, padding: "0 20px 20px" }}>
          {operations.filter((item) => item.label !== "Customer").map((item) => (
            <Link key={item.label} href={item.href} style={{ display: "flex", alignItems: "center", gap: 11, textDecoration: "none", color: "#182230", background: "#fff", border: "1px solid #eaecf0", borderRadius: 12, padding: "12px", minHeight: 68 }}>
              <span style={{ display: "flex", flexShrink: 0, width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 10, background: "#fff0e3", color: "#b54708", fontSize: 18, fontWeight: 800 }}>{item.icon}</span>
              <span><strong style={{ display: "block", fontSize: 13 }}>{item.label}</strong><small style={{ display: "block", marginTop: 3, color: "#667085", lineHeight: 1.3 }}>{item.description}</small></span>
            </Link>
          ))}
        </div>
      </section>

      <section aria-label="Customer summary" className="pwfb-stat-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12, marginBottom: 18 }}>
        <div className="pwfb-stat-card" style={{ borderTop: "3px solid #f97316", padding: 18 }}><span style={{ color: "#667085", fontSize: 13, fontWeight: 700 }}>Total customers</span><strong style={{ display: "block", marginTop: 9, color: "#101828", fontSize: 29 }}>{loading ? "—" : customers.length.toLocaleString()}</strong><small style={{ color: "#667085" }}>All registered profiles</small></div>
        <div className="pwfb-stat-card" style={{ borderTop: "3px solid #16a34a", padding: 18 }}><span style={{ color: "#667085", fontSize: 13, fontWeight: 700 }}>Active customers</span><strong style={{ display: "block", marginTop: 9, color: "#101828", fontSize: 29 }}>{loading ? "—" : active.toLocaleString()}</strong><small style={{ color: "#667085" }}>Profiles marked active</small></div>
        <div className="pwfb-stat-card" style={{ borderTop: "3px solid #d97706", padding: 18 }}><span style={{ color: "#667085", fontSize: 13, fontWeight: 700 }}>Inactive customers</span><strong style={{ display: "block", marginTop: 9, color: "#101828", fontSize: 29 }}>{loading ? "—" : (customers.length - active).toLocaleString()}</strong><small style={{ color: "#667085" }}>Profiles needing review</small></div>
        <div className="pwfb-stat-card" style={{ borderTop: `3px solid ${loadError ? "#dc2626" : "#64748b"}`, padding: 18 }}><span style={{ color: "#667085", fontSize: 13, fontWeight: 700 }}>Records connection</span><strong style={{ display: "block", marginTop: 9, color: loadError ? "#b42318" : "#101828", fontSize: 22 }}>{loading ? "Checking…" : loadError ? "Unavailable" : "Connected"}</strong><small style={{ color: "#667085" }}>{loadError ? "Unable to retrieve records" : "Customer service status"}</small></div>
      </section>

      <section className="pwfb-panel" style={{ marginBottom: 18 }}>
        <div className="pwfb-panel-header" style={{ alignItems: "center", padding: "18px 20px", borderBottom: "1px solid #eaecf0" }}>
          <div><p style={{ margin: "0 0 5px", color: "#b45309", fontSize: 11, fontWeight: 800, letterSpacing: 1.1 }}>DIRECTORY & SEARCH</p><h2 style={{ margin: 0, color: "#101828", fontSize: 20 }}>Customer workspace</h2><p style={{ margin: "5px 0 0", color: "#667085", fontSize: 14 }}>Search profiles, filter by status, or switch to recent registrations.</p></div>
          <span className="pwfb-record-count" style={{ background: "#fff0e3", color: "#9a3412", borderRadius: 999, padding: "8px 12px", fontWeight: 800, whiteSpace: "nowrap" }}>{filtered.length} {filtered.length === 1 ? "match" : "matches"}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14, alignItems: "end", padding: "18px 20px 20px" }}>
          <label style={{ fontWeight: 700, color: "#344054", fontSize: 13 }}>Search customers<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, phone, email or customer ID" style={{ display: "block", width: "100%", marginTop: 7, padding: "12px 13px", border: "1px solid #d0d5dd", borderRadius: 10, background: "#fff", color: "#101828", outlineColor: "#f97316", boxSizing: "border-box" }} /></label>
          <label style={{ fontWeight: 700, color: "#344054", fontSize: 13 }}>Customer status<select value={status} onChange={(e) => setStatus(e.target.value)} style={{ display: "block", width: "100%", marginTop: 7, padding: "12px 13px", border: "1px solid #d0d5dd", borderRadius: 10, background: "#fff", color: "#101828", boxSizing: "border-box" }}><option value="all">All customers</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
          <div style={{ display: "flex", gap: 7 }}><button type="button" onClick={() => setView("directory")} style={{ padding: "11px 14px", borderRadius: 10, border: "1px solid #d0d5dd", background: view === "directory" ? "#e9f7ef" : "#fff", color: "#126b35", fontWeight: 800 }}>Directory</button><button type="button" onClick={() => setView("recent")} style={{ padding: "11px 14px", borderRadius: 10, border: "1px solid #d0d5dd", background: view === "recent" ? "#e9f7ef" : "#fff", color: "#126b35", fontWeight: 800 }}>Recent</button></div>
        </div>
      </section>

      <section className="pwfb-panel">
        <div className="pwfb-panel-header"><div><h2>{view === "directory" ? "Customer Directory" : "Recent Customers"}</h2><p>{view === "directory" ? "Profiles available to authorized staff for customer service and operations." : "Newest customer records first."}</p></div></div>
        {loading ? <div className="pwfb-empty-state"><div className="pwfb-loading-dot" /><p>Loading customer records...</p></div> : loadError ? <div className="pwfb-empty-state"><div className="pwfb-empty-icon">!</div><h3>Customer records unavailable</h3><p>{loadError}</p><button type="button" className="pwfb-secondary-button" onClick={() => void loadCustomers()}>Retry</button></div> : rows.length === 0 ? <div className="pwfb-empty-state"><div className="pwfb-empty-icon">👥</div><h3>No customers found</h3><p>Try changing the search or filters, or add a new customer.</p><Link href="/customers/add" className="pwfb-secondary-button">Add Customer</Link></div> : <div className="pwfb-table-wrap"><table className="pwfb-table"><thead><tr><th>Customer</th><th>Contact</th><th>Customer ID</th><th>Status</th><th>Actions</th></tr></thead><tbody>{rows.map((c) => { const ok = (c.status || "ACTIVE").toUpperCase() === "ACTIVE"; return <tr key={c.id}><td><div className="pwfb-customer-cell"><div className="pwfb-avatar">{initials(c)}</div><div><strong>{fullName(c)}</strong><small>{c.email || "No email provided"}</small></div></div></td><td>{c.phone || "—"}</td><td><code>{c.id}</code></td><td><span className="pwfb-status-badge" style={!ok ? { background: "#f2f4f7", color: "#475467" } : undefined}>{ok ? "Active" : "Inactive"}</span></td><td><div className="pwfb-actions"><Link href={`/customers/view/${c.id}`} className="pwfb-action-view">View</Link><Link href={`/transactions?customerId=${encodeURIComponent(c.id)}`} className="pwfb-action-view">History</Link><Link href={`/customers/edit/${c.id}`} className="pwfb-action-edit">Edit</Link></div></td></tr>; })}</tbody></table></div>}
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
