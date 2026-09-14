'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../lib/api';

type StaffMember = {
  id: string;
  staffId?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  position?: string;
  employmentStatus?: string;
  department?: { name?: string } | null;
  branch?: { id?: string; name?: string } | null;
  region?: { id?: string; name?: string } | null;
  division?: { id?: string; name?: string } | null;
  area?: { id?: string; name?: string } | null;
  user?: { role?: string } | null;
  assignments?: Array<{ id: string; role?: string; active?: boolean; startsAt?: string; endsAt?: string; notes?: string; region?: { name?: string }; division?: { name?: string }; area?: { name?: string }; branch?: { name?: string } }>;
};

const roles = ['SUPER_ADMIN','ADMIN','REGIONAL_MANAGER','DIVISIONAL_MANAGER','MONITORING_TEAM','AUDITOR','AREA_MANAGER','BRANCH_MANAGER','CREDIT_OFFICER','TELLER','LOAN_OFFICER','STAFF'];

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('ALL');
  const [role, setRole] = useState('ALL');
  const [refreshing, setRefreshing] = useState(false);

  async function loadStaff() {
    try {
      setError('');
      const rows = await apiRequest('/staff');
      setStaff(Array.isArray(rows) ? rows : []);
    } catch (e: any) {
      setError(e?.message || 'Unable to load staff.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { loadStaff(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return staff.filter((member) => {
      const name = [member.firstName, member.middleName, member.lastName].filter(Boolean).join(' ').toLowerCase();
      const haystack = [name, member.staffId, member.phone, member.email, member.position, member.department?.name, member.branch?.name, member.area?.name, member.region?.name].filter(Boolean).join(' ').toLowerCase();
      return (!q || haystack.includes(q)) && (status === 'ALL' || member.employmentStatus === status) && (role === 'ALL' || member.user?.role === role);
    });
  }, [staff, query, status, role]);

  const active = staff.filter((s) => s.employmentStatus === 'ACTIVE').length;
  const assigned = staff.filter((s) => s.branch?.id).length;
  const managers = staff.filter((s) => ['BRANCH_MANAGER','AREA_MANAGER','REGIONAL_MANAGER','DIVISIONAL_MANAGER'].includes(String(s.user?.role))).length;

  return (
    <main>
      <div className="pwfb-page-header">
        <div>
          <p className="pwfb-eyebrow">HUMAN RESOURCES • OPERATIONS</p>
          <h1 className="pwfb-page-title">Staff Management</h1>
          <p className="pwfb-page-description">Live staff directory, role access, branch assignments and assignment history.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href="/staff/roles" className="pwfb-secondary-button">Role Management</Link>
          <Link href="/staff/add" className="pwfb-primary-button">+ Add Staff</Link>
        </div>
      </div>

      {error && <div className="pwfb-alert">{error}</div>}

      <section className="pwfb-stat-grid">
        <div className="pwfb-stat-card"><span>Total Staff</span><strong>{staff.length}</strong><small>Live staff records</small></div>
        <div className="pwfb-stat-card pwfb-stat-orange"><span>Active</span><strong>{active}</strong><small>Currently active</small></div>
        <div className="pwfb-stat-card"><span>Branch Assigned</span><strong>{assigned}</strong><small>Organizational scope set</small></div>
        <div className="pwfb-stat-card pwfb-stat-orange"><span>Managers</span><strong>{managers}</strong><small>Regional / area / branch</small></div>
      </section>

      <section className="pwfb-panel">
        <div className="pwfb-panel-header">
          <div><h2>Staff Register</h2><p>Search live records and open a staff workspace for role and assignment changes.</p></div>
          <button className="pwfb-secondary-button" onClick={() => { setRefreshing(true); loadStaff(); }} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh'}</button>
        </div>
        <div className="flex gap-2 flex-wrap mb-4">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, staff ID, phone, branch…" className="flex-1 min-w-[220px] h-11 rounded-lg border border-slate-200 px-3" />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-11 rounded-lg border border-slate-200 px-3"><option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="SUSPENDED">Suspended</option></select>
          <select value={role} onChange={(e) => setRole(e.target.value)} className="h-11 rounded-lg border border-slate-200 px-3"><option value="ALL">All roles</option>{roles.map((item) => <option key={item} value={item}>{item.replaceAll('_',' ')}</option>)}</select>
        </div>
        <div className="pwfb-table-wrap">
          <table className="pwfb-table">
            <thead><tr><th>STAFF</th><th>ROLE</th><th>POSITION</th><th>REGION / AREA</th><th>BRANCH</th><th>STATUS</th><th>ACTION</th></tr></thead>
            <tbody>
              {filtered.map((member) => {
                const name = [member.firstName, member.middleName, member.lastName].filter(Boolean).join(' ') || 'Unnamed staff';
                return <tr key={member.id}>
                  <td><strong>{name}</strong><div className="text-xs opacity-70">{member.staffId || 'No staff ID'}</div></td>
                  <td>{member.user?.role?.replaceAll('_',' ') || '—'}</td>
                  <td>{member.position || '—'}</td>
                  <td>{[member.region?.name, member.area?.name].filter(Boolean).join(' / ') || '—'}</td>
                  <td>{member.branch?.name || 'Unassigned'}</td>
                  <td><span className="pwfb-status-badge">{member.employmentStatus || 'ACTIVE'}</span></td>
                  <td><Link href={`/staff/${member.id}`} className="pwfb-secondary-button">Open</Link></td>
                </tr>;
              })}
              {!loading && filtered.length === 0 && <tr><td colSpan={7}>No staff records match the current filters.</td></tr>}
              {loading && <tr><td colSpan={7}>Loading live staff records…</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
