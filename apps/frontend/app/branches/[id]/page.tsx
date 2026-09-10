"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "";

type Branch = { id:string; name:string; code?:string; location?:string; status?:string; region?:{name:string}; division?:{name:string}; area?:{name:string}; branchAccounts?:{id:string;accountNumber:string;accountName?:string;provider?:string;status?:string}[]; customers?:any[]; staff?:any[] };

const operationalRecords = [
 {label:"Daily Collection",href:"/collections"},
 {label:"Savings Summary",href:"/savings"},
 {label:"Loan Summary",href:"/loans"},
 {label:"Weekly Loan Summary",href:"/loans?view=weekly"},
 {label:"Bank Transaction",href:"/transactions"},
 {label:"Cash Book",href:"/cashbook"},
];

export default function BranchDetailPage(){
 const {id}=useParams<{id:string}>(); const router=useRouter();
 const [branch,setBranch]=useState<Branch|null>(null); const [loading,setLoading]=useState(true); const [error,setError]=useState(""); const [saving,setSaving]=useState(false); const [name,setName]=useState(""); const [location,setLocation]=useState("");
 useEffect(()=>{fetch(`${API}/branches/${id}`,{credentials:"include"}).then(async r=>{if(!r.ok)throw new Error("Branch not found");return r.json()}).then((d)=>{const b=d?.data||d;setBranch(b);setName(b.name||"");setLocation(b.location||"")}).catch(e=>setError(e.message)).finally(()=>setLoading(false))},[id]);
 async function save(){setSaving(true);try{const r=await fetch(`${API}/branches/${id}`,{method:"PATCH",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,location})});if(!r.ok)throw new Error("Unable to save branch");const d=await r.json();setBranch(d?.data||d)}catch(e:any){setError(e.message)}finally{setSaving(false)}}
 if(loading)return <main className="p-6">Loading branch…</main>;
 if(error||!branch)return <main className="p-6 text-red-600">{error||"Branch not found"}</main>;
 const account=branch.branchAccounts?.[0];
 const branchHref=(href:string)=>`${href}${href.includes("?")?"&":"?"}branchId=${encodeURIComponent(branch.id)}`;
 return <main>
  <div className="pwfb-page-header"><div><p className="pwfb-eyebrow">BRANCH OPERATIONS • {branch.code||branch.id}</p><h1 className="pwfb-page-title">{branch.name}</h1><p className="pwfb-page-description">Branch operations and financial history are connected to the central PWFB database and available to Head Office.</p></div><button className="pwfb-secondary-button" onClick={()=>router.push("/branches")}>← Back</button></div>
  <section className="pwfb-stat-grid"><div className="pwfb-stat-card"><span>Virtual Account</span><strong>{account?.accountNumber||"Not provisioned"}</strong><small>{account?.provider||"—"}</small></div><div className="pwfb-stat-card"><span>Customers</span><strong>{branch.customers?.length||0}</strong><small>Loaded from branch record</small></div><div className="pwfb-stat-card"><span>Staff</span><strong>{branch.staff?.length||0}</strong><small>Loaded from branch record</small></div></section>
  <section className="pwfb-panel mt-6"><div className="pwfb-panel-header"><div><h2>Branch Daily Operations</h2><p>Open this branch's operational screens. Records use the shared PWFB database so Head Office can review the same history.</p></div><span className="pwfb-record-count">6 operations</span></div><div className="grid gap-3 p-6 sm:grid-cols-2 lg:grid-cols-3">{operationalRecords.map(item=><Link key={item.label} href={branchHref(item.href)} className="group rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50"><strong className="block text-sm text-emerald-900">{item.label}</strong><span className="mt-1 block text-xs text-slate-600">Open {item.label.toLowerCase()} for {branch.name}</span><span className="mt-3 inline-flex text-xs font-bold text-orange-600 group-hover:underline">Open →</span></Link>)}</div></section>
  <section className="pwfb-panel mt-6"><div className="pwfb-panel-header"><div><h2>Shared History</h2><p>Head Office and authorized branch users work from the same operational records. Use Reports and Cash Book History for consolidated review.</p></div></div><div className="flex flex-wrap gap-3 p-6"><Link href={branchHref("/staff-wallet/history")} className="pwfb-secondary-button">Branch Cash Book History</Link><Link href={branchHref("/reports")} className="pwfb-secondary-button">Branch Reports</Link><Link href="/branches" className="pwfb-primary-button">Head Office Branch Directory</Link></div></section>
  <section className="pwfb-panel mt-6"><div className="pwfb-panel-header"><div><h2>View / Edit Branch</h2><p>Changes are saved against this exact database branch.</p></div></div><div className="grid gap-4 p-6 md:grid-cols-2"><label>Branch Name<input className="pwfb-input" value={name} onChange={e=>setName(e.target.value)}/></label><label>Location<input className="pwfb-input" value={location} onChange={e=>setLocation(e.target.value)}/></label><label>Branch ID<input className="pwfb-input" value={branch.id} readOnly/></label><label>Status<input className="pwfb-input" value={branch.status||"ACTIVE"} readOnly/></label></div><div className="px-6 pb-6"><button className="pwfb-primary-button" disabled={saving} onClick={save}>{saving?"Saving…":"Save Branch"}</button></div></section>
  <section className="pwfb-panel mt-6"><div className="pwfb-panel-header"><div><h2>Virtual Account</h2><p>Persistent account assigned to this branch.</p></div></div><div className="p-6"><p><strong>Account Number:</strong> {account?.accountNumber||"Not provisioned"}</p><p><strong>Account Name:</strong> {account?.accountName||branch.name}</p><p><strong>Provider:</strong> {account?.provider||"—"}</p><p><strong>Status:</strong> {account?.status||"—"}</p></div></section>
 </main>;
}
