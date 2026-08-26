'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';

type StaffMember = {
  id: string;
  staffId?: string;
  position?: string;
  branch?: { name?: string } | null;
  area?: { name?: string } | null;
};

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadStaff() {
    try {
      setError('');
      const rows = await apiRequest('/staff');
      setStaff(Array.isArray(rows) ? rows : []);
    } catch (e: any) {
      setError(e?.message || 'Unable to load staff.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStaff();
  }, []);

  return (
    <main>
      <div className="pwfb-page-header">
        <div>
          <p className="pwfb-eyebrow">HUMAN RESOURCES</p>
          <h1 className="pwfb-page-title">Staff</h1>
          <p className="pwfb-page-description">
            Staff register using the payroll register structure.
          </p>
        </div>
        <Link href="/dashboard" className="pwfb-secondary-button">
          ← Dashboard
        </Link>
      </div>

      {error && <div className="pwfb-alert">{error}</div>}

      <section className="pwfb-panel">
        <div className="pwfb-panel-header">
          <div>
            <h2>Staff Register</h2>
            <p>Area, branch, grade and staff number only.</p>
          </div>
          <span className="pwfb-record-count">{staff.length} records</span>
        </div>

        <div className="pwfb-table-wrap">
          <table className="pwfb-table">
            <thead>
              <tr>
                <th>AREA</th>
                <th>BRANCH</th>
                <th>GRADE</th>
                <th>NO</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((member) => (
                <tr key={member.id}>
                  <td>{member.area?.name || '—'}</td>
                  <td>{member.branch?.name || '—'}</td>
                  <td>{member.position || '—'}</td>
                  <td>{member.staffId || '—'}</td>
                </tr>
              ))}

              {!loading && staff.length === 0 && (
                <tr>
                  <td colSpan={4}>No staff records found.</td>
                </tr>
              )}

              {loading && (
                <tr>
                  <td colSpan={4}>Loading staff records…</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
