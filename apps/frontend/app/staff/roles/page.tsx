'use client';

import Link from 'next/link';
import { useState } from 'react';

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
] as const;

export default function StaffRolesPage() {
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const selected = roles.find(([name]) => name === selectedRole);

  return <main>
    <div className="pwfb-page-header"><div><p className="pwfb-eyebrow">STAFF MANAGEMENT • ACCESS CONTROL</p><h1 className="pwfb-page-title">Role Management</h1><p className="pwfb-page-description">Select a role to inspect its purpose and manage staff assignments.</p></div><div className="flex gap-2"><Link href="/staff" className="pwfb-secondary-button">← Staff</Link><Link href="/staff/add" className="pwfb-primary-button">+ Add Staff</Link></div></div>
    <div className="pwfb-alert">Roles are controlled by the application security model. This page describes supported role definitions; permissions are managed separately and arbitrary role strings are not accepted by the backend.</div>
    <section className="pwfb-panel">
      <div className="pwfb-panel-header"><div><h2>Available Roles</h2><p>Choose any role below to view its details.</p></div><span className="pwfb-record-count">{roles.length} roles</span></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {roles.map(([name,description])=><button type="button" key={name} onClick={()=>setSelectedRole(name)} aria-pressed={selectedRole===name} className="rounded-xl border border-slate-300 bg-white p-5 text-left transition hover:border-orange-500 hover:bg-orange-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500" style={{cursor:'pointer',color:'#111827',minHeight:110,boxShadow:selectedRole===name?'0 0 0 2px #f28c18':'none'}}><strong>{name.replaceAll('_',' ')}</strong><p className="mt-2 text-sm" style={{color:'#475569'}}>{description}</p><span className="mt-3 inline-block text-xs font-bold" style={{color:'#0b612b'}}>View role details →</span></button>)}
      </div>
    </section>
    {selected && <section className="pwfb-panel mt-5" aria-live="polite">
      <div className="pwfb-panel-header"><div><p className="pwfb-eyebrow">ROLE DETAILS</p><h2>{selected[0].replaceAll('_',' ')}</h2><p>{selected[1]}</p></div><button type="button" className="pwfb-secondary-button" onClick={()=>setSelectedRole(null)}>Close details</button></div>
      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 p-4"><strong>Role key</strong><p className="mt-2 break-all">{selected[0]}</p></div>
        <div className="rounded-xl border border-slate-200 p-4"><strong>Purpose</strong><p className="mt-2">{selected[1]}</p></div>
        <div className="rounded-xl border border-slate-200 p-4 sm:col-span-2"><strong>Manage access</strong><p className="mt-2">Use the operational permission matrix to review the permission switches assigned to each supported role. Role descriptions do not grant permissions by themselves.</p><Link href="/permissions" className="pwfb-primary-button mt-3 inline-flex">Open Access Control / Permissions</Link></div>
        <div className="sm:col-span-2"><Link href="/staff" className="pwfb-secondary-button">View Staff Register</Link> <Link href="/staff/add" className="pwfb-primary-button ml-2">Assign role to new staff</Link></div>
      </div>
    </section>}
  </main>;
}
