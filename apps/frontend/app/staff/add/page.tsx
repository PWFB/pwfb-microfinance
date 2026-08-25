'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { apiRequest } from '../../../lib/api';

const roles = ['ADMIN','BRANCH_MANAGER','LOAN_OFFICER','TELLER','AUDITOR','STAFF'];

export default function AddStaffPage() {
  const [form, setForm] = useState({ firstName:'', middleName:'', lastName:'', email:'', phone:'', department:'', position:'', role:'STAFF', branch:'', employmentStatus:'ACTIVE', bvn:'' });
  const [saving, setSaving] = useState(false);
  const [verifyingBvn, setVerifyingBvn] = useState(false);
  const [bvnResult, setBvnResult] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  function update(name:string,value:string){ setForm(current=>({...current,[name]:value})); }
  async function verifyBvn(){
    if (!/^\d{11}$/.test(form.bvn)) { setError('Enter an 11-digit BVN first.'); return; }
    setVerifyingBvn(true); setError(''); setBvnResult(null);
    try {
      const verified = await apiRequest('/staff/bvn/verify',{method:'POST',body:JSON.stringify({bvn:form.bvn})});
      setBvnResult(verified);
      setForm(current=>({ ...current, firstName:verified.firstName || current.firstName, middleName:verified.middleName || current.middleName, lastName:verified.lastName || current.lastName }));
    } catch (err:any) { setError(err?.message || 'BVN verification failed'); }
    finally { setVerifyingBvn(false); }
  }
  async function submit(event:FormEvent){
    event.preventDefault(); setSaving(true); setError(''); setResult(null);
    try {
      const created = await apiRequest('/staff',{method:'POST',body:JSON.stringify({...form, ...(form.email?{email:form.email}:{}), ...(form.middleName?{middleName:form.middleName}:{}), ...(form.bvn?{bvn:form.bvn}: {})})});
      setResult(created);
    } catch(err:any){ setError(err?.message || 'Unable to create staff'); }
    finally{ setSaving(false); }
  }

  return <main>
    <div className="pwfb-page-header"><div><p className="pwfb-eyebrow">STAFF MANAGEMENT</p><h1 className="pwfb-page-title">Staff Registration</h1><p className="pwfb-page-description">Register staff, verify BVN identity and create the PWFB login automatically.</p></div><Link href="/staff-dashboard" className="pwfb-secondary-button">Back</Link></div>
    <section className="pwfb-panel" style={{maxWidth:820}}>
      <div className="pwfb-panel-header"><div><h2>Staff Profile</h2><p>Enter BVN and verify it to bring the staff identity details into the registration.</p></div></div>
      <form onSubmit={submit} style={{display:'grid',gap:16}}>
        <div className="pwfb-form-grid">
          <label><span>BVN</span><div style={{display:'flex',gap:8}}><input value={form.bvn} onChange={e=>update('bvn',e.target.value.replace(/\D/g,'').slice(0,11))} inputMode="numeric" maxLength={11} placeholder="11-digit BVN"/><button type="button" className="pwfb-secondary-button" onClick={verifyBvn} disabled={verifyingBvn}>{verifyingBvn?'Checking...':'Verify BVN'}</button></div></label>
          {bvnResult?.verified && <div className="pwfb-stat-card"><span>BVN verified name</span><strong>{bvnResult.fullName}</strong></div>}
          {[['firstName','First name',true],['middleName','Middle name',false],['lastName','Last name',true],['email','Email (optional)',false],['phone','Phone',true],['department','Department ID',true],['position','Position',true],['branch','Branch ID',true]].map(([name,label,required])=><label key={name as string}><span>{label as string}</span><input value={(form as any)[name as string]} onChange={e=>update(name as string,e.target.value)} required={Boolean(required)} type={name==='email'?'email':'text'} /></label>)}
          <label><span>Role</span><select value={form.role} onChange={e=>update('role',e.target.value)}>{roles.map(role=><option key={role}>{role}</option>)}</select></label>
          <label><span>Employment status</span><select value={form.employmentStatus} onChange={e=>update('employmentStatus',e.target.value)}><option>ACTIVE</option><option>INACTIVE</option></select></label>
        </div>
        {error && <div className="pwfb-empty-state"><strong>{error}</strong></div>}
        <button type="submit" className="pwfb-primary-button" disabled={saving}>{saving?'Creating staff...':'Register Staff'}</button>
      </form>
    </section>
    {result?.login && <section className="pwfb-panel" style={{maxWidth:820,marginTop:20}}><div className="pwfb-panel-header"><div><h2>Staff Created Successfully</h2><p>Save the generated login details securely.</p></div></div><div className="pwfb-stat-grid"><div className="pwfb-stat-card"><span>Login email</span><strong>{result.login.email}</strong></div><div className="pwfb-stat-card pwfb-stat-orange"><span>Temporary password</span><strong>{result.login.temporaryPassword}</strong></div><div className="pwfb-stat-card"><span>Staff ID</span><strong>{result.staff?.staffId}</strong></div></div></section>}
  </main>;
}
