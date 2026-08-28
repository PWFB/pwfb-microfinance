'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiRequest } from '../../../lib/api';

const starterRoles = ['STAFF','CREDIT_OFFICER','BRANCH_MANAGER','AREA_MANAGER','AM1','AM2','AM3','AM4','AM5','TELLER','LOAN_OFFICER'];

export default function StaffRolesPage() {
  const [roles, setRoles] = useState<string[]>(starterRoles);
  const [role, setRole] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    apiRequest('/staff/roles').then((data) => {
      if (Array.isArray(data)) setRoles(data.map((item: any) => typeof item === 'string' ? item : item.name).filter(Boolean));
    }).catch(() => undefined);
  }, []);

  async function addRole() {
    const normalized = role.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_');
    if (!normalized) return;
    setSaving(true); setMessage('');
    try {
      await apiRequest('/staff/roles', { method: 'POST', body: JSON.stringify({ name: normalized }) });
      setRoles((current) => current.includes(normalized) ? current : [...current, normalized]);
      setRole(''); setMessage('Role created successfully.');
    } catch (e: any) { setMessage(e?.message || 'Unable to create role.'); }
    finally { setSaving(false); }
  }

  return <main>
    <div className="pwfb-page-header"><div><p className="pwfb-eyebrow">STAFF MANAGEMENT</p><h1 className="pwfb-page-title">Role Management</h1><p className="pwfb-page-description">Create roles first, then assign them during staff registration.</p></div><Link href="/staff" className="pwfb-secondary-button">← Staff</Link></div>
    <section className="pwfb-panel" style={{maxWidth: 920}}>
      <div className="pwfb-panel-header"><div><h2>Create Role</h2><p>Roles are stored separately from staff registration.</p></div></div>
      <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:24}}><input value={role} onChange={e=>setRole(e.target.value)} placeholder="e.g. AM1 or Credit Officer" style={{flex:'1 1 280px',height:44,padding:'9px 12px',border:'1px solid #cfdad3',borderRadius:10}}/><button type="button" className="pwfb-primary-button" onClick={addRole} disabled={saving}>{saving?'Saving...':'Create Role'}</button></div>
      {message && <div className="pwfb-alert">{message}</div>}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:14}}>{roles.map(item=><div key={item} style={{padding:18,border:'1px solid #dceee2',borderRadius:14,background:'#f7fcf9'}}><strong>{item.replaceAll('_',' ')}</strong><div style={{fontSize:11,color:'#66736b',marginTop:6}}>Available for assignment</div></div>)}</div>
    </section>
  </main>;
}
