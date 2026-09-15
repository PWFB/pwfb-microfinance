'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../../lib/api';

type Node = { id: string; name: string; regionId?: string; divisionId?: string; areaId?: string };
type Region = Node & { divisions?: Node[]; areas?: Node[]; branches?: Node[] };
type Bank = { code: string; name: string };

const defaultRoles = ['STAFF','CREDIT_OFFICER','BRANCH_MANAGER','AREA_MANAGER','TELLER','LOAN_OFFICER'];

export default function AddStaffPage() {
  const [step,setStep]=useState(1), [bvn,setBvn]=useState(''), [verified,setVerified]=useState<any>(null), [passport,setPassport]=useState(''), [username,setUsername]=useState('');
  const [bankCode,setBankCode]=useState(''), [accountNumber,setAccountNumber]=useState(''), [accountName,setAccountName]=useState(''), [banks,setBanks]=useState<Bank[]>([]), [verificationReference,setVerificationReference]=useState('');
  const [consentBusy,setConsentBusy]=useState(false);
  const [form,setForm]=useState({firstName:'',middleName:'',lastName:'',email:'',phone:'',department:'',position:'',employmentStatus:'ACTIVE',regionId:'',divisionId:'',areaId:'',branch:'',role:'STAFF'});
  const [regions,setRegions]=useState<Region[]>([]), [roles,setRoles]=useState(defaultRoles), [busy,setBusy]=useState(false), [message,setMessage]=useState('');
  useEffect(()=>{apiRequest('/organization/hierarchy').then((x:any)=>setRegions(Array.isArray(x)?x:[])).catch(()=>undefined);apiRequest('/staff/roles').then((x:any)=>Array.isArray(x)&&x.length&&setRoles(x.map((r:any)=>typeof r==='string'?r:r.name).filter(Boolean))).catch(()=>undefined);apiRequest('/staff/bvn/banks').then((x:any)=>setBanks(Array.isArray(x)?x:[])).catch((e:any)=>setMessage(e?.message||'Unable to load Paystack banks.'))},[]);
  const region=regions.find(r=>r.id===form.regionId), divisions=region?.divisions||[];
  const areas=(region?.areas||[]).filter(a=>!form.divisionId||a.divisionId===form.divisionId);
  const branches=(region?.branches||[]).filter(b=>(!form.divisionId||b.divisionId===form.divisionId)&&(!form.areaId||b.areaId===form.areaId));
  const legalName=useMemo(()=>verified?.fullName||[form.firstName,form.middleName,form.lastName].filter(Boolean).join(' '),[verified,form]);
  const set=(k:string,v:string)=>setForm(x=>({...x,[k]:v}));

  async function waitForBvn(reference:string){
    setVerificationReference(reference); setConsentBusy(true); setMessage('Waiting for Paystack identity verification…');
    for(let attempt=1;attempt<=45;attempt++){
      try{
        const r=await apiRequest(`/staff/bvn/verify/${encodeURIComponent(reference)}`);
        if(r?.verified){ setVerified(r); setForm(x=>({...x,firstName:r.firstName||x.firstName,middleName:r.middleName||'',lastName:r.lastName||x.lastName})); setUsername(`STF-${String(bvn).slice(-6)}-${Math.floor(1000+Math.random()*9000)}`); setMessage(`BVN VERIFIED — legal name: ${r.fullName}`); setConsentBusy(false); setStep(2); return; }
        const status=String(r?.status||'').toUpperCase();
        if(['FAILED','DECLINED','REJECTED','CANCELLED'].includes(status)){setConsentBusy(false);setMessage(r?.message||`BVN verification ${status.toLowerCase()}.`);return;}
      }catch(e:any){if(attempt===45){setConsentBusy(false);setMessage(e?.message||'Unable to complete Paystack verification.');return;}}
      await new Promise(resolve=>setTimeout(resolve,2000));
    }
    setConsentBusy(false); setMessage('Paystack verification is still pending. Confirm the Paystack webhook is configured and try verification again.');
  }

  async function verifyBvn(){
    if(!/^\d{11}$/.test(bvn))return setMessage('Enter a valid 11-digit BVN.');
    if(!form.firstName.trim()||!form.lastName.trim())return setMessage('Enter the staff member’s first and last name.');
    if(!bankCode)return setMessage('Select the staff member’s bank.');
    if(!/^\d{10}$/.test(accountNumber))return setMessage('Enter a valid 10-digit bank account number.');
    setBusy(true);setMessage('');
    try{
      const r=await apiRequest('/staff/bvn/verify',{method:'POST',body:JSON.stringify({bvn,firstName:form.firstName,lastName:form.lastName,middleName:form.middleName||undefined,bankCode,accountNumber})});
      const reference=String(r?.reference||''); if(!reference)throw new Error('Paystack did not return a verification reference.');
      setAccountName(String(r?.accountName||'')); setVerificationReference(reference); setMessage('Paystack accepted the BVN and bank-account verification. Waiting for the verification result…'); setBusy(false); void waitForBvn(reference);
    }catch(e:any){setMessage(e?.message||'Paystack BVN verification failed.');setBusy(false)}
  }

  async function create(){
    if(!verified?.verified||!verificationReference)return setMessage('Complete Paystack BVN verification before creating this staff account.');
    setBusy(true);setMessage('');
    try{const r=await apiRequest('/staff',{method:'POST',body:JSON.stringify({...form,username,passport,middleName:form.middleName||undefined,email:form.email||undefined,bvnVerificationReference:verificationReference})});setMessage(`Staff created successfully${r?.staff?.staffId?` — ${r.staff.staffId}`:''}.`);setStep(5)}catch(e:any){setMessage(e?.message||'Unable to create staff.')}finally{setBusy(false)}
  }

  return <main className="staff-registration-page">
    <div className="pwfb-page-header"><div><p className="pwfb-eyebrow">STAFF MANAGEMENT</p><h1 className="pwfb-page-title">Staff Registration</h1><p className="pwfb-page-description">Guided registration: BVN + Bank → Paystack verification → Staff information → Branch → Role → Create.</p></div><Link href="/staff" className="pwfb-secondary-button">← Staff</Link></div>
    <div className="staff-steps">{['BVN & Bank','Staff Information','Branch Assignment','Role Assignment','Complete'].map((x,i)=><div className={step===i+1?'active':''} key={x}><b>{i+1}</b>{x}</div>)}</div>
    <section className="pwfb-panel staff-registration-card">
      {step===1&&<div className="step-card"><h2>BVN & Bank Verification</h2><p>PWFB now uses Paystack for Nigerian bank-account and BVN identity verification. Enter the staff member’s details; the verification runs securely from the PWFB backend.</p><div className="fields"><label>BVN<input value={bvn} onChange={e=>setBvn(e.target.value.replace(/\D/g,'').slice(0,11))} inputMode="numeric" maxLength={11} placeholder="11-digit BVN"/></label><label>First name<input value={form.firstName} onChange={e=>set('firstName',e.target.value)} placeholder="Staff first name"/></label><label>Last name<input value={form.lastName} onChange={e=>set('lastName',e.target.value)} placeholder="Staff last name"/></label><label>Bank<select value={bankCode} onChange={e=>setBankCode(e.target.value)}><option value="">Select Bank</option>{banks.map(b=><option key={`${b.code}-${b.name}`} value={b.code}>{b.name}</option>)}</select></label><label>Account number<input value={accountNumber} onChange={e=>setAccountNumber(e.target.value.replace(/\D/g,'').slice(0,10))} inputMode="numeric" maxLength={10} placeholder="10-digit account number"/></label></div>{accountName&&<div className="verified">✓ Bank account resolved: <strong>{accountName}</strong></div>}<button className="pwfb-primary-button" onClick={verifyBvn} disabled={busy||consentBusy}>{busy||consentBusy?'Verifying…':'Verify with Paystack'}</button>{consentBusy&&<div className="verified">Paystack identity verification is in progress. Do not close the registration page.</div>}</div>}
      {step===2&&<div className="step-card"><div className="verified">✓ BVN VERIFIED</div><h2>Staff Information</h2><div className="two-column"><div className="fields"><label>Staff Username<input value={username} readOnly/></label><label>First name<input value={form.firstName} readOnly/></label><label>Middle name<input value={form.middleName} onChange={e=>set('middleName',e.target.value)}/></label><label>Last name<input value={form.lastName} readOnly/></label><label>Phone<input value={form.phone} onChange={e=>set('phone',e.target.value)} required/></label><label>Email (optional)<input value={form.email} onChange={e=>set('email',e.target.value)}/></label><label>Department ID<input value={form.department} onChange={e=>set('department',e.target.value)}/></label><label>Position<input value={form.position} onChange={e=>set('position',e.target.value)}/></label></div><div className="passport"><strong>Current Passport</strong>{passport?<img src={passport} alt="Current passport"/>:<div className="passport-empty">Upload current passport</div>}<input type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0];if(f)setPassport(URL.createObjectURL(f))}}/></div></div><div className="verified-name">Paystack verified legal name: <strong>{legalName}</strong>{accountName&&<><br/>Bank account: <strong>{accountName}</strong></>}</div><button className="pwfb-primary-button" onClick={()=>{if(!passport)return setMessage('Upload the current passport before continuing.');setStep(3);setMessage('')}}>Continue to Branch</button></div>}
      {step===3&&<div className="step-card"><h2>Branch Assignment</h2><p>Select Region → Division → Area → Branch. The selected branch becomes the staff member's organizational scope.</p><div className="fields"><label>Region<select value={form.regionId} onChange={e=>setForm(x=>({...x,regionId:e.target.value,divisionId:'',areaId:'',branch:''}))}><option value="">Select Region</option>{regions.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label><label>Division<select value={form.divisionId} onChange={e=>setForm(x=>({...x,divisionId:e.target.value,areaId:'',branch:''}))} disabled={!form.regionId}><option value="">Select Division</option>{divisions.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label>Area<select value={form.areaId} onChange={e=>setForm(x=>({...x,areaId:e.target.value,branch:''}))} disabled={!form.regionId}><option value="">Select Area</option>{areas.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label><label>Branch<select value={form.branch} onChange={e=>set('branch',e.target.value)} disabled={!form.regionId}><option value="">Select Branch</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label></div><button className="pwfb-primary-button" onClick={()=>{if(!form.regionId||!form.branch)return setMessage('Select the Region and Branch.');setStep(4);setMessage('')}}>Save Branch & Continue</button></div>}
      {step===4&&<div className="step-card"><h2>Role Assignment</h2><p>Choose an existing Prisma role. Role Management is available for administrators.</p><Link href="/staff/roles" className="pwfb-secondary-button">Manage Roles</Link><div className="role-grid">{roles.map(r=><button type="button" className={form.role===r?'selected':''} key={r} onClick={()=>set('role',r)}>{r.replaceAll('_',' ')}</button>)}</div><div className="summary"><b>{username}</b><span>{legalName}</span><span>{region?.name} → {branches.find(b=>b.id===form.branch)?.name}</span><span>Role: {form.role.replaceAll('_',' ')}</span></div><button className="pwfb-primary-button" onClick={create} disabled={busy}>{busy?'Creating…':'Create Staff Account'}</button></div>}
      {step===5&&<div className="step-card"><div className="verified">✓ STAFF CREATED</div><h2>Registration Complete</h2><p>{message}</p><Link href="/staff" className="pwfb-primary-button">Back to Staff Register</Link></div>}
      {message&&step!==5&&<div className="staff-error">{message}</div>}
    </section>
    <style jsx>{`.staff-steps{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin-bottom:18px}.staff-steps div{padding:10px;border:1px solid #dceee2;border-radius:12px;background:#f7fcf9;color:#64736a;display:flex;gap:7px;align-items:center;font-size:11px}.staff-steps b{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;background:#dceee2}.staff-steps .active{border-color:#0f7b35;color:#075c28;background:#effaf2}.staff-steps .active b{background:#0f7b35;color:white}.step-card{display:grid;gap:18px}.step-card h2{margin:0}.step-card p{margin:0;color:#68766d}.step-card label{display:grid;gap:7px;font-size:12px;font-weight:700}.step-card input,.step-card select{height:44px;border:1px solid #cfdad3;border-radius:10px;padding:9px 12px;background:white}.two-column{display:grid;grid-template-columns:minmax(0,1fr) 260px;gap:22px}.fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.passport{display:grid;gap:10px}.passport img{width:180px;height:210px;object-fit:cover;border-radius:12px;border:1px solid #d5e0d9}.passport-empty{width:180px;height:210px;border:1px dashed #b9c9bf;border-radius:12px;display:grid;place-items:center;text-align:center;color:#78857d}.verified,.verified-name{padding:12px 14px;border-radius:10px;background:#effaf2;color:#075c28}.role-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.role-grid button{padding:13px;border:1px solid #d5e0d9;border-radius:10px;background:white;text-align:left;font-weight:700}.role-grid button.selected{border-color:#0f7b35;background:#effaf2;color:#075c28}.summary{display:grid;gap:5px;padding:15px;border-radius:12px;background:#f7fcf9}.summary span{font-size:12px;color:#66736b}.staff-error{padding:12px;border-radius:10px;background:#fff3f0;color:#9a321d;font-size:13px}@media(max-width:720px){.staff-steps{grid-template-columns:1fr}.two-column,.fields{grid-template-columns:1fr}.role-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}`}</style>
  </main>;
}
