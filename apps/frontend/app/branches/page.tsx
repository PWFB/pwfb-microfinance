"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "";
type Branch={id:string;name:string;code?:string;location?:string;status?:string;branchAccounts?:{accountNumber:string;accountName?:string;status?:string}[]};

export default function BranchesPage(){
 const [branches,setBranches]=useState<Branch[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState(""); const [provisioning,setProvisioning]=useState(false); const [message,setMessage]=useState("");
 const load=()=>{setLoading(true);fetch(`${API}/branches`,{credentials:"include"}).then(async r=>{if(!r.ok)throw new Error("Unable to load branches");return r.json()}).then(d=>setBranches(Array.isArray(d)?d:d.data||d.branches||[])).catch(e=>setError(e.message)).finally(()=>setLoading(false))};
 useEffect(load,[]);
 async function provision(){setProvisioning(true);setMessage("");setError("");try{const r=await fetch(`${API}/branches/provision-virtual-accounts`,{credentials:"include"});const d=await r.json();if(!r.ok)throw new Error(d?.message||"Unable to provision virtual accounts");setMessage(`${d.totalBranches||0} branches checked. Missing virtual accounts have been created.`);load()}catch(e:any){setError(e.message)}finally{setProvisioning(false)}}
 return <main><div className="pwfb-page-header"><div><p className="pwfb-eyebrow">SUPER ADMIN • BRANCH MANAGEMENT</p><h1 className="pwfb-page-title">Branches</h1><p className="pwfb-page-description">Manage every PWFB branch and its virtual account.</p></div><div className="flex gap-2"><button className="pwfb-primary-button" onClick={provision} disabled={provisioning}>{provisioning?"Provisioning…":"Provision All Virtual Accounts"}</button><Link href="/dashboard" className="pwfb-secondary-button">← Dashboard</Link></div></div>
 <section className="pwfb-stat-grid"><div className="pwfb-stat-card"><span>Total Branches</span><strong>{branches.length}</strong><small>Database records</small></div><div className="pwfb-stat-card pwfb-stat-orange"><span>Virtual Accounts</span><strong>{branches.filter(b=>b.branchAccounts?.length).length}</strong><small>Provisioned</small></div></section>
 {message&&<div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{message}</div>}{error&&<div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
 <section className="pwfb-panel"><div className="pwfb-panel-header"><div><h2>Branch Directory</h2><p>Exact branch records from the database.</p></div><span className="pwfb-record-count">{branches.length} records</span></div>{loading?<div className="p-6">Loading branches…</div>:<div className="pwfb-table-wrap"><table className="pwfb-table"><thead><tr><th>Branch</th><th>Code</th><th>Location</th><th>Virtual Account</th><th>Status</th><th>Action</th></tr></thead><tbody>{branches.map(b=>{const a=b.branchAccounts?.[0];return <tr key={b.id}><td><strong>{b.name}</strong></td><td>{b.code||"—"}</td><td>{b.location||"—"}</td><td><strong>{a?.accountNumber||"Not provisioned"}</strong></td><td><span className="pwfb-status-badge">{b.status||"Active"}</span></td><td><Link className="pwfb-secondary-button" href={`/branches/${b.id}`}>View / Edit</Link></td></tr>})}</tbody></table></div>}</section></main>;
}
