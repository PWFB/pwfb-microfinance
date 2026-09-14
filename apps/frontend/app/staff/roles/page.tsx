'use client';

import Link from 'next/link';

const roles = [
  ['SUPER_ADMIN','Full system administration'],
  ['ADMIN','Administrative operations and staff management'],
  ['REGIONAL_MANAGER','Regional operational oversight'],
  ['DIVISIONAL_MANAGER','Division operational oversight'],
  ['MONITORING_TEAM','Monitoring and operational review'],
  ['AUDITOR','Read-only audit and control review'],
  ['AREA_MANAGER','Area-level operational management'],
  ['BRANCH_MANAGER','Branch management and branch operations'],
  ['CREDIT_OFFICER','Credit and loan operations'],
  ['TELLER','Cash, deposits and withdrawals'],
  ['LOAN_OFFICER','Loan servicing and collections'],
  ['STAFF','General staff operational access'],
];

export default function StaffRolesPage() {
  return <main>
    <div className="pwfb-page-header"><div><p className="pwfb-eyebrow">STAFF MANAGEMENT • ACCESS CONTROL</p><h1 className="pwfb-page-title">Role Management</h1><p className="pwfb-page-description">PWFB role definitions used by authentication, staff assignments and operational permissions.</p></div><div className="flex gap-2"><Link href="/staff" className="pwfb-secondary-button">← Staff</Link><Link href="/staff/add" className="pwfb-primary-button">+ Add Staff</Link></div></div>
    <div className="pwfb-alert">Roles are controlled by the application security model. Assign a role from a staff workspace or during staff registration; new arbitrary role strings are not accepted by the backend.</div>
    <section className="pwfb-panel"><div className="pwfb-panel-header"><div><h2>Available Roles</h2><p>These roles are the live supported access levels in the PWFB backend.</p></div><span className="pwfb-record-count">{roles.length} roles</span></div><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{roles.map(([name,description])=><div key={name} className="rounded-xl border border-slate-200 bg-slate-50 p-5"><strong>{name.replaceAll('_',' ')}</strong><p className="mt-2 text-sm opacity-70">{description}</p></div>)}</div></section>
  </main>;
}
