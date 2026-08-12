"use client";

import Link from "next/link";

const branches = [
  {
    name: "Head Office",
    code: "PWFB-HQ",
    location: "Ibadan",
    status: "Active",
  },
  {
    name: "Main Branch",
    code: "PWFB-001",
    location: "Ibadan",
    status: "Active",
  },
];

export default function BranchesPage() {
  return (
    <main>
      <div className="pwfb-page-header">
        <div>
          <p className="pwfb-eyebrow">BRANCH MANAGEMENT</p>
          <h1 className="pwfb-page-title">Branches</h1>
          <p className="pwfb-page-description">
            Manage PWFB branches and operational locations.
          </p>
        </div>

        <Link href="/dashboard" className="pwfb-secondary-button">
          ← Dashboard
        </Link>
      </div>

      <section className="pwfb-stat-grid">
        <div className="pwfb-stat-card">
          <span>Total Branches</span>
          <strong>{branches.length}</strong>
          <small>Registered locations</small>
        </div>

        <div className="pwfb-stat-card pwfb-stat-orange">
          <span>Active Branches</span>
          <strong>{branches.filter((branch) => branch.status === "Active").length}</strong>
          <small>Currently operational</small>
        </div>
      </section>

      <section className="pwfb-panel">
        <div className="pwfb-panel-header">
          <div>
            <h2>Branch Directory</h2>
            <p>Registered PWFB operational locations.</p>
          </div>

          <span className="pwfb-record-count">
            {branches.length} records
          </span>
        </div>

        <div className="pwfb-table-wrap">
          <table className="pwfb-table">
            <thead>
              <tr>
                <th>Branch</th>
                <th>Code</th>
                <th>Location</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {branches.map((branch) => (
                <tr key={branch.code}>
                  <td>
                    <strong>{branch.name}</strong>
                  </td>
                  <td>{branch.code}</td>
                  <td>{branch.location}</td>
                  <td>
                    <span className="pwfb-status-badge">
                      {branch.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
