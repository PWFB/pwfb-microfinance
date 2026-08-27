"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "";

type Branch = { id: string; name: string; code?: string; location?: string; status?: string; branchAccounts?: { accountNumber: string; accountName?: string; status?: string }[] };

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API}/branches`, { credentials: "include" })
      .then(async r => { if (!r.ok) throw new Error("Unable to load branches"); return r.json(); })
      .then(data => setBranches(Array.isArray(data) ? data : data.data || data.branches || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main>
      <div className="pwfb-page-header">
        <div><p className="pwfb-eyebrow">SUPER ADMIN • BRANCH MANAGEMENT</p><h1 className="pwfb-page-title">Branches</h1><p className="pwfb-page-description">Manage every PWFB branch and its virtual account.</p></div>
        <Link href="/dashboard" className="pwfb-secondary-button">← Dashboard</Link>
      </div>
      <section className="pwfb-stat-grid">
        <div className="pwfb-stat-card"><span>Total Branches</span><strong>{branches.length}</strong><small>Database records</small></div>
        <div className="pwfb-stat-card pwfb-stat-orange"><span>Virtual Accounts</span><strong>{branches.filter(b => b.branchAccounts?.length).length}</strong><small>Provisioned branch accounts</small></div>
      </section>
      <section className="pwfb-panel">
        <div className="pwfb-panel-header"><div><h2>Branch Directory</h2><p>Exact branch records from the database.</p></div><span className="pwfb-record-count">{branches.length} records</span></div>
        {loading ? <div className="p-6">Loading branches…</div> : error ? <div className="p-6 text-red-600">{error}</div> :
        <div className="pwfb-table-wrap"><table className="pwfb-table"><thead><tr><th>Branch</th><th>Code</th><th>Location</th><th>Virtual Account</th><th>Status</th><th>Action</th></tr></thead><tbody>
          {branches.map(branch => { const account = branch.branchAccounts?.[0]; return <tr key={branch.id}><td><strong>{branch.name}</strong></td><td>{branch.code || "—"}</td><td>{branch.location || "—"}</td><td><strong>{account?.accountNumber || "Not provisioned"}</strong></td><td><span className="pwfb-status-badge">{branch.status || "Active"}</span></td><td><Link className="pwfb-secondary-button" href={`/branches/${branch.id}`}>View / Edit</Link></td></tr>; })}
        </tbody></table></div>}
      </section>
    </main>
  );
}
