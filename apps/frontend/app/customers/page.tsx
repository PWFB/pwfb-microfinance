"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../lib/api";

interface Customer { id: string; firstName: string; middleName?: string | null; lastName: string; email?: string; phone?: string; status?: string; createdAt?: string; }

const initials = (c: Customer) => `${c.firstName?.[0] || ""}${c.lastName?.[0] || ""}`.toUpperCase();
const fullName = (c: Customer) => [c.firstName, c.middleName, c.lastName].filter(Boolean).join(" ");

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [view, setView] = useState<"directory" | "recent">("directory");

  useEffect(() => {
    apiRequest("/customers").then((data) => setCustomers(Array.isArray(data) ? data : [])).catch(() => setCustomers([])).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      const matchesSearch = !q || `${fullName(c)} ${c.email || ""} ${c.phone || ""} ${c.id}`.toLowerCase().includes(q);
      const active = (c.status || "ACTIVE").toUpperCase() === "ACTIVE";
      return matchesSearch && (status === "all" || (status === "active" ? active : !active));
    });
  }, [customers, search, status]);

  const activeCount = customers.filter((c) => (c.status || "ACTIVE").toUpperCase() === "ACTIVE").length;
  const inactiveCount = customers.length - activeCount;
  const recent = [...filtered].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

  return <main className="pwfb-customer-management" style={{ maxWidth: 1500, margin: "0 auto" }}>
    <div className="pwfb-page-header" style={{ alignItems: "flex-start" }}>
      <div><p className="pwfb-eyebrow">CUSTOMER MANAGEMENT</p><h1 className="pwfb-page-title">Customer Management</h1><p className="pwfb-page-description">A single workspace for customer profiles, onboarding, contact records and account activity.</p></div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><Link href="/dashboard" className="pwfb-secondary-button">← Dashboard</Link><Link href="/customers/add" className="pwfb-primary-button">+ Add Customer</Link></div>
    </div>

    <section className="pwfb-stat-grid" style={{ gridTemplateColumns: "repeat(4,minmax(0,1fr))" }}>
      <div className="pwfb-stat-card"><span>Total Customers</span><strong>{loading ? "—" : customers.length.toLocaleString()}</strong><small>All registered customers</small></div>
      <div className="pwfb-stat-card"><span>Active</span><strong>{loading ? "—" : activeCount.toLocaleString()}</strong><small>Currently active profiles</small></div>
      <div className="pwfb-stat-card pwfb-stat-orange"><span>Inactive</span><strong>{loading ? "—" : inactiveCount.toLocaleString()}</strong><small>Require attention</small></div>
      <div className="pwfb-stat-card"><span>Workspace</span><strong>Live</strong><small>Customer records connected</small></div>
    </section>

    <section className="pwfb-panel" style={{ marginBottom: 18 }}>
      <div className="pwfb-panel-header"><div><h2>Customer workspace</h2><p>Find a customer quickly or switch between the main directory and recent records.</p></div><span className="pwfb-record-count">{filtered.length} matching</span></div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(240px,1fr) 180px auto", gap: 10, alignItems: "end", padding: "0 18px 18px" }}>
        <label style={{ fontWeight: 600 }}>Search customer<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, phone, email or customer ID" style={{ display: "block", width: "100%", marginTop: 6, padding: 11, border: "1px solid #d0d5dd", borderRadius: 10 }} /></label>
        <label style={{ fontWeight: 600 }}>Status<select value={status} onChange={(e) => setStatus(e.target.value)} style={{ display: "block", width: "100%", marginTop: 6, padding: 11, border: "1px solid #d0d5dd", borderRadius: 10, background: "#fff" }}><option value="all">All customers</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
        <div style={{ display: "flex", gap: 6 }}><button type="button" onClick={() => setView("directory")} style={{ padding: "10px 13px", borderRadius: 9, border: "1px solid #d0d5dd", background: view === "directory" ? "#e9f7ef" : "#fff", color: "#126b35", fontWeight: 700 }}>Directory</button><button type="button" onClick={() => setView("recent")} style={{ padding: "10px 13px", borderRadius: 9, border: "1px solid #d0d5dd", background: view === "recent" ? "#e9f7ef" : "#fff", color: "#126b35", fontWeight: 700 }}>Recent</button></div>
      </div>
    </section>

    <section className="pwfb-panel">
      <div className="pwfb-panel-header"><div><h2>{view === "directory" ? "Customer Directory" : "Recent Customers"}</h2><p>{view === "directory" ? "Profiles available to authorized staff for customer service and operations." : "Newest customer records first."}</p></div></div>
      {loading ? <div className="pwfb-empty-state"><div className="pwfb-loading-dot" /><p>Loading customer records...</p></div> : (view === "recent" ? recent : filtered).length === 0 ? <div className="pwfb-empty-state"><div className="pwfb-empty-icon">👥</div><h3>No customers found</h3><p>Try changing the search or filters, or add a new customer.</p><Link href="/customers/add" className="pwfb-secondary-button">Add Customer</Link></div> : <div className="pwfb-table-wrap"><table className="pwfb-table"><thead><tr><th>Customer</th><th>Contact</th><th>Customer ID</th><th>Status</th><th>Actions</th></tr></thead><tbody>{(view === "recent" ? recent : filtered).map((customer) => { const active = (customer.status || "ACTIVE").toUpperCase() === "ACTIVE"; return <tr key={customer.id}><td><div className="pwfb-customer-cell"><div className="pwfb-avatar">{initials(customer)}</div><div><strong>{fullName(customer)}</strong><small>{customer.email || "No email provided"}</small></div></div></td><td>{customer.phone || "—"}</td><td><code>{customer.id}</code></td><td><span className="pwfb-status-badge" style={!active ? { background: "#f2f4f7", color: "#475467" } : undefined}>{active ? "Active" : "Inactive"}</span></td><td><div className="pwfb-actions"><Link href={`/customers/view/${customer.id}`} className="pwfb-action-view">View</Link><Link href={`/customers/view/${customer.id}`} className="pwfb-action-edit">Manage</Link></div></td></tr>; })}</tbody></table></div>}
    </section>
  </main>;
}
