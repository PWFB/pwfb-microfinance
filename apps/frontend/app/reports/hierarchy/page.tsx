"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

type Staff = {
  id: string;
  staffId: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  position: string;
  assignments?: { role: string; active: boolean; startsAt: string; endsAt?: string | null }[];
};

type Branch = {
  id: string;
  name: string;
  staff: Staff[];
  _count?: { customers: number; staff: number; collections: number; payrolls: number };
};

type Area = { id: string; name: string; branches: Branch[] };
type Division = { id: string; name: string; areas: Area[] };
type Region = { id: string; name: string; divisions: Division[]; areas: Area[] };

export default function HierarchyReportPage() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [role, setRole] = useState("Loading");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    fetch(`${API_URL}/access/hierarchy`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "Unable to load hierarchy");
        return data;
      })
      .then((data) => {
        setRegions(data.regions || []);
        setRole(data.scope?.role || "Staff");
      })
      .catch((err) => setError(err.message || "Unable to load hierarchy"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main>
      <div className="pwfb-page-header">
        <div>
          <p className="pwfb-eyebrow">ORGANIZATIONAL VISIBILITY</p>
          <h1 className="pwfb-page-title">Branch Hierarchy</h1>
          <p className="pwfb-page-description">
            View regions, divisions, areas, branches and assigned staff within your access scope.
          </p>
        </div>
        <div className="pwfb-status-badge">{role.replaceAll("_", " ")}</div>
      </div>

      {loading && <section className="pwfb-panel"><p>Loading organizational hierarchy...</p></section>}
      {error && <section className="pwfb-panel"><p>{error}</p></section>}

      {!loading && !error && regions.map((region) => (
        <section className="pwfb-panel" key={region.id}>
          <div className="pwfb-panel-header">
            <div>
              <h2>{region.name}</h2>
              <p>Region-level operational structure</p>
            </div>
          </div>

          {region.divisions.map((division) => (
            <div key={division.id} style={{ marginBottom: 24 }}>
              <h3>{division.name}</h3>
              {division.areas.map((area) => (
                <div key={area.id} style={{ margin: "14px 0 14px 16px" }}>
                  <strong>{area.name}</strong>
                  <div className="pwfb-department-grid" style={{ marginTop: 10 }}>
                    {area.branches.map((branch) => (
                      <div className="pwfb-department-card" key={branch.id}>
                        <div className="pwfb-department-icon">🏦</div>
                        <div>
                          <h3>{branch.name}</h3>
                          <p>
                            {branch._count?.customers ?? 0} customers · {branch._count?.staff ?? 0} staff · {branch._count?.collections ?? 0} collections
                          </p>
                          {branch.staff.map((staff) => (
                            <p key={staff.id} style={{ margin: "6px 0 0" }}>
                              <strong>{[staff.firstName, staff.middleName, staff.lastName].filter(Boolean).join(" ")}</strong> — {staff.position}
                            </p>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </section>
      ))}
    </main>
  );
}
